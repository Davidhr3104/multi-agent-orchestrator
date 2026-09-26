# Helix Inbox — Followup Queue + Reasoning Drawer + .eml Ingest Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the three features from `docs/superpowers/specs/2026-09-26-helix-inbox-followup-reasoning-design.md`
in `apps/inbox`: (A) a followup queue for threads unanswered after 2 US-Eastern business days, (B)
a lateral reasoning drawer showing classification/confidence/KB citations, and (C) `.eml` upload
that attaches to an existing thread when one matches instead of creating a duplicate.

**Architecture:** Pure, testable logic (business-day math, `.eml`-to-thread matching) lives in
`packages/helix-core` — the only workspace with a real test runner (`vitest`) — and is imported
into `apps/inbox` via `@helix/core`. Next.js-specific code (API routes, React components) stays in
`apps/inbox`, following its existing route/store/component patterns. The reasoning drawer reuses
`apps/legal`'s Base UI `sheet.tsx`/`dialog.tsx` (copied, not imported cross-app) and the shared
`corpus.ts` retrieval engine (imported, not duplicated).

**Tech Stack:** Next.js 15 (App Router), TypeScript, `@helix/core` workspace package, `vitest` for
pure-logic tests, `@base-ui/react` (already installed in `apps/inbox`), new dependency `mailparser`
for `.eml` parsing.

## Global Constraints

- Do not modify `apps/commerce`, `apps/legal`, `apps/marketing`, `apps/lead-scoring` — this plan
  touches `apps/inbox` and `packages/helix-core` only. Copying two UI files from `apps/legal` into
  `apps/inbox` is a read, not a modification of Legal.
- Business-day calc timezone: **US Eastern** (`America/New_York`), no new date library.
- US federal holidays are **out of scope for v1** — every weekday counts as a business day.
- `.eml` upload: on a match (by `rfcMessageId` first, then subject+participants fallback), always
  attach as a new message to the existing thread. Never reject, never force a new thread when a
  match exists.
- KB source files live in `apps/inbox/kb/*.md` (confirmed with David).
- `.eml` parsing dependency: `mailparser` (confirmed with David).
- Do not commit or push without explicit user confirmation (repo `CLAUDE.md` rule, already followed
  in the Leads Fase A/B work).
- No cron/background job in this pass — the followup queue is computed on read.
- No auto-send of followups — every followup goes through the same human approval as any reply.

---

## Task 1: Business-day math in `@helix/core`

**Files:**
- Create: `packages/helix-core/src/inbox/business-days.ts`
- Test: `packages/helix-core/src/inbox/business-days.test.ts`
- Modify: `packages/helix-core/package.json` (add export entry)

**Interfaces:**
- Consumes: nothing from other tasks (foundational, do first).
- Produces: `isOverdue(lastReplySentAt: string, now?: Date): boolean` and
  `businessDaysBetween(from: Date, to: Date): number` — imported by Task 2 (API route) and Task 4
  (followup queue filter) as `import { isOverdue } from "@helix/core/inbox/business-days"`.

- [ ] **Step 1: Write the failing tests**

Create `packages/helix-core/src/inbox/business-days.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { businessDaysBetween, isOverdue } from "./business-days";

describe("businessDaysBetween", () => {
  it("counts zero business days between the same weekday timestamp", () => {
    const from = new Date("2026-09-23T14:00:00Z"); // Wed
    const to = new Date("2026-09-23T18:00:00Z"); // same Wed, later
    expect(businessDaysBetween(from, to)).toBe(0);
  });

  it("counts one business day from Wednesday to Thursday", () => {
    const from = new Date("2026-09-23T14:00:00Z"); // Wed
    const to = new Date("2026-09-24T14:00:00Z"); // Thu
    expect(businessDaysBetween(from, to)).toBe(1);
  });

  it("does not count weekend days from Friday to Monday", () => {
    const from = new Date("2026-09-25T14:00:00Z"); // Fri
    const to = new Date("2026-09-28T14:00:00Z"); // Mon
    expect(businessDaysBetween(from, to)).toBe(1);
  });

  it("counts two business days from Thursday to Monday", () => {
    const from = new Date("2026-09-24T14:00:00Z"); // Thu
    const to = new Date("2026-09-28T14:00:00Z"); // Mon
    expect(businessDaysBetween(from, to)).toBe(2);
  });
});

describe("isOverdue", () => {
  it("is not overdue before 2 business days have passed", () => {
    const sentAt = "2026-09-23T14:00:00.000Z"; // Wed
    const now = new Date("2026-09-24T14:00:00Z"); // Thu, 1 business day later
    expect(isOverdue(sentAt, now)).toBe(false);
  });

  it("is overdue at exactly 2 business days", () => {
    const sentAt = "2026-09-23T14:00:00.000Z"; // Wed
    const now = new Date("2026-09-25T14:00:00Z"); // Fri, 2 business days later
    expect(isOverdue(sentAt, now)).toBe(true);
  });

  it("weekend does not shorten the wait", () => {
    const sentAt = "2026-09-25T14:00:00.000Z"; // Fri
    const now = new Date("2026-09-28T14:00:00Z"); // Mon, 1 business day later
    expect(isOverdue(sentAt, now)).toBe(false);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd packages/helix-core && npx vitest run src/inbox/business-days.test.ts`
Expected: FAIL — `Cannot find module './business-days'` (file doesn't exist yet).

- [ ] **Step 3: Write the minimal implementation**

Create `packages/helix-core/src/inbox/business-days.ts`:

```ts
const TIME_ZONE = "America/New_York";

/** Returns the weekday index (0=Sun..6=Sat) for a Date, evaluated in US Eastern. */
function easternWeekday(date: Date): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: TIME_ZONE,
    weekday: "short",
  }).format(date);
  const map: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return map[parts] ?? 0;
}

/** Returns the US-Eastern calendar date (midnight UTC-normalized) for a Date, as a comparable key. */
function easternDateKey(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE }).format(date); // "YYYY-MM-DD"
}

/**
 * Number of US-Eastern business-day boundaries crossed between `from` and `to`.
 * Same Eastern calendar day (regardless of time) counts as 0. Weekends are not counted.
 */
export function businessDaysBetween(from: Date, to: Date): number {
  const fromKey = easternDateKey(from);
  let count = 0;
  const cursor = new Date(from.getTime());
  let cursorKey = fromKey;
  const toKey = easternDateKey(to);
  while (cursorKey !== toKey) {
    cursor.setUTCDate(cursor.getUTCDate() + 1);
    cursorKey = easternDateKey(cursor);
    const weekday = easternWeekday(cursor);
    if (weekday !== 0 && weekday !== 6) count += 1;
  }
  return count;
}

/** True once `lastReplySentAt` is at least 2 US-Eastern business days in the past. */
export function isOverdue(lastReplySentAt: string, now: Date = new Date()): boolean {
  return businessDaysBetween(new Date(lastReplySentAt), now) >= 2;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd packages/helix-core && npx vitest run src/inbox/business-days.test.ts`
Expected: PASS, all 7 tests.

- [ ] **Step 5: Run the full helix-core suite to check for regressions**

Run: `cd packages/helix-core && npx vitest run`
Expected: PASS (existing tests plus the new file).

- [ ] **Step 6: Add the package export**

In `packages/helix-core/package.json`, add to `"exports"`:

```json
"./inbox/business-days": "./src/inbox/business-days.ts"
```

- [ ] **Step 7: Typecheck**

Run: `cd packages/helix-core && npx tsc --noEmit`
Expected: 0 errors.

- [ ] **Step 8: Commit**

```bash
git add packages/helix-core/src/inbox/business-days.ts packages/helix-core/src/inbox/business-days.test.ts packages/helix-core/package.json
git commit -m "feat(inbox): add US-Eastern business-day math for followup overdue check"
```

---

## Task 2: `lastReplySentAt` field, set-on-send, clear-on-inbound-reply

**Files:**
- Modify: `apps/inbox/src/lib/types.ts`
- Modify: `apps/inbox/src/lib/store.ts`
- Modify: `apps/inbox/src/app/api/messages/[id]/route.ts`

**Interfaces:**
- Consumes: nothing from Task 1 directly (this task only adds/sets the field; Task 1's
  `isOverdue` is consumed later, in Task 4).
- Produces: `EmailThread.lastReplySentAt?: string`, consumed by Task 4 (followup queue filter) and
  Task 5 (`.eml` clearing it on an inbound match).

- [ ] **Step 1: Add the field to the type**

In `apps/inbox/src/lib/types.ts`, add to `EmailThread` (after `handedOffAt?: string;`, line 97):

```ts
  handedOffAt?: string;
  /** ISO timestamp of the last time *we* sent a reply on this thread — cleared when a new inbound message arrives. */
  lastReplySentAt?: string;
```

- [ ] **Step 2: Add the field to `patchMessage`'s whitelist**

In `apps/inbox/src/lib/store.ts`, the `patchMessage` signature (lines 379-397), add
`"lastReplySentAt"` to the `Pick<EmailThread, ...>` union:

```ts
export async function patchMessage(
  id: string,
  patch: Partial<
    Pick<
      EmailThread,
      | "status"
      | "needsReview"
      | "draftReply"
      | "routeTo"
      | "snoozeUntil"
      | "category"
      | "sentiment"
      | "isRead"
      | "isStarred"
      | "draftTone"
      | "handedOffAt"
      | "lastReplySentAt"
    >
  >,
  opts?: { humanOverride?: boolean; actionType?: string }
): Promise<InboxMessage | null> {
```

- [ ] **Step 3: Set it on send**

In `apps/inbox/src/app/api/messages/[id]/route.ts`, the `approve`/`send` branch (lines 104-108),
add the field to the same patch call:

```ts
      const message = await patchMessage(
        id,
        {
          status: "sent",
          needsReview: false,
          isRead: true,
          lastReplySentAt: new Date().toISOString(),
        },
        { actionType: `send:${operatorActor(req)}:${sentVia}`, humanOverride: true }
      );
```

- [ ] **Step 4: Clear it when a new inbound message arrives on a thread that has it set**

In `apps/inbox/src/lib/store.ts`, find `ingestMessage()` (line 415). This function always creates a
*new* thread (`id = thr-${Date.now()...}`, line 431) — it is not the path used when Gmail sync adds
a message to an *existing* thread. Find that path: search for where sync appends to
`mem.messages.set(threadId, ...)` for a thread that already exists (likely in
`apps/inbox/src/app/api/messages/sync/route.ts` or a sync-specific function in `store.ts` — read
both files to confirm the exact function name before editing, since it wasn't the one directly
quoted in the design spec).

Add this rule at the point where an inbound message is appended to an existing thread: if
`thread.lastReplySentAt` is set and the new message's `fromEmail` is not the workspace's own
account (i.e. it's a genuine inbound reply, not an echo of our own sent message coming back through
sync), patch the thread with `lastReplySentAt: undefined` via `patchMessage` (or the equivalent
internal update path used by sync, if it doesn't go through `patchMessage`) — using an internal
field-clearing update consistent with how the sync function already updates threads elsewhere in
that same function.

Because this step depends on reading the real sync function first (not fully quoted in the spec),
write a small unit-style check via manual verification in Step 5 rather than a unit test — the sync
path involves live Gmail API calls that aren't independently testable without a real Gmail
connection, consistent with how the rest of the sync module works today (no existing tests cover
`fetchGmailInbox`/sync either).

- [ ] **Step 5: Manual verification**

Run: `cd apps/inbox && npx tsc --noEmit` — expect 0 errors first.

Run: `cd apps/inbox && npm run dev`. Approve and send a reply on any thread via the UI or
`PATCH /api/messages/{id}` with `{"action":"send"}`. Confirm via `GET /api/messages/{id}` that
`lastReplySentAt` is now set to a recent ISO timestamp. Stop the dev server.

Document in your task report whether you were able to exercise Step 4's clear-on-inbound path at
runtime (requires a live Gmail account with a real inbound reply) or verified it by code review
only — same disclosure pattern Fase A of Leads used for hard-to-exercise branches.

- [ ] **Step 6: Commit**

```bash
git add apps/inbox/src/lib/types.ts apps/inbox/src/lib/store.ts apps/inbox/src/app/api/messages/[id]/route.ts
git commit -m "feat(inbox): track lastReplySentAt, clear it when a real inbound reply arrives"
```

---

## Task 3: Supabase migration for `last_reply_sent_at`

**Files:**
- Create: `apps/inbox/supabase/last-reply-sent-at.sql`
- Modify: `apps/inbox/src/lib/supabase-desk.ts`

**Interfaces:**
- Consumes: `EmailThread.lastReplySentAt` (Task 2).
- Produces: nothing consumed by later tasks — this task only makes Task 2's field durable across
  restarts/deploys.

- [ ] **Step 1: Read an existing migration file for the naming/column convention**

Read `apps/inbox/supabase/theme-column.sql` in full — it's the smallest existing migration and
shows the exact `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` style already used in this app's
Supabase schema.

- [ ] **Step 2: Write the migration**

Create `apps/inbox/supabase/last-reply-sent-at.sql`, following the exact style read in Step 1
(table name confirmed from that file — likely `email_threads`; use whatever table name
`theme-column.sql` actually alters, not a guessed name):

```sql
ALTER TABLE email_threads
  ADD COLUMN IF NOT EXISTS last_reply_sent_at TIMESTAMPTZ NULL;
```

- [ ] **Step 3: Map the column in `supabase-desk.ts`**

Open `apps/inbox/src/lib/supabase-desk.ts`. Find `supabaseUpsertThread`/`supabaseUpsertThreads`
(the functions that map `EmailThread` fields to Supabase row columns — read the existing mapping
for `handedOffAt` → `handed_off_at` or similar as the pattern to copy) and add:
`lastReplySentAt` → `last_reply_sent_at`. Also find wherever rows are read back and mapped into
`EmailThread` (the reverse direction) and add the same field both ways.

- [ ] **Step 4: Typecheck**

Run: `cd apps/inbox && npx tsc --noEmit` — expect 0 errors.

- [ ] **Step 5: Flag the deploy requirement in the task report**

State explicitly: this migration must be run against the real Supabase instance before this ships
to production — it is not applied automatically by this commit. Same deploy note pattern as Leads'
Fase A `crm_error` migration.

- [ ] **Step 6: Commit**

```bash
git add apps/inbox/supabase/last-reply-sent-at.sql apps/inbox/src/lib/supabase-desk.ts
git commit -m "feat(inbox): add last_reply_sent_at column mapping (migration not yet applied to prod)"
```

---

## Task 4: Followup queue — API filter + page

**Files:**
- Modify: `apps/inbox/src/app/api/threads/route.ts`
- Create: `apps/inbox/src/app/followup-queue/page.tsx`
- Modify: wherever the sidebar/nav links are defined (find via grep for the existing `hitl-queue`
  nav link, e.g. `apps/inbox/src/components/` — read the file that renders the nav before editing).

**Interfaces:**
- Consumes: `isOverdue` from Task 1 (`@helix/core/inbox/business-days`), `lastReplySentAt` from
  Task 2.
- Produces: `GET /api/threads?overdue=true` — consumed only by the new page in this task, no other
  task depends on it.

- [ ] **Step 1: Read the existing threads route and hitl-queue page**

Read `apps/inbox/src/app/api/threads/route.ts` in full (the existing `status` filter logic) and
`apps/inbox/src/app/hitl-queue/page.tsx` in full (the exact `QueueTable`/`ActiveInspector`
composition this task mirrors). Confirm exact prop names/types both components expect before
writing the new page.

- [ ] **Step 2: Add the `overdue` filter to the threads route**

In `apps/inbox/src/app/api/threads/route.ts`, alongside the existing `status` query-param
filtering, add:

```ts
import { isOverdue } from "@helix/core/inbox/business-days";

// ...inside the GET handler, after loading `threads`:
const overdueParam = url.searchParams.get("overdue");
const filtered = overdueParam === "true"
  ? threads.filter((t) => t.status === "sent" && t.lastReplySentAt && isOverdue(t.lastReplySentAt))
  : threads; // (compose with whatever existing status-filter variable already exists — read Step 1's file to slot this in correctly, don't overwrite the existing filter chain)
```

Adapt variable names to match the file's real structure from Step 1's read — this shows the exact
filter predicate and import, not necessarily the exact insertion point syntax.

- [ ] **Step 3: Create the followup-queue page**

Create `apps/inbox/src/app/followup-queue/page.tsx`, structurally identical to
`apps/inbox/src/app/hitl-queue/page.tsx` but:
- Fetches `GET /api/threads?overdue=true` instead of `GET /api/threads?status=review`.
- Page heading/copy says "Followups overdue" instead of the HITL queue's heading (read the real
  heading text from `hitl-queue/page.tsx` and write an analogous one, don't leave a placeholder).
- Reuses `QueueTable` and `ActiveInspector` with the same props `hitl-queue/page.tsx` passes them.

- [ ] **Step 4: Add a "Send followup" action to `ActiveInspector` for this queue**

Read `apps/inbox/src/components/active-inspector.tsx` in full. It already supports a `smart_reply`
action (regenerates `draftReply`) and the `approve`/`send` action. Add a `"Send followup"` button,
visible only when the inspected thread's `status === "sent"` (i.e. we're looking at an overdue
thread, not a fresh review item) — wire it to call `PATCH /api/messages/{id}` with
`{"action":"smart_reply"}` first (regenerate the draft in a followup tone) then let the operator
review/edit before hitting the existing `send` action, exactly like the normal reply flow. Do not
add a new send codepath — this reuses `smart_reply` + `send` exactly as they exist today.

- [ ] **Step 5: Add the nav link**

Find the file rendering the sidebar/nav (grep for the `hitl-queue` link text or href). Add a
sibling link `"Followups"` → `/followup-queue`, same styling/pattern as the existing HITL link.

- [ ] **Step 6: Typecheck**

Run: `cd apps/inbox && npx tsc --noEmit` — expect 0 errors.

- [ ] **Step 7: Manual verification**

Run: `cd apps/inbox && npm run dev`. Send a reply on a thread (sets `lastReplySentAt` per Task 2).
Temporarily verify the overdue filter logic by checking `GET /api/threads?overdue=true` returns
empty right after sending (not yet 2 business days). Since waiting 2 real business days isn't
practical for manual testing, verify by directly checking the filter predicate against a manually
inspected `lastReplySentAt` value using the browser devtools network tab or `curl`, and confirm the
page renders correctly with whatever the current (correctly empty, at first) result set is. Stop
the dev server. Document in the report that full end-to-end "actually overdue" verification would
require either mocking `now` or waiting real days — same category of limitation as Task 2 Step 4.

- [ ] **Step 8: Commit**

```bash
git add apps/inbox/src/app/api/threads/route.ts apps/inbox/src/app/followup-queue/page.tsx apps/inbox/src/components/active-inspector.tsx
git commit -m "feat(inbox): add followup queue for threads unanswered after 2 business days"
```

(Add the nav-link file to this commit too, once identified in Step 5.)

---

## Task 5: `.eml` parsing + thread matching in `@helix/core`

**Files:**
- Create: `packages/helix-core/src/inbox/eml.ts`
- Test: `packages/helix-core/src/inbox/eml.test.ts`
- Modify: `packages/helix-core/package.json` (export entry)
- Modify: `apps/inbox/package.json` (add `mailparser` dependency)

**Interfaces:**
- Consumes: nothing from other tasks.
- Produces: `parseEml(raw: Buffer | string): Promise<ParsedEml>` and
  `matchThread(parsed: ParsedEml, threads: EmailThread[]): EmailThread | null`, consumed by Task 6
  (the upload API route).

```ts
export type ParsedEml = {
  subject: string;
  fromEmail: string;
  toEmail?: string;
  date: string; // ISO
  rfcMessageId?: string;
  inReplyTo?: string;
  references: string[];
  textBody: string;
};
```

- [ ] **Step 1: Add `mailparser` to `apps/inbox`**

Run: `cd apps/inbox && npm install mailparser`

`mailparser` needs to be usable from `packages/helix-core` too (parsing logic lives there per this
task's architecture) — check whether `packages/helix-core/package.json` needs its own dependency
entry or whether the monorepo's npm workspaces hoist it so `@helix/core` can `import` it without a
separate install. If `packages/helix-core`'s existing imports (e.g. in `rfp/corpus.ts`) never
import a third-party package directly, this may be the first such case — if `import { simpleParser
} from "mailparser"` fails to resolve when you write Step 3's code, run
`cd packages/helix-core && npm install mailparser` explicitly and note this in your report.

- [ ] **Step 2: Write the failing tests**

Create `packages/helix-core/src/inbox/eml.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { parseEml, matchThread } from "./eml";
import type { EmailThread } from "../types"; // confirm EmailThread is actually exported from
// packages/helix-core/src/types.ts — if EmailThread lives only in apps/inbox/src/lib/types.ts and
// is NOT re-exported from @helix/core today, this task must define a minimal local shape here
// instead (see Step 3 note) rather than importing a type that doesn't exist in this package.

const SAMPLE_EML = `From: Jane Doe <jane@example.com>
To: triage@company.io
Subject: Question about pricing
Message-Id: <abc123@mail.example.com>
Date: Wed, 23 Sep 2026 14:00:00 +0000
Content-Type: text/plain

Hi, what's your enterprise pricing?
`;

const REPLY_EML = `From: triage@company.io
To: jane@example.com
Subject: Re: Question about pricing
Message-Id: <def456@mail.example.com>
In-Reply-To: <abc123@mail.example.com>
References: <abc123@mail.example.com>
Date: Wed, 23 Sep 2026 15:00:00 +0000
Content-Type: text/plain

Our enterprise plan starts at $999/mo.
`;

describe("parseEml", () => {
  it("extracts subject, from, message id, and body", async () => {
    const parsed = await parseEml(SAMPLE_EML);
    expect(parsed.subject).toBe("Question about pricing");
    expect(parsed.fromEmail).toBe("jane@example.com");
    expect(parsed.rfcMessageId).toBe("<abc123@mail.example.com>");
    expect(parsed.textBody).toContain("enterprise pricing");
  });

  it("extracts In-Reply-To and References", async () => {
    const parsed = await parseEml(REPLY_EML);
    expect(parsed.inReplyTo).toBe("<abc123@mail.example.com>");
    expect(parsed.references).toEqual(["<abc123@mail.example.com>"]);
  });
});

describe("matchThread", () => {
  const existingThread = {
    id: "thr-1",
    subject: "Question about pricing",
    fromEmail: "jane@example.com",
    toEmail: "triage@company.io",
  } as EmailThread;

  it("matches by rfcMessageId found in References", async () => {
    const parsed = await parseEml(REPLY_EML);
    const found = matchThread(parsed, [existingThread], [
      { threadId: "thr-1", rfcMessageId: "<abc123@mail.example.com>" },
    ]);
    expect(found?.id).toBe("thr-1");
  });

  it("falls back to subject + participant match when no Message-Id match", async () => {
    const parsed = await parseEml(SAMPLE_EML);
    const found = matchThread(parsed, [existingThread], []);
    expect(found?.id).toBe("thr-1");
  });

  it("returns null when nothing matches", async () => {
    const unrelated = { ...existingThread, subject: "Totally different", fromEmail: "other@x.com" };
    const parsed = await parseEml(SAMPLE_EML);
    const found = matchThread(parsed, [unrelated], []);
    expect(found).toBeNull();
  });
});
```

Note the type-import caveat in the sample: if `EmailThread` isn't exported from `@helix/core`
today, define a minimal local type in `eml.ts` instead (just the fields `matchThread` actually
reads: `id`, `subject`, `fromEmail`, `toEmail`) rather than importing Inbox's app-local type into
the shared package — confirm which is true by checking `packages/helix-core/src/types.ts` and
`packages/helix-core/src/index.ts`'s exports before writing this file for real.

- [ ] **Step 3: Run the tests to verify they fail**

Run: `cd packages/helix-core && npx vitest run src/inbox/eml.test.ts`
Expected: FAIL — `Cannot find module './eml'`.

- [ ] **Step 4: Write the minimal implementation**

Create `packages/helix-core/src/inbox/eml.ts`:

```ts
import { simpleParser } from "mailparser";

export type ParsedEml = {
  subject: string;
  fromEmail: string;
  toEmail?: string;
  date: string;
  rfcMessageId?: string;
  inReplyTo?: string;
  references: string[];
  textBody: string;
};

/** Minimal shape this module needs from a thread — avoids importing an app-local EmailThread type
 * into the shared package. Callers (apps/inbox) pass their real EmailThread objects; only these
 * fields are read. */
export type MatchableThread = {
  id: string;
  subject: string;
  fromEmail: string;
  toEmail: string;
};

export type MatchableMessage = {
  threadId: string;
  rfcMessageId?: string;
};

export async function parseEml(raw: Buffer | string): Promise<ParsedEml> {
  const parsed = await simpleParser(raw);
  const references = Array.isArray(parsed.references)
    ? parsed.references
    : parsed.references
      ? [parsed.references]
      : [];
  return {
    subject: parsed.subject ?? "",
    fromEmail: parsed.from?.value[0]?.address ?? "",
    toEmail: parsed.to && "value" in parsed.to ? parsed.to.value[0]?.address : undefined,
    date: (parsed.date ?? new Date()).toISOString(),
    rfcMessageId: parsed.messageId,
    inReplyTo: parsed.inReplyTo,
    references,
    textBody: parsed.text ?? "",
  };
}

function normalizeSubject(subject: string): string {
  return subject.replace(/^(re|fwd|fw):\s*/i, "").trim().toLowerCase();
}

/**
 * Two-tier match: by RFC Message-Id (in the parsed .eml's own id, In-Reply-To, or References)
 * against any known message's rfcMessageId, then by normalized subject + participant overlap.
 * Returns null when neither tier finds a match — caller creates a new thread in that case.
 */
export function matchThread(
  parsed: ParsedEml,
  threads: MatchableThread[],
  messages: MatchableMessage[]
): MatchableThread | null {
  const candidateIds = [parsed.rfcMessageId, parsed.inReplyTo, ...parsed.references].filter(
    (id): id is string => Boolean(id)
  );
  if (candidateIds.length > 0) {
    const byId = messages.find((m) => m.rfcMessageId && candidateIds.includes(m.rfcMessageId));
    if (byId) {
      const thread = threads.find((t) => t.id === byId.threadId);
      if (thread) return thread;
    }
  }
  const subject = normalizeSubject(parsed.subject);
  const bySubject = threads.find((t) => {
    if (normalizeSubject(t.subject) !== subject) return false;
    return (
      t.fromEmail.toLowerCase() === parsed.fromEmail.toLowerCase() ||
      t.toEmail.toLowerCase() === parsed.fromEmail.toLowerCase() ||
      (parsed.toEmail && t.fromEmail.toLowerCase() === parsed.toEmail.toLowerCase())
    );
  });
  return bySubject ?? null;
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `cd packages/helix-core && npx vitest run src/inbox/eml.test.ts`
Expected: PASS, all 5 tests. If `mailparser`'s parsed field shapes differ from what's assumed above
(e.g. `parsed.to` shape, `parsed.references` being `string | string[] | undefined`), adjust the
implementation to match the library's actual runtime output — don't adjust the tests to match a
broken implementation.

- [ ] **Step 6: Run the full helix-core suite**

Run: `cd packages/helix-core && npx vitest run`
Expected: PASS.

- [ ] **Step 7: Add the package export and typecheck**

In `packages/helix-core/package.json`, add:

```json
"./inbox/eml": "./src/inbox/eml.ts"
```

Run: `cd packages/helix-core && npx tsc --noEmit` — expect 0 errors.
Run: `cd apps/inbox && npx tsc --noEmit` — expect 0 errors.

- [ ] **Step 8: Commit**

```bash
git add packages/helix-core/src/inbox/eml.ts packages/helix-core/src/inbox/eml.test.ts packages/helix-core/package.json apps/inbox/package.json apps/inbox/package-lock.json
git commit -m "feat(inbox): add .eml parsing and thread-matching logic (message-id + subject fallback)"
```

---

## Task 6: `.eml` upload endpoint — attach to matched thread or create new

**Files:**
- Create: `apps/inbox/src/app/api/messages/eml/route.ts`
- Modify: `apps/inbox/src/lib/store.ts`

**Interfaces:**
- Consumes: `parseEml`, `matchThread` (Task 5, `@helix/core/inbox/eml`), `ingestMessage`
  (existing, `apps/inbox/src/lib/store.ts:415`), `patchMessage` (Task 2's whitelist, for clearing
  `lastReplySentAt` on an inbound-match attach).
- Produces: `POST /api/messages/eml` (multipart form, field name `file`) →
  `{ threadId: string, created: boolean }` — not consumed by any other task in this plan (this is
  the final feature-facing endpoint; a future upload-UI task, not in this plan, would call it).

- [ ] **Step 1: Add `findThreadForEml` to the store**

In `apps/inbox/src/lib/store.ts`, add a new function near `ingestMessage`:

```ts
import { matchThread, type MatchableThread, type MatchableMessage } from "@helix/core/inbox/eml";
import type { ParsedEml } from "@helix/core/inbox/eml";

export async function findThreadForEml(parsed: ParsedEml): Promise<EmailThread | null> {
  const mem = deskMem();
  seedMemory();
  await hydrateFromRemote();
  const threads: MatchableThread[] = [...mem.threads.values()].map((t) => ({
    id: t.id,
    subject: t.subject,
    fromEmail: t.fromEmail,
    toEmail: t.toEmail,
  }));
  const allMessages: MatchableMessage[] = [];
  for (const [threadId, msgs] of mem.messages.entries()) {
    for (const m of msgs) {
      if (m.rfcMessageId) allMessages.push({ threadId, rfcMessageId: m.rfcMessageId });
    }
  }
  const matched = matchThread(parsed, threads, allMessages);
  if (!matched) return null;
  return (await getThread(matched.id)) ?? null;
}
```

Confirm the exact in-memory store shape (`mem.threads`, `mem.messages` — a `Map`? read the top of
`store.ts` where `deskMem()` is defined) before writing this — adapt field/variable names to match
what's actually there; the design intent (build a flat list of matchable threads/messages from
whatever in-memory store this file actually uses, then delegate to `matchThread`) is what must be
preserved.

- [ ] **Step 2: Add `appendEmlToThread` to the store**

Add a second function, also in `store.ts`:

```ts
export async function appendEmlToThread(
  thread: EmailThread,
  parsed: ParsedEml
): Promise<InboxMessage> {
  const newMessage: ThreadMessage = {
    id: `tm-${thread.id}-${Date.now().toString(36)}`,
    threadId: thread.id,
    rfcMessageId: parsed.rfcMessageId,
    fromEmail: parsed.fromEmail,
    toEmail: parsed.toEmail,
    subject: parsed.subject,
    body: parsed.textBody,
    sentAt: parsed.date,
    createdAt: nowIso(),
  };
  const existing = await listThreadMessages(thread.id);
  const mem = deskMem();
  mem.messages.set(thread.id, [...existing, newMessage]);
  await supabaseUpsertThreadMessages([newMessage]);

  const isInboundReply = parsed.fromEmail.toLowerCase() !== thread.toEmail.toLowerCase();
  const patch: Partial<EmailThread> = { updatedAt: nowIso() };
  if (isInboundReply && thread.lastReplySentAt) {
    patch.lastReplySentAt = undefined;
  }
  const updated = await patchMessage(thread.id, patch, {
    actionType: "eml_attached",
    humanOverride: true,
  });
  return updated!;
}
```

Verify `nowIso`, `supabaseUpsertThreadMessages`, `listThreadMessages`, and `deskMem` are the real
names already used elsewhere in this file (they appear in the code already read during Task 2/3 —
confirm exact casing/signatures, don't guess).

- [ ] **Step 3: Create the upload route**

Create `apps/inbox/src/app/api/messages/eml/route.ts`:

```ts
import { parseEml } from "@helix/core/inbox/eml";
import { appendEmlToThread, findThreadForEml, ingestMessage } from "@/lib/store";
import { operatorActor, requireOperator } from "@helix/core/operator";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const denied = requireOperator(req);
  if (denied) return denied;

  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return Response.json({ error: "Missing .eml file" }, { status: 400 });
  }
  const raw = Buffer.from(await file.arrayBuffer());
  const parsed = await parseEml(raw);

  const matched = await findThreadForEml(parsed);
  if (matched) {
    const message = await appendEmlToThread(matched, parsed);
    return Response.json({ threadId: matched.id, created: false, message });
  }

  const created = await ingestMessage({
    fromName: parsed.fromEmail,
    fromEmail: parsed.fromEmail,
    subject: parsed.subject,
    body: parsed.textBody,
    rfcMessageId: parsed.rfcMessageId,
  });
  return Response.json({ threadId: created.id, created: true, message: created });
}
```

- [ ] **Step 4: Typecheck**

Run: `cd apps/inbox && npx tsc --noEmit` — expect 0 errors.

- [ ] **Step 5: Manual verification — new thread case**

Run: `cd apps/inbox && npm run dev`. Save the `SAMPLE_EML` content from Task 5's test file to a
local `.eml` file. Run:

```bash
curl -X POST http://127.0.0.1:43151/api/messages/eml -F "file=@sample.eml"
```

Expect `{"created": true, "threadId": "thr-..."}`. Confirm via `GET /api/threads` the new thread
appears with the right subject/sender.

- [ ] **Step 6: Manual verification — matched thread case**

Save `REPLY_EML` (from Task 5's test, which has `In-Reply-To`/`References` pointing at the first
message's `Message-Id`) to a second local `.eml` file. Upload it the same way. Expect
`{"created": false, "threadId": "<the same threadId from Step 5>"}`. Confirm via
`GET /api/messages/{threadId}` that the thread now has two messages in its history, not two
separate threads. Stop the dev server.

- [ ] **Step 7: Commit**

```bash
git add apps/inbox/src/app/api/messages/eml/route.ts apps/inbox/src/lib/store.ts
git commit -m "feat(inbox): add .eml upload endpoint, attaching to matched thread or creating new (5.2/C)"
```

---

## Task 7: Reasoning drawer — copy Sheet/Dialog primitives, wire classification + reasoning

**Files:**
- Create: `apps/inbox/src/components/ui/sheet.tsx` (copied from `apps/legal`)
- Create: `apps/inbox/src/components/ui/dialog.tsx` (copied from `apps/legal`)
- Modify: `apps/inbox/src/components/inbox-dashboard.tsx`

**Interfaces:**
- Consumes: `thread.category`, `thread.sentiment`, `thread.aiConfidence`, `thread.reasoning` (all
  already exist on `EmailThread`).
- Produces: the mounted `<Sheet>` in `inbox-dashboard.tsx`, extended by Task 8 with the KB-citation
  section (same file, same drawer, sequenced after so both tasks don't edit the drawer's JSX at
  the same time).

- [ ] **Step 1: Copy the two UI primitive files verbatim**

Read `apps/legal/src/components/ui/sheet.tsx` and `apps/legal/src/components/ui/dialog.tsx` in
full. Copy both files byte-for-byte into `apps/inbox/src/components/ui/sheet.tsx` and
`apps/inbox/src/components/ui/dialog.tsx`. Do not adapt class names or props speculatively — if
`apps/inbox`'s Tailwind config lacks a token the copied file references (check
`apps/inbox/tailwind.config.ts` / `globals.css` against what `apps/legal`'s equivalents define),
fix only that specific missing token, nothing else.

- [ ] **Step 2: Typecheck the copy in isolation**

Run: `cd apps/inbox && npx tsc --noEmit` — expect 0 errors from the two new files (unused-export
warnings are fine; they'll be consumed in Step 3).

- [ ] **Step 3: Read the current inline inspector panel**

Read `apps/inbox/src/components/inbox-dashboard.tsx` lines 700-860 (the "Active inspector" inline
panel, per the design spec's file reference) in full, to find the exact `selected`/`thread` state
variable name already in scope.

- [ ] **Step 4: Add the drawer trigger and content**

In `inbox-dashboard.tsx`, import the copied `Sheet`, `SheetTrigger`, `SheetContent` (or whatever
the copied file's actual exported component names are — confirmed by Step 1's read, don't assume
names not present in the copied file). Add a "Why this?" trigger button next to the existing
inline panel's header, and a `<SheetContent>` with three sections:

```tsx
<SheetContent>
  <div className="space-y-4 p-4">
    <div>
      <p className="text-xs uppercase text-outline">Classification</p>
      <p className="text-sm font-semibold">{categoryLabel(selected.category)} · {selected.sentiment}</p>
      <p className="text-xs text-outline">{Math.round(selected.aiConfidence)}% confidence</p>
    </div>
    <div>
      <p className="text-xs uppercase text-outline">Reasoning</p>
      <p className="text-sm">{selected.reasoning}</p>
    </div>
    {/* KB citations section added in Task 8 */}
  </div>
</SheetContent>
```

`categoryLabel` is already imported/used elsewhere in this file (from `@/lib/types`, per
`types.ts` line 128) — reuse it, don't reimplement.

- [ ] **Step 5: Typecheck**

Run: `cd apps/inbox && npx tsc --noEmit` — expect 0 errors.

- [ ] **Step 6: Manual verification**

Run: `cd apps/inbox && npm run dev`. Open `/`, select a thread, click "Why this?", confirm the
drawer slides in showing classification, confidence, and reasoning text without navigating away
from the inbox view. Stop the dev server.

- [ ] **Step 7: Commit**

```bash
git add apps/inbox/src/components/ui/sheet.tsx apps/inbox/src/components/ui/dialog.tsx apps/inbox/src/components/inbox-dashboard.tsx
git commit -m "feat(inbox): add reasoning drawer showing classification, confidence, and reasoning"
```

---

## Task 8: Knowledge-base citations in the reasoning drawer

**Files:**
- Create: `apps/inbox/kb/.gitkeep` (placeholder so the directory exists) and at least one sample
  `apps/inbox/kb/pricing-faq.md` for manual verification
- Create: `apps/inbox/src/lib/kb-store.ts`
- Modify: `apps/inbox/src/lib/types.ts` (add `kbHits?: CorpusHit[]`)
- Modify: `apps/inbox/src/lib/store.ts` (populate `kbHits` at classification time)
- Modify: `apps/inbox/src/components/inbox-dashboard.tsx` (render the citations section)

**Interfaces:**
- Consumes: `retrieveCorpusHits`, `chunkDocument`, `buildCorpusQuery`, `CorpusDocument`,
  `CorpusHit` from `@helix/core` (existing, `packages/helix-core/src/rfp/corpus.ts` — confirm the
  exact re-export path from `packages/helix-core/src/index.ts` before importing; if `corpus.ts`'s
  functions aren't re-exported from the package root today, add them to `index.ts`'s exports as
  part of this task rather than importing the RFP-specific subpath into Inbox).
- Produces: `EmailThread.kbHits?: CorpusHit[]`, rendered in Task 7's drawer (same file, sequenced
  after so both tasks don't collide on the drawer's JSX).

- [ ] **Step 1: Confirm the corpus engine's export path**

Read `packages/helix-core/src/index.ts` in full. If `chunkDocument`/`retrieveCorpusHits`/
`buildCorpusQuery`/`CorpusDocument`/`CorpusHit` are not already exported from it, add:

```ts
export { chunkDocument, retrieveCorpusHits, buildCorpusQuery } from "./rfp/corpus";
export type { CorpusDocument, CorpusChunk } from "./rfp/corpus";
export type { CorpusHit } from "./types";
```

(Confirm `CorpusHit`'s real source file — the design spec says it's defined in
`packages/helix-core/src/types.ts` lines 185-195 — adjust the export path if that's wrong.)

- [ ] **Step 2: Create the KB directory and one sample doc**

Create `apps/inbox/kb/pricing-faq.md`:

```markdown
# Pricing FAQ

Our enterprise plan starts at $999/month and includes unlimited seats, SSO, and a dedicated
account manager. The standard plan is $99/month per workspace, billed annually.

Refunds are available within 14 days of purchase for any plan tier.
```

Create an empty `apps/inbox/kb/.gitkeep` only if the directory would otherwise be empty in git
(it won't be, since `pricing-faq.md` is real content — skip `.gitkeep`, it's unnecessary here).

- [ ] **Step 3: Write `kb-store.ts`**

Create `apps/inbox/src/lib/kb-store.ts`:

```ts
import { readFileSync, readdirSync } from "fs";
import { join } from "path";
import {
  chunkDocument,
  retrieveCorpusHits,
  buildCorpusQuery,
  type CorpusDocument,
  type CorpusChunk,
  type CorpusHit,
} from "@helix/core";

const KB_DIR = join(process.cwd(), "kb");

let cachedChunks: CorpusChunk[] | null = null;

function loadKbDocuments(): CorpusDocument[] {
  const files = readdirSync(KB_DIR).filter((f) => f.endsWith(".md"));
  return files.map((file) => {
    const body = readFileSync(join(KB_DIR, file), "utf-8");
    const title = body.match(/^#\s+(.+)$/m)?.[1] ?? file;
    return { id: file, title, body, ingestedAt: new Date().toISOString() };
  });
}

function allKbChunks(): CorpusChunk[] {
  if (cachedChunks) return cachedChunks;
  cachedChunks = loadKbDocuments().flatMap((doc) => chunkDocument(doc));
  return cachedChunks;
}

export function queryInboxKb(input: { subject: string; body: string }, limit = 5): CorpusHit[] {
  const query = buildCorpusQuery({ title: input.subject, body: input.body });
  return retrieveCorpusHits(query, allKbChunks(), limit);
}
```

`process.cwd()` resolves to `apps/inbox` when the Next.js dev/prod server runs from that
directory (consistent with how the app's other filesystem-relative reads, if any, would resolve —
if this assumption is wrong for the deployed environment, e.g. Vercel's build changes `cwd`, flag
it in the report; this is a reasonable v1 assumption per the spec's "Markdown files are added/
edited directly in the repo" scope note, not a production-hardened path).

- [ ] **Step 4: Add `kbHits` to `EmailThread` and populate it**

In `apps/inbox/src/lib/types.ts`, add after `lastReplySentAt?: string;`:

```ts
  kbHits?: import("@helix/core").CorpusHit[];
```

(Or add a normal top-of-file import if the codebase's existing style avoids inline `import()`
types — check how other files in this codebase import types and match that style.)

In `apps/inbox/src/lib/store.ts`, inside `ingestMessage()` (the same block that already sets
`reasoning`/`aiConfidence` via `smartReplyWithContext`, lines 465-475), add:

```ts
import { queryInboxKb } from "./kb-store";

// ...inside the `if (mem.prefs.autoTriage)` block, alongside the existing `thread = {...}` update:
thread = {
  ...thread,
  draftReply: smart.draftReply || thread.draftReply,
  engine: smart.engine,
  aiConfidence: smart.confidence,
  reasoning: smart.reasoning ? `${thread.reasoning} · ${smart.reasoning}` : thread.reasoning,
  draftTone: mem.prefs.defaultTone,
  kbHits: queryInboxKb({ subject: input.subject, body: input.body }),
};
```

- [ ] **Step 5: Render the citations in the drawer**

In `apps/inbox/src/components/inbox-dashboard.tsx`, inside the `<SheetContent>` added in Task 7
Step 4, replace the `{/* KB citations section added in Task 8 */}` comment with:

```tsx
{selected.kbHits && selected.kbHits.length > 0 ? (
  <div>
    <p className="text-xs uppercase text-outline">Knowledge base</p>
    <ul className="space-y-2">
      {selected.kbHits.map((hit) => (
        <li key={hit.chunkId} className="rounded border border-outline-variant/30 p-2 text-sm">
          <p className="font-semibold">{hit.docTitle}</p>
          <p className="italic">"{hit.quote}"</p>
          <p className="text-xs text-outline">
            {hit.verified ? "Verified" : "Unverified"} · relevance {hit.score}
          </p>
        </li>
      ))}
    </ul>
  </div>
) : null}
```

Note the explicit "relevance" label on `hit.score` and the separate "% confidence" label already
used for `aiConfidence` in Task 7 — these must stay visually distinct per the spec's explicit
warning against conflating the two numbers.

- [ ] **Step 6: Typecheck**

Run: `cd apps/inbox && npx tsc --noEmit` — expect 0 errors.
Run: `cd packages/helix-core && npx tsc --noEmit` — expect 0 errors (if Step 1 changed `index.ts`).

- [ ] **Step 7: Manual verification**

Run: `cd apps/inbox && npm run dev`. Ingest a new thread whose body mentions "enterprise pricing"
(e.g. via the existing ingest form in `inbox-dashboard.tsx`, or `POST /api/messages` if that's the
real ingest endpoint — confirm which from earlier reads). Open its reasoning drawer, confirm the
"Knowledge base" section shows a citation quoting the `pricing-faq.md` sample doc with a
"Verified" badge. Stop the dev server.

- [ ] **Step 8: Commit**

```bash
git add packages/helix-core/src/index.ts apps/inbox/kb/pricing-faq.md apps/inbox/src/lib/kb-store.ts apps/inbox/src/lib/types.ts apps/inbox/src/lib/store.ts apps/inbox/src/components/inbox-dashboard.tsx
git commit -m "feat(inbox): add KB citation retrieval and render it in the reasoning drawer"
```

---

## Self-Review Notes (completed during plan authoring)

- **Spec coverage:** Feature A (followup queue) → Tasks 1-4. Feature B (reasoning drawer) →
  Tasks 7-8. Feature C (`.eml` ingest) → Tasks 5-6. All three spec sections have tasks; the spec's
  three open questions (KB file location, `mailparser`, migration convention) were resolved with
  David before this plan was written and are reflected in Global Constraints and Task 3/5/8.
- **Placeholder scan:** no TBD/TODO. Task 2 Step 4 and Task 4 Step 7 explicitly flag verification
  limits (live Gmail dependency, real-time business-day wait) as disclosed limitations, not hidden
  gaps — consistent with how Fase A of Leads handled hard-to-exercise branches.
- **Type consistency:** `MatchableThread`/`MatchableMessage` (Task 5) are deliberately narrower
  than `EmailThread`/`ThreadMessage` to avoid importing an app-local type into the shared package —
  Task 6 constructs them explicitly from real store data rather than passing `EmailThread` objects
  directly into `@helix/core`. `CorpusHit`/`CorpusDocument`/`CorpusChunk` names and fields (Task 8)
  match the existing `packages/helix-core/src/rfp/corpus.ts` definitions exactly — no renaming.
  `lastReplySentAt` is spelled identically across Tasks 2, 3, 4, and 6.
- **Sequencing:** Task 1 before Task 4 (business-day math before the queue that filters on it).
  Task 2 before Tasks 3, 4, 6 (field must exist before it's persisted, queried, or cleared). Task 5
  before Task 6 (parsing/matching logic before the route that calls it). Task 7 before Task 8 (the
  drawer shell exists before the KB section is added to it) — both explicitly note they touch the
  same file's JSX and must not run concurrently.
