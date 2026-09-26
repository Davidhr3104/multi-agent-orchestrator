# Helix for Inbox — Followup Queue + Reasoning Panel + .eml Ingest — Design Spec

**App:** `apps/inbox/` · **Shared package:** `packages/helix-core/` (reuse only, no cross-app copy)
**Date:** 2026-09-26
**Status:** Draft — awaiting approval before a plan is written

## Why

Three gaps found by codebase investigation, prioritized by David:

1. Sent replies leave no trace of *when* they were sent. Without that, "no reply in 2 business
   days" cannot be computed. This blocks Feature A and must be fixed as part of this work, not
   separately.
2. The agent's classification/confidence/citation reasoning is invisible today — operators approve
   or reject decisions with no way to see why the agent proposed them.
3. There's no way to bring an email into Inbox except through the live Gmail sync. A `.eml` file
   dropped on a thread (forwarded from another mailbox, exported from a client) has nowhere to go.

## Decisions already made (not open for re-discussion in this doc)

- Build on the real Gmail integration — no separate fake-data demo path.
- `.eml` upload is in scope now, not deferred.
- Business-day calculation uses **US Eastern** as the default timezone.
- The `lastReplySentAt` gap is fixed inside this same body of work.
- Reasoning panel is a **lateral drawer**, expandable per selected thread (not inline, not a
  hover popover).
- A `.eml` that matches an existing thread is **attached as a new message to that thread** — never
  silently rejected, never forced into a new thread.

---

## Feature A — Followup queue (2 business days, no reply)

### A.1 Data model change

Add to `EmailThread` (`apps/inbox/src/lib/types.ts`):

```ts
lastReplySentAt?: string; // ISO timestamp — set only when *we* send a reply
```

Not `awaitingReplySince` — the field records a fact ("we replied at T"), and "is this now overdue"
is derived at read time from `lastReplySentAt` + business-day math, not stored as a second field
that could drift out of sync with the first.

### A.2 Where it gets set

`apps/inbox/src/app/api/messages/[id]/route.ts`, the `approve`/`send` branch (currently lines
104–108) adds the field to the same `patchMessage` call — one write, not two:

```ts
const message = await patchMessage(
  id,
  { status: "sent", needsReview: false, isRead: true, lastReplySentAt: new Date().toISOString() },
  { actionType: `send:${operatorActor(req)}:${sentVia}`, humanOverride: true }
);
```

If the thread later receives a *new inbound* message from the same sender (i.e. Gmail sync ingests
a fresh reply into the thread), `lastReplySentAt` must be cleared — otherwise a thread that *did*
get a reply would still look overdue. This happens in the sync path
(`apps/inbox/src/app/api/messages/sync/route.ts` → `fetchGmailInbox`/`ingestMessage` in
`apps/inbox/src/lib/store.ts`): when an inbound message is appended to a thread that already has
`lastReplySentAt` set, clear it as part of that same patch.

### A.3 Storage (`patchMessage` whitelist + Supabase)

- Add `lastReplySentAt` to the field whitelist in `patchMessage()`
  (`apps/inbox/src/lib/store.ts`, ~line 381–396).
- Add a `last_reply_sent_at TIMESTAMPTZ NULL` column to the `email_threads` Supabase table via a
  new migration file (follow the existing migration pattern in the repo — check
  `apps/inbox/supabase/migrations/` or equivalent, mirroring how Fase A of Leads added `crm_error`).
  Map the column in `supabaseUpsertThread`/`supabaseUpsertThreads`
  (`apps/inbox/src/lib/supabase-desk.ts`).
- **Deploy note (same shape as Leads' Fase A `crm_error` migration):** the migration must run
  against the real Supabase instance before this ships to production — flag this explicitly in the
  implementation report, don't assume it's applied.

### A.4 Business-day calculation (new, US Eastern default)

No existing business-day/holiday logic anywhere in the monorepo — build fresh. New module:
`apps/inbox/src/lib/business-days.ts`.

```ts
export function isOverdue(lastReplySentAt: string, now: Date = new Date()): boolean;
export function businessDaysBetween(from: Date, to: Date, timeZone?: string): number;
```

- Weekends (Sat/Sun in US Eastern) don't count.
- US federal holidays are **out of scope for v1** — treat every weekday as a business day. Flag
  this explicitly as a known simplification in the implementation report; don't silently build a
  holiday calendar not asked for (YAGNI — add later only if David asks).
- Timezone handling: use `Intl.DateTimeFormat` with `timeZone: "America/New_York"` to get the
  Eastern calendar date for both `lastReplySentAt` and `now`, then count weekday boundaries crossed
  — no new date library dependency needed for this scope.
- `isOverdue` returns true when `businessDaysBetween(lastReplySentAt, now) >= 2`.

### A.5 Surfacing the queue

Reuse the existing HITL-queue pattern (`apps/inbox/src/app/hitl-queue/page.tsx` +
`components/queue-table.tsx` + `components/active-inspector.tsx`) rather than building a new page
shell:

- New thread-list filter: threads where `status === "sent"` and `isOverdue(lastReplySentAt)` is
  true.
- New API surface: extend `GET /api/threads` (`apps/inbox/src/app/api/threads/route.ts`) with a
  query param, e.g. `?overdue=true`, computed server-side using `business-days.ts` so the UI never
  reimplements the date math.
- New page `apps/inbox/src/app/followup-queue/page.tsx`, structurally identical to
  `hitl-queue/page.tsx` (same `QueueTable` + `ActiveInspector` composition), fed by the new
  `overdue=true` filter instead of `status=review`.
- New action from `ActiveInspector` on this queue: "Send followup" — reuses the existing
  `smart_reply`-generation path to draft a followup, then the existing `approve`/`send` action to
  actually send it (which will naturally reset `lastReplySentAt` to now, exiting the overdue
  state). No new send codepath needed.
- Sidebar/nav entry for the new queue, same pattern as the existing HITL queue link.

### A.6 What this explicitly does NOT do (scope guard)

- No cron/background job in this pass — the queue is computed on read (`GET /api/threads?overdue=true`),
  consistent with how the rest of Inbox works today (no existing job scheduler in the app).
  If David wants a proactive notification (e.g. Slack ping) later, that's a separate ask.
- No auto-send of followups — every followup goes through the same human approval step as any
  other reply.

---

## Feature B — Agent reasoning drawer

### B.1 UI shape

A slide-in drawer, triggered per selected thread (e.g. a "Why this?" button next to the existing
inline inspector in `apps/inbox/src/components/inbox-dashboard.tsx`, or from
`active-inspector.tsx` on the queue pages). Not inline, not a hover popover — confirmed decision.

**Component source:** copy `apps/legal/src/components/ui/sheet.tsx` and
`apps/legal/src/components/ui/dialog.tsx` into `apps/inbox/src/components/ui/`. Both are built on
`@base-ui/react`, already a dependency of `apps/inbox` (`package.json` already lists
`@base-ui/react: ^1.8.0`) — **no new npm dependency**. This is a straight copy of two files, not a
redesign; keep them byte-for-byte compatible with the Legal versions unless Inbox's existing
Tailwind tokens force a class-name adjustment.

### B.2 Drawer content

Three sections, each backed by data that already exists or is added below:

1. **Classification + confidence** — `thread.category`, `thread.sentiment`, `thread.aiConfidence`
   (already exist on `EmailThread`, already rendered elsewhere in `active-inspector.tsx` — just
   re-surfaced in the drawer).
2. **Reasoning text** — `thread.reasoning` (already exists, already rendered as a quote in
   `inbox-dashboard.tsx` line ~767 — same content, drawer just gives it a dedicated, expandable
   home rather than living inline).
3. **Knowledge-base citations** — new. See B.3.

### B.3 Knowledge-base citations — reuse of Legal's corpus engine

`packages/helix-core/src/rfp/corpus.ts` is domain-agnostic (`chunkDocument`, `retrieveCorpusHits`,
`buildCorpusQuery` operate on `{id, title, body}` — nothing RFP-specific). Reuse directly via
`@helix/core`, no duplication.

**New in Inbox** (mirrors `apps/legal/src/lib/corpus-store.ts`):

- `apps/inbox/src/lib/kb-store.ts` — loads a set of Markdown files (a new `apps/inbox/kb/*.md`
  directory, or wherever David keeps the KB source — confirm exact location during planning) into
  `CorpusDocument[]`, chunks them once via `chunkDocument`.
- `queryInboxKb(thread: EmailThread, limit = 5): CorpusHit[]` — builds the query from
  `thread.subject` + `thread.body` (via `buildCorpusQuery({ title: thread.subject, body:
  thread.body })`) and calls `retrieveCorpusHits`.
- New field on `EmailThread`: `kbHits?: CorpusHit[]` (import `CorpusHit` from `@helix/core`),
  populated at classification time (wherever the agent pipeline currently sets `reasoning`/
  `aiConfidence` — same call site, one more field) and persisted the same way `reasoning` already
  is.
- Drawer renders each hit's `docTitle`, `quote` (already verified against source text by
  `citeSpan()` inside the corpus engine — never invented), and `verified` badge — same rendering
  pattern as `apps/legal/src/components/legal-dashboard.tsx` (~line 1363).

**Important distinction to preserve in the UI:** `CorpusHit.score` (retrieval relevance) and
`thread.aiConfidence` (classification confidence) are two different numbers from two different
mechanisms — label them separately in the drawer, don't conflate into one "confidence %".

### B.4 What this explicitly does NOT do

- Does not change the classification pipeline's decision logic — only adds a citation-retrieval
  step and surfaces existing fields that already exist but aren't shown yet.
- Does not build a KB authoring UI — Markdown files are added/edited directly in the repo for v1.

---

## Feature C — `.eml` upload with existing-thread matching

### C.1 Parsing dependency

No MIME/RFC822 parser exists in the monorepo today. Add one dependency to `apps/inbox/package.json`
— recommend `mailparser` (mature, widely used, handles MIME multipart/attachments) unless David
prefers an alternative during plan review.

### C.2 Upload endpoint

New route: `apps/inbox/src/app/api/messages/eml/route.ts` — `POST`, accepts a raw `.eml` file
(multipart form upload), parses it via `mailparser` into `{ subject, from, to, date, messageId,
inReplyTo, references, text/html body }`.

### C.3 Matching against existing threads

Two-tier match, in order:

1. **By RFC Message-ID**: if the parsed `.eml`'s `Message-Id` (or any id in its `References`/
   `In-Reply-To` chain) equals an existing `ThreadMessage.rfcMessageId` anywhere in the store, it
   belongs to that message's thread. This field already exists
   (`apps/inbox/src/lib/types.ts` line 14) and is already populated from Gmail sync
   (`apps/inbox/src/lib/gmail.ts` line ~161) — today nothing ever *reads* it for matching; this
   feature is the first consumer.
2. **Fallback — subject + participants**: if no Message-ID match, normalize the subject (strip
   leading `Re:`/`Fwd:`, case-insensitive) and match against `EmailThread.subject` where the
   `.eml`'s `from`/`to` overlaps the thread's `fromEmail`/`toEmail`.

New store function: `findThreadForEml(parsed): EmailThread | null` in `apps/inbox/src/lib/store.ts`,
implementing the two-tier match above.

### C.4 Outcome (per confirmed decision — always attach, never reject, never force a new thread)

- **Match found:** append a new `ThreadMessage` to that thread (same shape Gmail sync produces —
  `fromEmail`, `body`, `sentAt` from the parsed `.eml`'s `Date` header, `rfcMessageId` from its
  `Message-Id`). Update the parent thread's `updatedAt`. If the `.eml` represents an *inbound*
  message (sender differs from the workspace's connected mailbox) and the thread has
  `lastReplySentAt` set, clear it per A.2's rule — a `.eml` reply is still a reply for followup
  purposes.
- **No match:** create a new thread via the existing `ingestMessage()` path
  (`apps/inbox/src/lib/store.ts` lines ~415–541), same as any other manually-ingested thread today.

### C.5 What this explicitly does NOT do

- Does not attempt to parse or render attachments inside the `.eml` beyond the text/HTML body —
  attachment handling is out of scope unless David asks.
- Does not add `.eml` *export* (downloading a thread as `.eml`) — upload only.

---

## Cross-feature notes

- All three features touch `EmailThread` (`types.ts`) — the implementation plan should sequence
  Feature A's type change first (smallest, most foundational), then B and C can proceed in
  parallel since they touch different fields (`kbHits` vs. the `.eml` ingest path) and mostly
  different files.
- None of this touches `apps/commerce`, `apps/legal`, `apps/marketing`, or the Leads app — per the
  root `CLAUDE.md` rule, stay inside `apps/inbox` and `packages/helix-core` (read-only reuse of
  `corpus.ts`, no edits to it).
- Do not commit or push without explicit confirmation, per repo convention already followed in the
  Leads Fase A/B work.

## Open questions for plan-writing time (not blocking this doc's approval, but need an answer before Task breakdown)

1. Exact location/format for the Inbox KB Markdown source files (new `apps/inbox/kb/` directory?
   Supabase-stored? confirm before Task 1 of Feature B).
2. Confirm `mailparser` as the `.eml` parsing dependency, or name a preferred alternative.
3. Confirm the Supabase migration file naming/location convention used elsewhere in `apps/inbox`
   (there's no visible `crm_error`-equivalent migration in Inbox yet to copy from — Leads' Fase A
   migration lived in a different app's Supabase schema).
