# Helix for Leads — Fase B Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the "power-user triage" items from the roadmap in `apps/lead-scoring`: bulk actions +
hover preview (3.1), HITL-queue-first dashboard layout (3.6), fuller audit coverage (4.3), and
duplicate detection that requires human confirmation instead of silent auto-merge (5.2). Legacy
route redirects (P2) are a verification-only no-op per the spec.

**Architecture:** Reuse the already-proven bulk-select pattern (`Set<string>` + toggle functions)
from the orphaned `lead-dashboard.tsx` component, wired into the two live routes (`/leads`,
`/inbox`). Extend the existing client-side `buildEvents()` audit synthesizer with new branches
rather than building a server-side log. Change `finish-ingest.ts` to stop auto-merging duplicates
in `attachIntelligence` and instead save the new lead as a separate record with a corrected
`duplicateOf` pointer, adding a new merge endpoint the operator triggers explicitly.

**Tech Stack:** Next.js 15 (App Router), TypeScript, React client components, `@helix/core`
workspace package, existing Radix-based `tooltip.tsx` for hover preview.

## Global Constraints

- Do not modify `apps/commerce`, `apps/legal`, `apps/marketing`.
- Do not commit or push without explicit user confirmation (repo `CLAUDE.md` rule).
- Do not redesign the Leads UI beyond what's specified — this phase adds features, it doesn't
  restyle existing screens (per `apps/lead-scoring/CLAUDE.md`: "Do not redesign this UI except
  requested copy/ops").
- Lead `id` stays TEXT.
- No new UI libraries — hover preview uses the existing Radix/tooltip primitive already in the
  repo; bulk-select reuses the existing `Set<string>` pattern from `lead-dashboard.tsx`, not a new
  state-management library.
- `findDuplicate()`'s matching algorithm (email exact, phone digits ≥7, company+name exact) is
  NOT changed in this phase — only what happens *after* a match is found changes.
- Legacy routes (`/triage`, `/scoring`, `/automations`, `/integrations` without the `/settings/`
  prefix) do not exist as page files and have no broken links today (verified) — Task 6 below is
  verification-only, no code change, matching how LEADS-P1-3 was handled in Fase A.

---

## Task 1: Fix bulk `"ghl"` action to persist failure state

**Files:**
- Modify: `apps/lead-scoring/src/app/api/leads/bulk/route.ts`

**Interfaces:**
- Consumes: nothing from other tasks (independent, do first — smallest, lowest-risk task).
- Produces: nothing new consumed by other tasks — this is a standalone correctness fix that keeps
  bulk CRM pushes consistent with the individual-push fix from Fase A (`crmStatus: "failed"` +
  `crmError` persisted on real API failure, not just accumulated in the response's `errors[]`).

- [ ] **Step 1: Read the current `"ghl"` action branch**

Open `apps/lead-scoring/src/app/api/leads/bulk/route.ts` and find the `if (action === "ghl")`
block (loops over `ids`, calls `sendLeadToGhl`, branches on `result.mocked` vs `result.ok`).
Confirm the exact current shape before editing — the plan below describes the fix relative to
what Fase A's investigation found, but re-read the live file since bulk wasn't touched in Fase A.

- [ ] **Step 2: Persist `crmStatus: "failed"` + `crmError` on real API failure**

In the loop, the branch that runs when `result.mocked` is falsy and `result.ok` is also falsy
(a genuine GHL API failure, not just missing config) currently only does:

```ts
} else {
  errors.push({ id, error: result.error || "GHL send failed" });
}
```

Change it to also call `patchLead` before pushing to `errors`, mirroring the fix already applied
to the single-lead endpoint in `apps/lead-scoring/src/app/api/leads/[id]/crm/route.ts` (Fase A,
commit `cebf874`):

```ts
} else {
  await patchLead(id, { crmStatus: "failed", crmError: result.error || "GHL send failed" }, orgId);
  errors.push({ id, error: result.error || "GHL send failed" });
}
```

`patchLead` is already imported at the top of this file (`import { deleteLeads, getLead,
patchLead, patchLeads } from "@/lib/store";`) — no new import needed.

- [ ] **Step 3: Verify with curl against a running dev server**

Run: `cd apps/lead-scoring && npm run dev` (confirm port from terminal output, expected 43148).

With no `GHL_API_KEY`/`GHL_LOCATION_ID` configured, the "mocked" branch (not the one you just
changed) will fire for any real lead id — that's expected and unrelated to this fix. To exercise
the branch you changed, you need `result.ok === false` with `result.mocked === false`, which
requires GHL keys present but the API call itself failing (e.g. invalid key). If you don't have
real GHL credentials in this environment, verify by code reading only: confirm the `patchLead`
call is reachable in that branch and its arguments match the `[id]/crm/route.ts` pattern exactly
(same field names, same fallback message). Document in your report whether you exercised this at
runtime or by code review only.

Run: `cd apps/lead-scoring && npx tsc --noEmit` — expect 0 errors.

Stop the dev server if you started one.

- [ ] **Step 4: Commit**

```bash
git add apps/lead-scoring/src/app/api/leads/bulk/route.ts
git commit -m "fix(leads): bulk GHL push persists failure state like the single-lead endpoint"
```

---

## Task 2: Bulk selection UI in `/leads` and `/inbox`

**Files:**
- Modify: `apps/lead-scoring/src/app/leads/page.tsx`
- Modify: `apps/lead-scoring/src/app/inbox/page.tsx`

**Interfaces:**
- Consumes: `POST /api/leads/bulk` (existing, `{ids: string[], action: "delete"|"review"|"archive"|"ghl"}`
  → `{ok: boolean, leads?: StoredLead[], removed?: number, errors?: {id: string, error: string}[]}`).
  Task 1's fix means a bulk `"ghl"` failure now also updates `crmStatus`/`crmError` server-side.
- Produces: nothing new consumed by later tasks in this plan — Task 3 (hover preview) touches the
  same files but is independent enough to be a separate task/reviewer gate.

- [ ] **Step 1: Read the reference pattern in the orphaned component**

Read `apps/lead-scoring/src/components/lead-dashboard.tsx` lines 398-439 (the `bulk()`,
`toggleCheck()`, `toggleAllVisible()` functions) to see the exact reference implementation this
task ports into the two live pages. Do not import or resurrect that file — it stays dead code,
untouched. You're copying the *pattern*, not wiring the file in.

- [ ] **Step 2: Read `apps/lead-scoring/src/app/leads/page.tsx` in full**

This file was modified in Fase A (Task 3's `pushCrm()` fix, Task 4's refresh-event dispatches).
Read it completely before editing — the plan below describes the new state/handlers to add, but
you need to see the real component's existing `leads`/`setLeads`/`refresh` naming to slot them in
correctly.

- [ ] **Step 3: Add bulk-select state and handlers to `leads/page.tsx`**

Add near the component's existing state declarations:

```ts
const [checked, setChecked] = useState<Set<string>>(new Set());
```

Add handler functions (adapt exact variable names for `leads`/whatever list state the file
already uses — confirmed by your Step 2 read):

```ts
function toggleCheck(id: string) {
  setChecked((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    return next;
  });
}

function toggleAllVisible(visibleIds: string[]) {
  setChecked((prev) => {
    const allChecked = visibleIds.every((id) => prev.has(id));
    const next = new Set(prev);
    if (allChecked) {
      for (const id of visibleIds) next.delete(id);
    } else {
      for (const id of visibleIds) next.add(id);
    }
    return next;
  });
}

async function bulkAction(action: "delete" | "review" | "archive" | "ghl") {
  const ids = [...checked];
  if (ids.length === 0) return;
  const confirmed = window.confirm(
    action === "ghl"
      ? `Approve and push ${ids.length} lead(s) to CRM?`
      : action === "delete"
        ? `Delete ${ids.length} lead(s)? This cannot be undone.`
        : `${action === "archive" ? "Archive" : "Approve"} ${ids.length} lead(s)?`
  );
  if (!confirmed) return;
  const res = await fetch("/api/leads/bulk", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ids, action }),
  });
  const data = (await res.json()) as {
    ok?: boolean;
    leads?: StoredLead[];
    removed?: number;
    errors?: { id: string; error: string }[];
  };
  const okCount = action === "delete" ? (data.removed ?? 0) : (data.leads?.length ?? 0);
  const failCount = data.errors?.length ?? 0;
  setChecked(new Set());
  if (failCount > 0) {
    // Surface via whatever toast/error mechanism this file already uses — see Step 2's read.
    // Message shape: `${okCount} ok / ${failCount} failed`
  }
  window.dispatchEvent(new CustomEvent("helix:leads-refresh"));
}
```

The `window.confirm` is the minimal viable confirmation dialog for this task — the spec's
"confirmación N leads" criterion is satisfied by a native confirm, no custom modal component
needed. Replace the placeholder toast comment with a call to whatever success/error display
mechanism `leads/page.tsx` already has (it has one, from Fase A's error handling — use it, don't
invent a new one).

- [ ] **Step 4: Add checkboxes to the leads list rendering in `leads/page.tsx`**

In the JSX where the leads list/table renders each row, add a checkbox as the first cell/element
of each row:

```tsx
<input
  type="checkbox"
  checked={checked.has(lead.id)}
  onChange={() => toggleCheck(lead.id)}
  onClick={(e) => e.stopPropagation()}
  aria-label={`Select ${lead.name}`}
/>
```

`stopPropagation` prevents the checkbox click from also triggering whatever "select this lead to
view details" click handler the row already has.

Add a "select all visible" checkbox in the list header, wired to `toggleAllVisible` with the
current filtered/visible lead ids array.

- [ ] **Step 5: Add the bulk action bar**

Render a bar only when `checked.size > 0`, positioned above the list (or fixed at the bottom,
matching whatever existing toast/banner positioning convention the file uses):

```tsx
{checked.size > 0 ? (
  <div className="flex items-center gap-2 rounded-lg border border-outline-variant/40 bg-surface-container-high px-4 py-2 text-sm">
    <span>{checked.size} selected</span>
    <button type="button" onClick={() => void bulkAction("ghl")} className="rounded bg-primary-container px-3 py-1 text-xs font-semibold text-on-primary-container">
      Approve &amp; Push
    </button>
    <button type="button" onClick={() => void bulkAction("archive")} className="rounded bg-surface-container px-3 py-1 text-xs font-semibold">
      Archive
    </button>
    <button type="button" onClick={() => void bulkAction("delete")} className="rounded bg-error-container px-3 py-1 text-xs font-semibold text-error">
      Delete
    </button>
    <button type="button" onClick={() => setChecked(new Set())} className="ml-auto text-xs text-outline underline">
      Clear
    </button>
  </div>
) : null}
```

- [ ] **Step 6: Read `apps/lead-scoring/src/app/inbox/page.tsx` in full**

This file was modified heavily in Fase A (Tasks 3, 4, 6 — the CRM-first ordering, the refresh
event, the undo toast). Read it completely before editing. It already filters to
`needsReview === true` leads only, so "select all visible" here means "select all pending leads
currently rendered" — simpler than `leads/page.tsx` since there's no broader filter state to
account for.

- [ ] **Step 7: Add the same bulk-select pattern to `inbox/page.tsx`**

Apply the identical `checked`/`toggleCheck`/`toggleAllVisible` state and handlers from Step 3,
adapted to this file's own `leads`/`refresh` naming (confirmed by Step 6). Add checkboxes per
queue card (Step 4's pattern, adapted to the card layout instead of a table row) and the same
action bar (Step 5), but the actions available here should be `"ghl"` (maps to the existing
approve flow — but note: `bulk/route.ts`'s `"ghl"` action does NOT call `/review` after success,
only `/crm`. If you want bulk approve to also clear `needsReview` on success, you need a second
call: after `bulkAction("ghl")` succeeds for a given id, call `POST /api/leads/{id}/review` for
each successfully-pushed id, following the same CRM-then-review ordering contract Task 3 of Fase A
established. Add this as a follow-up loop inside `bulkAction` when `action === "ghl"`, using
`data.leads` from the bulk response to know which ids succeeded) and `"archive"`.

- [ ] **Step 8: Add bulk undo**

Reuse the existing single-lead undo mechanism already in `inbox/page.tsx`
(`startUndoWindow`/`undoApprove`/`undo` state from Fase A Task 6). Extend it to accept either a
single id or an array: change the `undo` state type from `{ id: string; secondsLeft: number } |
null` to `{ ids: string[]; secondsLeft: number } | null`, and update `startUndoWindow` to accept
`string[]`, `undoApprove` to loop `DELETE /api/leads/{id}/review` over all ids, and the toast text
to say `"Undo bulk approve (${ids.length} leads)"` when `ids.length > 1`, or the existing
single-lead text when `ids.length === 1`. Call `startUndoWindow([...successfulIds])` after a
successful bulk `"ghl"` + review-clear sequence from Step 7.

- [ ] **Step 9: Typecheck**

Run: `cd apps/lead-scoring && npx tsc --noEmit` — expect 0 errors.

- [ ] **Step 10: Manual verification**

Run: `cd apps/lead-scoring && npm run dev`. Open `/leads`, select 2+ leads via checkboxes, click
"Archive", confirm the browser confirm dialog, verify the leads' `pipelineStage` becomes `"lost"`
(check via `curl http://127.0.0.1:43148/api/leads` or the UI reflecting archived state). Open
`/inbox`, select pending leads, verify "select all visible" checks only the rendered queue.
Stop the dev server.

- [ ] **Step 11: Commit**

```bash
git add apps/lead-scoring/src/app/leads/page.tsx apps/lead-scoring/src/app/inbox/page.tsx
git commit -m "feat(leads): add bulk selection, confirm dialog, and bulk undo to /leads and /inbox"
```

---

## Task 3: Hover preview on the leads list

**Files:**
- Modify: `apps/lead-scoring/src/app/leads/page.tsx`
- Read (reference only, no changes): `apps/lead-scoring/src/components/ui/tooltip.tsx`

**Interfaces:**
- Consumes: nothing from Task 2 structurally, but touches the same file — sequenced after Task 2
  to avoid two implementers editing `leads/page.tsx` concurrently.
- Produces: nothing consumed by later tasks.

- [ ] **Step 1: Read the existing tooltip primitive**

Read `apps/lead-scoring/src/components/ui/tooltip.tsx` in full to see its exact exported
components (likely `Tooltip`, `TooltipTrigger`, `TooltipContent`, `TooltipProvider` — a shadcn/
Radix wrapper). Confirm the exact prop names and whether a `TooltipProvider` is already mounted
globally (check `apps/lead-scoring/src/app/layout.tsx` for a provider wrapping the app) before
deciding whether you need to add one locally.

- [ ] **Step 2: Wrap each lead row with the tooltip on hover**

In `leads/page.tsx`, where each row renders (same loop touched in Task 2 Step 4), wrap the row
(or a hoverable region within it — not the checkbox itself, so hovering the checkbox doesn't
trigger the preview) with the tooltip primitive found in Step 1. Content:

```tsx
<>
  <p className="font-semibold">{lead.name} · {lead.score}</p>
  <p className="text-xs text-outline">{lead.tier} · {lead.classification}</p>
  <p className="mt-1 text-xs line-clamp-2">{lead.message?.slice(0, 120)}</p>
</>
```

Use whichever delay/hover-trigger prop the found primitive exposes (Radix tooltips typically
default to a few hundred ms open delay — leave the library default, don't configure a custom one
unless the primitive requires it to function at all).

- [ ] **Step 3: Typecheck and manual verification**

Run: `cd apps/lead-scoring && npx tsc --noEmit` — expect 0 errors.

Run: `cd apps/lead-scoring && npm run dev`, open `/leads`, hover over a row (not the checkbox),
confirm the preview popover appears without navigating. Stop the dev server.

- [ ] **Step 4: Commit**

```bash
git add apps/lead-scoring/src/app/leads/page.tsx
git commit -m "feat(leads): add hover preview popover to the leads list"
```

---

## Task 4: HITL-queue-first dashboard layout

**Files:**
- Modify: `apps/lead-scoring/src/components/leads-engine/TriageOverview.tsx`

**Interfaces:**
- Consumes: `kpis.hitlPending` (already computed in this file, line 88:
  `leads.filter((l) => l.needsReview).length`).
- Produces: nothing consumed by other tasks.

- [ ] **Step 1: Check for an existing "load demo" action exposed to the UI**

Before building an empty-state CTA, check whether a demo-load action is already reachable from
the frontend. Search: `grep -rn "loadDemoCatalog\|load-demo\|clearDesk" apps/lead-scoring/src/app
apps/lead-scoring/src/components`. If you find an existing API route or button that triggers
`loadDemoCatalog()` (seen in `apps/lead-scoring/src/lib/store.ts` from earlier investigation),
reuse it. If nothing exposes it to the UI today, the empty-state CTA in Step 3 below should link
to `/settings` (where desk operations live, per Fase A's `DeskOpsForm` reference) instead of
inventing a new demo-load button — do not build a new demo-seeding UI path in this task, that's
out of scope.

- [ ] **Step 2: Restructure the layout to prioritize the queue when non-empty**

Replace the current fixed layout (lines 161-188 of the file as it exists after Fase A):

```tsx
{loading ? (
  <p className="text-sm text-outline">Loading triage…</p>
) : (
  <>
    <KpiStrip {...kpis} />
    <div className="grid gap-4 lg:grid-cols-5">
      <div className="lg:col-span-3">
        <StreamChart leads={leads} />
      </div>
      <div className="lg:col-span-2">
        <AttentionQueue
          leads={leads}
          busyId={busyId}
          onApprove={(id) => void approveAndPush(id)}
          onSpam={(id) => void markSpam(id)}
        />
      </div>
    </div>
    <div className="grid gap-4 lg:grid-cols-5">
      <div className="lg:col-span-3">
        <PriorityTable leads={leads} />
      </div>
      <div className="lg:col-span-2">
        <WebhookFeed leads={leads} logs={logs} />
      </div>
    </div>
  </>
)}
```

with:

```tsx
{loading ? (
  <p className="text-sm text-outline">Loading triage…</p>
) : (
  <>
    {kpis.hitlPending > 0 ? (
      <AttentionQueue
        leads={leads}
        busyId={busyId}
        onApprove={(id) => void approveAndPush(id)}
        onSpam={(id) => void markSpam(id)}
      />
    ) : (
      <div className="rounded-xl border border-outline-variant/25 bg-surface-container px-5 py-8 text-center">
        <p className="text-sm font-semibold text-on-surface">No leads pending review</p>
        <p className="mt-1 text-xs text-on-surface-variant">
          The HITL queue is clear. Ingest a lead or check{" "}
          <a href="/settings" className="text-primary underline">Desk Settings</a> to load demo
          data.
        </p>
      </div>
    )}
    <KpiStrip {...kpis} />
    <div className="grid gap-4 lg:grid-cols-5">
      <div className="lg:col-span-3">
        <StreamChart leads={leads} />
      </div>
      <div className="lg:col-span-2">
        <AttentionQueue
          leads={leads}
          busyId={busyId}
          onApprove={(id) => void approveAndPush(id)}
          onSpam={(id) => void markSpam(id)}
        />
      </div>
    </div>
    <div className="grid gap-4 lg:grid-cols-5">
      <div className="lg:col-span-3">
        <PriorityTable leads={leads} />
      </div>
      <div className="lg:col-span-2">
        <WebhookFeed leads={leads} logs={logs} />
      </div>
    </div>
  </>
)}
```

Note this renders `<AttentionQueue>` twice when `hitlPending > 0` (once full-width at the top,
once in its original grid slot below) — that duplicates the queue on screen, which is wrong.
Fix: when `hitlPending > 0`, remove `<AttentionQueue>` from its original grid slot (leave only
`StreamChart` in that row, full width or adjusted colspan), since it's now shown once at the top.
When `hitlPending === 0`, the grid's second column has nothing to show either (queue is empty) —
in that case keep `StreamChart` alone in that row too, matching the same colspan adjustment,
since the empty state already communicates "queue clear" above. The corrected structure:

```tsx
{loading ? (
  <p className="text-sm text-outline">Loading triage…</p>
) : (
  <>
    {kpis.hitlPending > 0 ? (
      <AttentionQueue
        leads={leads}
        busyId={busyId}
        onApprove={(id) => void approveAndPush(id)}
        onSpam={(id) => void markSpam(id)}
      />
    ) : (
      <div className="rounded-xl border border-outline-variant/25 bg-surface-container px-5 py-8 text-center">
        <p className="text-sm font-semibold text-on-surface">No leads pending review</p>
        <p className="mt-1 text-xs text-on-surface-variant">
          The HITL queue is clear. Ingest a lead or check{" "}
          <a href="/settings" className="text-primary underline">Desk Settings</a> to load demo
          data.
        </p>
      </div>
    )}
    <KpiStrip {...kpis} />
    <StreamChart leads={leads} />
    <div className="grid gap-4 lg:grid-cols-5">
      <div className="lg:col-span-3">
        <PriorityTable leads={leads} />
      </div>
      <div className="lg:col-span-2">
        <WebhookFeed leads={leads} logs={logs} />
      </div>
    </div>
  </>
)}
```

This drops the 3/2 grid wrapper around `StreamChart` (it now renders full-width on its own), and
`AttentionQueue` appears exactly once, prioritized above the KPI strip when there's pending work.

- [ ] **Step 3: Typecheck**

Run: `cd apps/lead-scoring && npx tsc --noEmit` — expect 0 errors.

- [ ] **Step 4: Manual verification for both states**

Run: `cd apps/lead-scoring && npm run dev`. With the seeded demo data (Ava pending by default),
open `/` and confirm the queue renders full-width above the KPI strip. Then approve/archive that
lead (or use `/api/leads/clearDesk`-equivalent if exposed, or manually patch via API) to reach
`hitlPending === 0`, reload `/`, confirm the empty state renders instead. Stop the dev server.

- [ ] **Step 5: Commit**

```bash
git add apps/lead-scoring/src/components/leads-engine/TriageOverview.tsx
git commit -m "feat(leads): prioritize the HITL queue above KPIs on the dashboard (3.6)"
```

---

## Task 5: Fix duplicate-merge bug and switch to confirm-before-merge

**Files:**
- Modify: `packages/helix-core/src/lead/intelligence.ts`
- Modify: `apps/lead-scoring/src/lib/finish-ingest.ts`
- Create: `apps/lead-scoring/src/app/api/leads/[id]/merge/route.ts`
- Test: `packages/helix-core/src/lead/ingest.test.ts` (existing file — extend, don't replace)

**Interfaces:**
- Consumes: `findDuplicate()` (existing, unchanged signature, `packages/helix-core/src/lead/
  intelligence.ts:101`).
- Produces: `POST /api/leads/[id]/merge` with body `{ intoId: string }` — merges the lead at `id`
  into the lead at `intoId` using the same score-averaging logic `attachIntelligence` already has,
  then archives/removes the losing (`id`) record. Later UI work (banner + compare view, not part
  of this plan's tasks — see note below) will call this endpoint.

**Note on scope:** this task fixes the backend bug (auto-merge, wrong `duplicateOf` pointer) and
exposes the manual-merge endpoint. The banner + side-by-side comparison UI described in the spec
section 4 is a reasonable follow-up but is NOT included as a task here — flag this explicitly in
your task report so the controller can decide whether to add a Task 5b for the UI, since the spec
describes it as part of 5.2 but this plan scopes the bite-sized backend piece first.

- [ ] **Step 1: Write the failing test for the corrected `duplicateOf` behavior**

Read `packages/helix-core/src/lead/ingest.test.ts` first to see its existing test structure and
imports (likely tests `parseLeadIngest`/`parseGhlWebhook` from `pipeline.ts` — confirm which
functions it currently covers before adding to it). Add a new test:

```ts
import { attachIntelligence } from "./intelligence";
import type { StoredLead } from "../types";

describe("attachIntelligence — duplicate handling", () => {
  it("does not merge automatically; caller must decide", () => {
    const existing: StoredLead = {
      id: "lead-existing",
      classification: "lead",
      score: 60,
      tier: "warm",
      confidence: 0.7,
      reasoning: "",
      fields: [],
      needsReview: false,
      engine: "heuristic",
      name: "Jane Doe",
      email: "jane@acme.com",
      source: "web",
      message: "",
      createdAt: "2026-01-01T00:00:00.000Z",
      runId: "run-1",
      crmStatus: "not_sent",
    };
    const fresh: StoredLead = {
      ...existing,
      id: "lead-fresh",
      score: 80,
      createdAt: "2026-01-02T00:00:00.000Z",
      runId: "run-2",
    };
    // attachIntelligence(fresh, null, [existing]) — passing null for existing means
    // "treat as a new, independent lead" even though a duplicate was found upstream;
    // the caller (finish-ingest.ts) is responsible for deciding whether to pass existing
    // or null based on the new no-auto-merge policy.
    const result = attachIntelligence(fresh, null, [existing]);
    expect(result.id).toBe("lead-fresh");
    expect(result.score).toBe(80);
  });
});
```

This test documents the new *contract*: `attachIntelligence` itself is unchanged (still merges
when given a non-null `existing`) — what changes is that `finish-ingest.ts` stops always passing
the found duplicate as `existing`. The real behavior change is Step 3 below; this test just locks
in that `attachIntelligence(fresh, null, ...)` behaves as a normal new-lead path, which it already
does today (see the `if (!existing)` branch, line 385) — so this test should PASS immediately
without any change to `intelligence.ts` itself. Run it to confirm.

- [ ] **Step 2: Run the test to confirm it passes as-is**

Run: `cd packages/helix-core && npx vitest run src/lead/ingest.test.ts`
Expected: PASS (this test exercises existing, unchanged behavior — it's here to document and
guard the contract before you change the caller in Step 3).

- [ ] **Step 3: Change `finish-ingest.ts` to stop auto-merging**

Open `apps/lead-scoring/src/lib/finish-ingest.ts`. Current code (lines 23-46):

```ts
const existing = findDuplicate(await listLeads(orgId), parsed);
if (existing) {
  emit({ /* ...warn log... */ });
}
const brain = getBrain();
const scored = await runLeadPipeline(parsed, emit, { hitl: brain.hitl, addendum: brain.addendum, thresholds: brain.thresholds });
bumpUsage(isClaudeConfigured() ? "claude" : "heuristic");
const all = await listLeads(orgId);
const lead = applyBrainPolicies(attachIntelligence(scored, existing, all), brain);
```

Change the `attachIntelligence` call to always pass `null` for `existing` (stop auto-merging),
and instead set `duplicateOf` explicitly on the result when a duplicate was found:

```ts
const existing = findDuplicate(await listLeads(orgId), parsed);
if (existing) {
  emit({
    type: "log",
    log: {
      id: `log-dedup-${Date.now()}`,
      ts: new Date().toISOString(),
      agent: "orchestrator",
      level: "warn",
      message: `Possible duplicate of ${existing.id} — saved as a separate lead pending manual merge.`,
      field: "email",
      evidence: existing.email,
    },
  });
}
const brain = getBrain();
const scored = await runLeadPipeline(parsed, emit, { hitl: brain.hitl, addendum: brain.addendum, thresholds: brain.thresholds });
bumpUsage(isClaudeConfigured() ? "claude" : "heuristic");
const all = await listLeads(orgId);
const lead = applyBrainPolicies(attachIntelligence(scored, null, all), brain);
if (existing) {
  lead.duplicateOf = existing.id;
}
```

This is the core behavior change: `attachIntelligence(scored, null, all)` now always takes the
"new independent lead" branch (line 385 of `intelligence.ts`, unchanged), giving the fresh lead
its own new `id` from the pipeline — never `existing.id`. The `duplicateOf = existing.id` line
runs after, correctly pointing at the *other*, pre-existing lead's real id — fixing the
self-reference bug (previously, the merged record's `id` became `existing.id`, so `duplicateOf:
existing.id` pointed at itself).

Remove the now-dead `if (existing?.ghlContactId) { await addGhlReingestNote(...) }` block at the
bottom of the function (lines ~80-82) — it only made sense when re-ingest updated the *existing*
CRM-linked lead in place; now the fresh lead is a separate record with no `ghlContactId` of its
own, so this note would go to the wrong (unrelated, pre-existing) GHL contact. Confirm by reading
the full function body before removing — if `addGhlReingestNote` is still meaningfully used
elsewhere (grep it across the app), leave the function/import alone; only remove this specific
call site.

- [ ] **Step 4: Add the merge endpoint**

Create `apps/lead-scoring/src/app/api/leads/[id]/merge/route.ts`:

```ts
import { getLead, patchLead, deleteLeads } from "@/lib/store";
import { attachIntelligence } from "@helix/core";
import { operatorActor, requireOperator } from "@helix/core/operator";
import { withOrgScope } from "@/lib/org-auth";

export const runtime = "nodejs";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = requireOperator(req);
  if (denied) return denied;
  const { id } = await params;
  let body: { intoId?: string } = {};
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const intoId = body.intoId;
  if (!intoId) return Response.json({ error: "intoId required" }, { status: 400 });

  return withOrgScope(async (orgId) => {
    const losing = await getLead(id, orgId);
    const winning = await getLead(intoId, orgId);
    if (!losing || !winning) {
      return Response.json({ error: "Lead not found" }, { status: 404 });
    }
    const merged = attachIntelligence(losing, winning, []);
    const saved = await patchLead(intoId, merged, orgId);
    await deleteLeads([id]);
    return Response.json({ lead: saved, mergedFromId: id });
  });
}
```

`attachIntelligence(losing, winning, [])` treats `losing` as the "fresh" input and `winning` as
`existing` — this reuses the exact score-averaging/field-merging logic already in
`intelligence.ts`'s non-null branch (lines 430-468), producing a merged record with `id:
winning.id` (per that branch's `id: existing.id` line). The empty array `[]` for `all` is safe
here because that parameter is only used for `routeLead`'s territory/rep assignment logic, which
recomputes routing among *other* leads — passing `[]` means it won't find a better-fit rep than
what's already assigned, which is acceptable for a merge operation (routing was already decided
for the winning lead).

- [ ] **Step 5: Typecheck both packages**

Run: `cd packages/helix-core && npx tsc --noEmit` — expect 0 errors.
Run: `cd apps/lead-scoring && npx tsc --noEmit` — expect 0 errors.

- [ ] **Step 6: Run the full helix-core test suite**

Run: `cd packages/helix-core && npx vitest run`
Expected: PASS, all tests including the new one from Step 1.

- [ ] **Step 7: Manual verification of the new duplicate flow**

Run: `cd apps/lead-scoring && npm run dev`. Ingest a lead with an email matching an existing
seeded lead's email (e.g. re-ingest `maya@northwindhvac.com` via `POST /api/leads/ingest` with a
slightly different message). Confirm via `GET /api/leads` that TWO separate leads now exist with
that email (previously there would have been one, silently updated) — the new one should have
`duplicateOf` set to the *original* seeded lead's id (not its own id). Then call `POST /api/leads/
{newId}/merge` with `{"intoId": "{originalId}"}` and confirm via a follow-up `GET /api/leads` that
the new lead is gone and the original lead's score reflects the averaged value. Stop the dev
server.

- [ ] **Step 8: Commit**

```bash
git add packages/helix-core/src/lead/ingest.test.ts apps/lead-scoring/src/lib/finish-ingest.ts apps/lead-scoring/src/app/api/leads/[id]/merge/route.ts
git commit -m "fix(leads): stop auto-merging duplicates on re-ingest; add explicit merge endpoint (5.2)"
```

---

## Task 6: Audit log — new event branches

**Files:**
- Modify: `apps/lead-scoring/src/app/audit/page.tsx`
- Modify: `apps/lead-scoring/src/app/api/leads/[id]/score/route.ts`

**Interfaces:**
- Consumes: `lead.duplicateOf` (now correctly pointing at a distinct other lead's id, per Task 5).
  This task should run AFTER Task 5, since it reads the `duplicateOf` field Task 5's fix corrects
  — if Task 5 isn't done yet, the `DUPLICATE_DETECTED` branch below would fire on the old buggy
  self-referencing data and need rework.
- Produces: nothing consumed by other tasks — this is the last content task before the legacy-
  route verification.

- [ ] **Step 1: Read `buildEvents()` in full**

Open `apps/lead-scoring/src/app/audit/page.tsx` and read the complete `buildEvents(leads:
StoredLead[])` function (per Fase A's investigation, spans roughly lines 47-227 after Fase A's own
`CRM_SYNC_FAILED` branch was added). Confirm the exact `AuditEvent` type shape (fields like `id`,
`at`, `kind`, `severity`, `actor`, `actorSub`, `target`, `targetSub`, `hash`, `signed`, `title`,
`prev`, `next`, `raw`) by reading an existing branch (e.g. the `CRM_SYNC` branch) so your new
branches match the shape exactly — do not invent new fields on the type.

- [ ] **Step 2: Add the `PIPELINE_ARCHIVED` branch**

Inside the `for (const lead of leads)` loop, add (using the same `shortHash`/`formatParts` helpers
already defined earlier in the file — confirm their exact names from your Step 1 read):

```ts
if (lead.pipelineStage === "lost" && lead.classification !== "spam") {
  const at = lead.reviewedAt ?? lead.createdAt;
  const parts = formatParts(at);
  events.push({
    id: `archived-${lead.id}`,
    at,
    ...parts,
    kind: "PIPELINE_ARCHIVED",
    severity: "INFO",
    actor: lead.reviewedBy ?? "Operator",
    actorSub: "manual archive",
    target: `Lead #${baseId}`,
    targetSub: `${lead.name} · archived`,
    hash: shortHash(`archived:${lead.id}`),
    signed: true,
    title: "Lead archived",
    prev: { pipelineStage: "new" },
    next: { pipelineStage: "lost" },
    raw: {
      event_type: "PIPELINE_ARCHIVED",
      lead_id: lead.id,
      name: lead.name,
    },
  });
}
```

(`baseId` is the same `lead.id.replace(/^seed-/, "LD-").slice(0, 14)` variable already computed
once per lead near the top of the loop — reuse it, don't recompute.)

- [ ] **Step 3: Add the `PIPELINE_STAGE_CHANGE` branch**

```ts
if (["contacted", "qualified", "won"].includes(lead.pipelineStage ?? "")) {
  const at = lead.reviewedAt ?? lead.createdAt;
  const parts = formatParts(at);
  events.push({
    id: `stage-${lead.id}-${lead.pipelineStage}`,
    at,
    ...parts,
    kind: "PIPELINE_STAGE_CHANGE",
    severity: "INFO",
    actor: lead.reviewedBy ?? "Operator",
    actorSub: `stage → ${lead.pipelineStage}`,
    target: `Lead #${baseId}`,
    targetSub: `${lead.name} · ${lead.pipelineStage}`,
    hash: shortHash(`stage:${lead.id}:${lead.pipelineStage}`),
    signed: true,
    title: "Pipeline stage changed",
    prev: { pipelineStage: "new" },
    next: { pipelineStage: lead.pipelineStage },
    raw: {
      event_type: "PIPELINE_STAGE_CHANGE",
      lead_id: lead.id,
      name: lead.name,
      pipelineStage: lead.pipelineStage,
    },
  });
}
```

- [ ] **Step 4: Add the `DUPLICATE_DETECTED` branch**

```ts
if (lead.duplicateOf && lead.duplicateOf !== lead.id) {
  const parts = formatParts(lead.createdAt);
  events.push({
    id: `dup-${lead.id}`,
    at: lead.createdAt,
    ...parts,
    kind: "DUPLICATE_DETECTED",
    severity: "WARNING",
    actor: "Helix Core",
    actorSub: "dedup check",
    target: `Lead #${baseId}`,
    targetSub: `${lead.name} · possible duplicate of ${lead.duplicateOf.replace(/^seed-/, "LD-").slice(0, 14)}`,
    hash: shortHash(`dup:${lead.id}:${lead.duplicateOf}`),
    signed: true,
    title: "Possible duplicate detected",
    prev: {},
    next: { duplicateOf: lead.duplicateOf },
    raw: {
      event_type: "DUPLICATE_DETECTED",
      lead_id: lead.id,
      duplicate_of: lead.duplicateOf,
    },
  });
}
```

The `lead.duplicateOf !== lead.id` guard is a defensive leftover from the pre-Task-5 bug — with
Task 5's fix this condition should always be true when `duplicateOf` is set, but keeping the guard
costs nothing and protects against any data seeded before this fix shipped (e.g. the demo seed
data, if it ever sets `duplicateOf` to self — check `apps/lead-scoring/src/lib/store.ts`'s seed
data for this before assuming it doesn't apply).

- [ ] **Step 5: Differentiate manual rescore from pipeline scoring**

Open `apps/lead-scoring/src/app/api/leads/[id]/score/route.ts`. In the `wantsPipeline` branch
(calls `finishLeadIngest`), the resulting lead's `scoreHistory` gets whatever reason
`runLeadPipeline`/`attachIntelligence` already assign (`"Initial form submission"` for new leads,
per `intelligence.ts` line 405) — but this endpoint is reached from a manual "Test Rule Set" /
"rescore" action, not real ingestion. Add a marker after the `finishLeadIngest` call, before
returning:

```ts
if (wantsPipeline) {
  const input: LeadIngestInput = { /* ...unchanged... */ };
  const emit: LeadEmit = () => undefined;
  try {
    const lead = await finishLeadIngest(input, emit, orgId);
    // Mark the most recent scoreHistory entry as a manual rescore, not a fresh pipeline run,
    // so the audit view can distinguish operator-triggered rescoring from real ingestion.
    if (lead.scoreHistory && lead.scoreHistory.length > 0) {
      const history = [...lead.scoreHistory];
      const last = history[history.length - 1];
      history[history.length - 1] = { ...last, reason: `Manual rescore — ${last.reason}` };
      await patchLead(lead.id, { scoreHistory: history }, orgId);
      lead.scoreHistory = history;
    }
    return Response.json({ lead, mode: "pipeline" });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return Response.json({ error: message }, { status: 502 });
  }
}
```

Note: per Task 5's fix, `finishLeadIngest` now creates a NEW lead when the input matches an
existing one (duplicate detection fires on the same email) — since this rescore endpoint re-sends
the *same* lead's own email/data through the pipeline, `findDuplicate` will match the lead against
*itself* (the current lead already in the store), producing a **new, separate lead** with
`duplicateOf` pointing at the original — not an in-place rescore of the original at all. This is a
behavior change from before Task 5 (previously it silently updated the same lead in place). Flag
this explicitly in your task report: the "Test Rule Set"/"Simulate on roster leads" feature in
`settings/scoring/page.tsx` (which calls this endpoint) will now create duplicate leads every time
it's used, which is a new, real problem introduced by combining Task 5's fix with this endpoint's
existing behavior. Do NOT silently work around this — report it as a finding for the controller
to decide whether `settings/scoring/page.tsx`'s "Test Rule Set" should call a different, always-
in-place rescore path instead of `finishLeadIngest`. A minimal safe option you may implement if
told to: add an `orgId`-scoped call to `patchLead` directly with just `{score, tier, scoreHistory}`
computed via `scoreLeadHeuristic` (bypassing `finishLeadIngest`/`findDuplicate` entirely for this
specific "rescore my own existing lead" case) — but do not implement this without asking, since it
changes what "Test Rule Set" actually simulates. For this task, implement only the `reason`-
tagging change shown above, verify the duplicate-creation side effect via manual testing (Step 7),
and report it clearly.

- [ ] **Step 6: Typecheck**

Run: `cd apps/lead-scoring && npx tsc --noEmit` — expect 0 errors.

- [ ] **Step 7: Manual verification**

Run: `cd apps/lead-scoring && npm run dev`. Archive a lead via `POST /api/leads/{id}/archive`,
change another's stage via `POST /api/leads/{id}/stage` with `{"pipelineStage": "contacted"}`,
and re-ingest a duplicate-triggering lead as in Task 5 Step 7. Load `/audit` and confirm three new
kinds of entries appear: `PIPELINE_ARCHIVED`, `PIPELINE_STAGE_CHANGE`, `DUPLICATE_DETECTED`. Then
use `settings/scoring/page.tsx`'s "Test Rule Set" button (or call the score endpoint with
`{"mode":"pipeline"}` directly) and confirm — per Step 5's note — whether it creates a duplicate
lead; document exactly what you observe in your report. Stop the dev server.

- [ ] **Step 8: Commit**

```bash
git add apps/lead-scoring/src/app/audit/page.tsx apps/lead-scoring/src/app/api/leads/[id]/score/route.ts
git commit -m "feat(leads): add archive, stage-change, and duplicate-detected audit events (4.3)"
```

---

## Task 7: Verify legacy routes (no code change)

**Files:**
- None modified — verification only.

**Interfaces:**
- Consumes: nothing.
- Produces: nothing.

- [ ] **Step 1: Confirm no legacy route files exist**

Run: `find apps/lead-scoring/src/app -maxdepth 1 -type d \( -name triage -o -name scoring -o -name automations -o -name integrations \)`
Expected: empty output (no matches) — these should only exist under `settings/`.

- [ ] **Step 2: Confirm no links reference the legacy paths**

Run: `grep -rn '"/triage"\|"/scoring"\|"/automations"\|"/integrations"' apps/lead-scoring/src --include="*.tsx" --include="*.ts"`
Expected: zero matches, or matches only for the correct `/settings/scoring`, `/settings/
automations`, `/settings/integrations` paths (grep on the exact quoted strings without `/settings`
prefix should not match those).

- [ ] **Step 3: Start the dev server and directly hit each legacy path**

Run: `cd apps/lead-scoring && npm run dev`, then:

```bash
curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:43148/triage
curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:43148/scoring
curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:43148/automations
curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:43148/integrations
```

Expected: all four return `404` (confirming they genuinely don't exist — this is expected and
correct per the spec; the roadmap item is about there being no *live links* pointing at 404s, not
about the bare paths resolving to something). Document the actual codes returned in your report.
Stop the dev server.

- [ ] **Step 4: No commit needed**

This task makes no code changes. Record the verification result in the plan's completion ledger
(handled by the SDD process, not a git commit).

---

## Self-Review Notes (completed during plan authoring)

- **Spec coverage:** 3.1 → Tasks 1-3. 3.6 → Task 4. 4.3 → Task 6. 5.2 → Task 5 (backend only —
  banner/compare UI explicitly flagged as a follow-up, not silently dropped). P2 legacy routes →
  Task 7. All five spec sections have a task; the one partial gap (5.2's UI half) is called out
  explicitly in Task 5's note rather than left implicit.
- **Placeholder scan:** no TBD/TODO. Task 6 Step 5 intentionally asks the implementer to report a
  finding rather than silently fix a design tension the plan surfaced during authoring (the
  interaction between Task 5's dedup fix and the existing manual-rescore endpoint) — this is a
  deliberate escalation instruction, not a missing design.
- **Type consistency:** `checked: Set<string>` and its handler names (`toggleCheck`,
  `toggleAllVisible`, `bulkAction`) are used identically across Task 2's two files. The `undo`
  state shape change (`{ id }` → `{ ids: [] }`) in Task 2 Step 8 is scoped to `inbox/page.tsx`
  only, consistent with where Fase A's original undo toast lives — no other task reads that
  state shape. `AuditEvent` fields in Task 6 match the shape already established by Fase A's
  `CRM_SYNC_FAILED` branch (same file), not a new shape.
