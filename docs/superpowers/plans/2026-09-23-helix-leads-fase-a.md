# Helix for Leads — Fase A Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the HITL/CRM state desync bug (LEADS-P0-1), unify score thresholds across
Scoring/Automations/the scoring engine (LEADS-P1-1 + F-2), fix the "1 CRM live" hardcoded copy
(LEADS-P1-2), verify `/settings` (LEADS-P1-3), and add an undo toast for Approve & Push (3.3) in
Helix for Leads (`apps/lead-scoring`), per
`docs/superpowers/specs/2026-09-23-helix-leads-fase-a-design.md`.

**Architecture:** Extend `BrainSettings` (the existing single-source-of-truth config object in
`src/lib/brain.ts`) with a `thresholds` object; thread it through the scoring engine
(`scoreLeadHeuristic`, `normalizeClaude`) and the Settings UI so score bands are defined once.
Fix the approve-then-push race by reordering the two existing HTTP calls (CRM push first, then
review) in the four frontend call sites, and give CRM failures a real `crmStatus` value instead
of silently dropping them. Wire the existing `helix:leads-refresh` event into the surfaces that
don't yet listen for it.

**Tech Stack:** Next.js 15 (App Router), TypeScript, Vitest, React (client components,
`"use client"`), monorepo workspace package `@helix/core`.

## Global Constraints

- Do not modify `apps/commerce`, `apps/legal`, `apps/marketing`, or any file already listed as
  modified/untracked in `git status` before this plan started, unless a task explicitly says so.
- Do not commit or push without explicit user confirmation (repo `CLAUDE.md` rule).
- Money format `$85,000` (never `$85k`); dates ISO `2026-09-18` — only relevant if any new UI
  copy touches these (it doesn't in this phase, but keep it in mind for the undo toast copy).
- Lead `id` stays TEXT — never change `StoredLead.id` type.
- Do not redesign the Leads UI beyond what's specified — copy/logic fixes only, no restyling.
- `CrmStatus` today is `"not_sent" | "mocked" | "sent"` — extending it, not replacing it.
- The heuristic HITL band test (`packages/helix-core/src/lead/heuristic.test.ts:32-43`) currently
  hardcodes the 40-60 score band via un-parameterized calls to `scoreLeadHeuristic`; Task 1 must
  keep default behavior identical (default thresholds reproduce today's 40-60 / 80 / 50 numbers)
  so this test's assertions do not need their expected values changed — only, if needed, way the
  function is invoked.

---

## Task 1: Add `thresholds` to `BrainSettings` and thread through the scoring engine

**Files:**
- Modify: `packages/helix-core/src/lead/heuristic.ts`
- Modify: `packages/helix-core/src/lead/pipeline.ts`
- Modify: `apps/lead-scoring/src/lib/brain.ts`
- Modify: `apps/lead-scoring/src/lib/finish-ingest.ts`
- Test: `packages/helix-core/src/lead/heuristic.test.ts`

**Interfaces:**
- Produces: `export type ScoreThresholds = { autoQualifyScore: number; dqScore: number; vipScore: number; nurtureMin: number; nurtureMax: number }` in `packages/helix-core/src/lead/heuristic.ts`, re-exported from `packages/helix-core/src/index.ts`.
- Produces: `scoreLeadHeuristic(input: LeadIngestInput, opts?: { hitl?: number; thresholds?: ScoreThresholds }): LeadScoreResult` (extends existing signature, `thresholds` optional with defaults matching today's hardcoded 40/60/80/50).
- Produces: `runLeadPipeline(input, emit, opts?: { hitl?: number; addendum?: string; thresholds?: ScoreThresholds })` (extends existing signature).
- Produces: `BrainSettings.thresholds: ScoreThresholds` in `apps/lead-scoring/src/lib/brain.ts`, default `{ autoQualifyScore: 80, dqScore: 50, vipScore: 90, nurtureMin: 30, nurtureMax: 65 }`.
- Consumes: nothing from other tasks (this is the foundation task).

- [ ] **Step 1: Write the failing test for parameterized thresholds in the heuristic**

Add to `packages/helix-core/src/lead/heuristic.test.ts` (append inside the existing `describe("lead heuristic", ...)` block, after the last `it(...)`):

```ts
  it("uses custom thresholds instead of the hardcoded 40-60 band", () => {
    const scored = scoreLeadHeuristic(
      {
        name: "Ava",
        email: "ava@example.org",
        source: "website",
        message: "Just looking at how the scoring works before we talk.",
      },
      { thresholds: { autoQualifyScore: 80, dqScore: 45, vipScore: 90, nurtureMin: 30, nurtureMax: 65 } }
    );
    // Same input as the existing "flags thin mid scores" test, but with dqScore raised to 45:
    // a lead scoring in the low-40s should now fall UNDER the DQ threshold and not need review.
    expect(scored.score).toBeLessThan(46);
    expect(scored.needsReview).toBe(false);
  });

  it("defaults reproduce today's behavior when no thresholds are passed", () => {
    const scored = scoreLeadHeuristic({
      name: "Ava",
      email: "ava@example.org",
      source: "website",
      message: "Just looking at how the scoring works before we talk.",
    });
    expect(scored.needsReview).toBe(true);
    expect(scored.score).toBeGreaterThanOrEqual(40);
    expect(scored.score).toBeLessThanOrEqual(60);
  });
```

- [ ] **Step 2: Run tests to verify the new ones fail**

Run: `cd packages/helix-core && npx vitest run src/lead/heuristic.test.ts`
Expected: FAIL — `scoreLeadHeuristic` does not accept a `thresholds` option yet, so the first
new test's `needsReview` assertion fails (still uses the hardcoded 40-60 band). The second new
test should already pass (it's a restatement of existing behavior) — confirms no regression risk
before the change.

- [ ] **Step 3: Add `ScoreThresholds` type and thread it through `scoreLeadHeuristic`**

In `packages/helix-core/src/lead/heuristic.ts`, add near the top (after the existing imports,
before `SPAM_RE`):

```ts
export type ScoreThresholds = {
  autoQualifyScore: number;
  dqScore: number;
  vipScore: number;
  nurtureMin: number;
  nurtureMax: number;
};

const DEFAULT_THRESHOLDS: ScoreThresholds = {
  autoQualifyScore: 80,
  dqScore: 50,
  vipScore: 90,
  nurtureMin: 30,
  nurtureMax: 65,
};
```

Change the `scoreLeadHeuristic` signature (currently `opts?: { hitl?: number }`) to:

```ts
export function scoreLeadHeuristic(
  input: LeadIngestInput,
  opts?: { hitl?: number; thresholds?: ScoreThresholds }
): LeadScoreResult {
  const hitl = opts?.hitl ?? 0.65;
  const thresholds = opts?.thresholds ?? DEFAULT_THRESHOLDS;
```

Replace the line `const needsReview = confidence < hitl || (score >= 40 && score <= 60);` with:

```ts
  const needsReview =
    confidence < hitl || (score > thresholds.dqScore && score < thresholds.autoQualifyScore);
```

Note the default `dqScore: 50, autoQualifyScore: 80` do NOT reproduce `40-60` exactly as a range
— they reproduce the *comparison semantics* the roadmap actually wants (DQ and auto-qualify
bound the HITL band). To keep the existing test suite's numeric assertions (`score >= 40`,
`score <= 60`) passing with the Ava fixture (which scores in the low 40s), verify: with
`dqScore=50, autoQualifyScore=80`, a score of 42 gives `42 > 50` → `false`, so `needsReview`
would become `false` from this clause — but `confidence < hitl` still independently applies
(Ava's fixture has `thin: true` → `confidence: 0.52 < hitl 0.65` → `true`), so
`needsReview` stays `true` via the confidence branch. This is why Step 1's second test (default
behavior) must be run and confirmed passing — it is the safety net for this exact reasoning.

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd packages/helix-core && npx vitest run src/lead/heuristic.test.ts`
Expected: PASS — all 5 tests (3 original + 2 new) green.

- [ ] **Step 5: Thread `thresholds` through `runLeadPipeline` and `normalizeClaude`**

In `packages/helix-core/src/lead/pipeline.ts`, change `normalizeClaude`'s signature (currently
`(raw, fallback, document, hitl)`) to accept thresholds too:

```ts
function normalizeClaude(
  raw: ClaudeJson,
  fallback: LeadScoreResult,
  document: string,
  hitl: number,
  thresholds: ScoreThresholds
): LeadScoreResult {
```

Add `ScoreThresholds` to the import list at the top of the file:
`import { scoreLeadHeuristic, type ScoreThresholds } from "./heuristic";` (replace the existing
`import { scoreLeadHeuristic } from "./heuristic";` line).

Replace `const needsReview = confidence < hitl || (score >= 40 && score <= 60);` (inside
`normalizeClaude`) with the same expression used in Step 3:

```ts
  const needsReview =
    confidence < hitl || (score > thresholds.dqScore && score < thresholds.autoQualifyScore);
```

Change `runLeadPipeline`'s signature (currently `opts?: { hitl?: number; addendum?: string }`)
to:

```ts
export async function runLeadPipeline(
  input: LeadIngestInput,
  emit: LeadEmit,
  opts?: { hitl?: number; addendum?: string; thresholds?: ScoreThresholds }
): Promise<StoredLead> {
  const runId = id("run");
  const createdAt = now();
  const hitl = opts?.hitl ?? 0.65;
  const thresholds = opts?.thresholds; // undefined is fine — scoreLeadHeuristic defaults it
```

Update the two call sites inside `runLeadPipeline`:
- `const heuristic = scoreLeadHeuristic(input, { hitl });` → `const heuristic = scoreLeadHeuristic(input, { hitl, thresholds });`
- `scored = normalizeClaude(parsed, heuristic, document, hitl);` → `scored = normalizeClaude(parsed, heuristic, document, hitl, thresholds ?? { autoQualifyScore: 80, dqScore: 50, vipScore: 90, nurtureMin: 30, nurtureMax: 65 });`

(`normalizeClaude` has no default-parameter fallback of its own since it's a private function —
the caller supplies the same default literal used in `heuristic.ts`'s `DEFAULT_THRESHOLDS`. This
duplication is intentional and small; extracting a shared constant is optional polish, not
required for correctness.)

- [ ] **Step 6: Re-export `ScoreThresholds` from the package barrel**

Open `packages/helix-core/src/index.ts`, find the line that exports from `./lead/heuristic`
(likely `export { scoreLeadHeuristic } from "./lead/heuristic";` or similar re-export). Add
`type ScoreThresholds` to that export list so `apps/lead-scoring` can import it as
`import type { ScoreThresholds } from "@helix/core";`.

- [ ] **Step 7: Run the full helix-core test suite**

Run: `cd packages/helix-core && npx vitest run`
Expected: PASS — no regressions in other heuristics (commerce, marketing, rfp are untouched).

- [ ] **Step 8: Add `thresholds` to `BrainSettings` in the app**

In `apps/lead-scoring/src/lib/brain.ts`, add the import at the top:

```ts
import type { ScoreThresholds } from "@helix/core";
```

Add to `BrainSettings` type (after `disabledRuleIds: string[];`):

```ts
  thresholds: ScoreThresholds;
```

Add a default constant (after `DEFAULT_AUTOMATIONS`):

```ts
const DEFAULT_THRESHOLDS: ScoreThresholds = {
  autoQualifyScore: 80,
  dqScore: 50,
  vipScore: 90,
  nurtureMin: 30,
  nurtureMax: 65,
};
```

Add `thresholds: { ...DEFAULT_THRESHOLDS }` to the `DEFAULT` object and to the initial `brain`
value (both literal assignments near the top of the file).

Update `getBrain()` to spread it: add `thresholds: { ...brain.thresholds },` to the returned
object.

Update `setBrain()` to merge partial threshold updates:

```ts
  thresholds: patch.thresholds
    ? { ...brain.thresholds, ...patch.thresholds }
    : { ...brain.thresholds },
```

(add this field to the object literal `setBrain` constructs, alongside `gates`/`automations`).

Update `applyBrainPolicies`'s VIP/nurture conditions (currently hardcoded `score >= 90` and
`score >= 30 && score <= 65`) to read from `settings.thresholds`:

```ts
  } else if (auto.vip && next.classification === "lead" && next.score >= settings.thresholds.vipScore) {
```

```ts
  } else if (
    auto.nurture &&
    next.classification === "lead" &&
    next.score >= settings.thresholds.nurtureMin &&
    next.score <= settings.thresholds.nurtureMax &&
    !next.needsReview
  ) {
```

- [ ] **Step 9: Pass thresholds from `finish-ingest.ts` into `runLeadPipeline`**

In `apps/lead-scoring/src/lib/finish-ingest.ts`, change:

```ts
  const scored = await runLeadPipeline(parsed, emit, {
    hitl: brain.hitl,
    addendum: brain.addendum,
  });
```

to:

```ts
  const scored = await runLeadPipeline(parsed, emit, {
    hitl: brain.hitl,
    addendum: brain.addendum,
    thresholds: brain.thresholds,
  });
```

- [ ] **Step 10: Run the app's typecheck**

Run: `cd apps/lead-scoring && npx tsc --noEmit`
Expected: PASS — no type errors. If `@helix/core`'s built types are stale (monorepo package
resolution), run the package build first: `cd packages/helix-core && npm run build` (check
`package.json` for the actual build script name if `build` doesn't exist — look for `tsup`,
`tsc`, or similar in `packages/helix-core/package.json`), then retry the typecheck.

- [ ] **Step 11: Commit**

```bash
git add packages/helix-core/src/lead/heuristic.ts packages/helix-core/src/lead/heuristic.test.ts packages/helix-core/src/lead/pipeline.ts packages/helix-core/src/index.ts apps/lead-scoring/src/lib/brain.ts apps/lead-scoring/src/lib/finish-ingest.ts
git commit -m "feat(leads): centralize score thresholds in BrainSettings"
```

---

## Task 2: Expose thresholds via `/api/settings/brain` and update the Scoring/Automations UI

**Files:**
- Modify: `apps/lead-scoring/src/app/api/settings/brain/route.ts`
- Modify: `apps/lead-scoring/src/app/settings/scoring/page.tsx`
- Modify: `apps/lead-scoring/src/app/settings/automations/page.tsx`

**Interfaces:**
- Consumes: `BrainSettings.thresholds: ScoreThresholds` from Task 1 (`apps/lead-scoring/src/lib/brain.ts`).
- Produces: `PUT /api/settings/brain` accepts an optional `thresholds: Partial<ScoreThresholds>` body field; `GET /api/settings/brain` returns `thresholds` in its JSON payload (already true automatically once Task 1's `getBrain()` includes it — this task wires the UI to read/write it).

- [ ] **Step 1: Extend the brain settings route to accept `thresholds` in `PUT`**

In `apps/lead-scoring/src/app/api/settings/brain/route.ts`, add the import:

```ts
import type { ScoreThresholds } from "@helix/core";
```

Add `thresholds?: Partial<ScoreThresholds>;` to the `row` type inside `PUT`. Update the
`setBrain(...)` call to pass it through:

```ts
    setBrain({
      addendum: row.addendum,
      hitl: row.hitl,
      gates: row.gates ? { ...current.gates, ...row.gates } : undefined,
      automations: row.automations ? { ...current.automations, ...row.automations } : undefined,
      disabledRuleIds: row.disabledRuleIds,
      thresholds: row.thresholds ? { ...current.thresholds, ...row.thresholds } : undefined,
    })
```

- [ ] **Step 2: Manually verify the route accepts thresholds**

Run the dev server: `cd apps/lead-scoring && npm run dev` (or the monorepo's
`npm run dev:leads` from repo root per `CLAUDE.md` — use whichever the project's `package.json`
scripts define; check root `package.json` for `dev:leads` first).

With the server running, in a second terminal:

```bash
curl -s -X PUT http://127.0.0.1:43148/api/settings/brain -H "Content-Type: application/json" -d '{"thresholds":{"dqScore":45}}'
```

Expected: JSON response includes `"thresholds":{"autoQualifyScore":80,"dqScore":45,"vipScore":90,"nurtureMin":30,"nurtureMax":65}` (or whatever port the dev server actually bound — check the terminal output for the real port if 43148 doesn't respond).

```bash
curl -s http://127.0.0.1:43148/api/settings/brain
```

Expected: same `thresholds` object persists (in-memory, so it stays until the dev server
restarts).

Stop the dev server after verifying (`Ctrl+C`).

- [ ] **Step 3: Wire `settings/scoring/page.tsx` to read/write real thresholds instead of hardcoded constants**

In `apps/lead-scoring/src/app/settings/scoring/page.tsx`:

Remove the hardcoded line `const autoQ = 80;` (currently right before `const triageLo = ...`).

Add state for the two new numeric thresholds, near the existing `const [hitl, setHitl] = useState(65);`:

```ts
  const [autoQualifyScore, setAutoQualifyScore] = useState(80);
  const [dqScore, setDqScore] = useState(50);
```

In the `useEffect` that fetches `/api/settings/brain` (currently):

```ts
    void fetch("/api/settings/brain")
      .then((r) => r.json())
      .then((d: { hitl?: number; disabledRuleIds?: string[] }) => {
        setHitl(Math.round((d.hitl ?? 0.65) * 100));
        if (Array.isArray(d.disabledRuleIds) && d.disabledRuleIds.length) {
```

change the destructured type and add the new setters:

```ts
    void fetch("/api/settings/brain")
      .then((r) => r.json())
      .then((d: { hitl?: number; disabledRuleIds?: string[]; thresholds?: { autoQualifyScore?: number; dqScore?: number } }) => {
        setHitl(Math.round((d.hitl ?? 0.65) * 100));
        if (d.thresholds?.autoQualifyScore != null) setAutoQualifyScore(d.thresholds.autoQualifyScore);
        if (d.thresholds?.dqScore != null) setDqScore(d.thresholds.dqScore);
        if (Array.isArray(d.disabledRuleIds) && d.disabledRuleIds.length) {
```

Update `const triageLo = Math.min(hitl, 79);` and `const triageHi = 79;` — these two lines
described a *display-only* triage band derived from the old hardcoded 65-79 assumption. Replace
both with values derived from the real thresholds so the on-screen band matches what the engine
now uses:

```ts
  const triageLo = dqScore + 1;
  const triageHi = autoQualifyScore - 1;
```

In `saveHitl()`, change the body sent to the PUT request from:

```ts
      body: JSON.stringify({ hitl: hitl / 100, disabledRuleIds }),
```

to:

```ts
      body: JSON.stringify({ hitl: hitl / 100, disabledRuleIds, thresholds: { autoQualifyScore, dqScore } }),
```

Do the same in `runHistoricalSim()`'s PUT call (it has an identical body today — apply the same
change there for consistency, since it persists the current threshold state before simulating).

In the JSX, find the "Auto-Qualification" card (`<p className="mt-3 text-2xl font-semibold text-tertiary">≥ {autoQ} / 100</p>`) and replace `{autoQ}` with `{autoQualifyScore}`. Add an
editable input below it (inside that same card, after the existing `<p>` describing "Auto-routed
to AE pipeline"):

```tsx
          <label className="mt-2 block text-[11px] text-on-surface-variant">
            Auto-qualify at
            <input
              type="number"
              min={dqScore + 1}
              max={100}
              value={autoQualifyScore}
              onChange={(e) => setAutoQualifyScore(Number(e.target.value))}
              className="mt-1 h-8 w-full rounded-lg border border-outline-variant/40 bg-surface-container-lowest px-2 text-sm text-on-surface outline-none focus:border-primary"
            />
          </label>
```

Find the "Auto-Disqualification" card (`<p className="mt-3 text-2xl font-semibold text-error">&lt; 50 pts</p>`) and replace the hardcoded `50` with an editable input mirroring the pattern above:

```tsx
          <p className="mt-3 text-2xl font-semibold text-error">&lt; {dqScore} pts</p>
          <label className="mt-2 block text-[11px] text-on-surface-variant">
            Disqualify below
            <input
              type="number"
              min={0}
              max={autoQualifyScore - 1}
              value={dqScore}
              onChange={(e) => setDqScore(Number(e.target.value))}
              className="mt-1 h-8 w-full rounded-lg border border-outline-variant/40 bg-surface-container-lowest px-2 text-sm text-on-surface outline-none focus:border-primary"
            />
          </label>
```

Update the description text under the "HITL confidence" label (in the "Human Triage Band" card)
to clarify the slider controls confidence, not score — find:

```tsx
          <label className="mt-2 block text-[11px] text-on-surface-variant">
            HITL confidence · {hitl}%
```

Leave the label text as-is (it already says "confidence"), but add one clarifying line right
after the `</label>` closing tag, still inside that card's `div`:

```tsx
          <p className="mt-1 text-[10px] text-outline">
            Confidence threshold, not a score band — the score band shown above ({triageLo}–{triageHi} pts) is derived from Auto-qualify/Disqualify.
          </p>
```

- [ ] **Step 4: Wire `settings/automations/page.tsx` to read real thresholds instead of hardcoded `matchesVip`/`matchesNurture`**

In `apps/lead-scoring/src/app/settings/automations/page.tsx`, add state for the thresholds near
the existing `const [enabled, setEnabled] = useState<Record<string, boolean>>(DEFAULT_ENABLED);`:

```ts
  const [thresholds, setThresholds] = useState({ vipScore: 90, nurtureMin: 30, nurtureMax: 65 });
```

Change `matchesVip` and `matchesNurture` (currently module-level functions with hardcoded
numbers) to accept thresholds as a parameter:

```ts
function matchesVip(l: StoredLead, vipScore: number) {
  return l.tier === "hot" && l.classification === "lead" && l.score >= vipScore;
}
function matchesHitl(l: StoredLead) {
  return Boolean(l.needsReview);
}
function matchesSpam(l: StoredLead) {
  return l.classification === "spam";
}
function matchesNurture(l: StoredLead, nurtureMin: number, nurtureMax: number) {
  return (
    l.classification === "lead" &&
    l.score >= nurtureMin &&
    l.score <= nurtureMax &&
    !l.needsReview
  );
}
```

Update every call site inside the component to pass the new args. In the `useEffect` that fetches
`/api/settings/brain` (currently reads only `d.automations`), add threshold hydration:

```ts
    void fetch("/api/settings/brain")
      .then((r) => r.json())
      .then((d: { automations?: Record<string, boolean>; thresholds?: { vipScore?: number; nurtureMin?: number; nurtureMax?: number } }) => {
        if (d.automations) {
          setEnabled((e) => ({
            ...e,
            vip: d.automations!.vip !== false,
            hitl: d.automations!.hitl !== false,
            spam: d.automations!.spam !== false,
            nurture: d.automations!.nurture !== false,
          }));
        }
        if (d.thresholds) {
          setThresholds((t) => ({
            vipScore: d.thresholds!.vipScore ?? t.vipScore,
            nurtureMin: d.thresholds!.nurtureMin ?? t.nurtureMin,
            nurtureMax: d.thresholds!.nurtureMax ?? t.nurtureMax,
          }));
        }
      })
      .finally(() => setHydrated(true));
```

Update the `stats` `useMemo` (currently `const vip = leads.filter(matchesVip).length;` /
`const nurture = leads.filter(matchesNurture).length;`) to pass thresholds and add `thresholds`
to the dependency array:

```ts
  const stats = useMemo(() => {
    const vip = leads.filter((l) => matchesVip(l, thresholds.vipScore)).length;
    const hitl = leads.filter(matchesHitl).length;
    const spam = leads.filter(matchesSpam).length;
    const nurture = leads.filter((l) => matchesNurture(l, thresholds.nurtureMin, thresholds.nurtureMax)).length;
    const synced = leads.filter((l) => l.crmStatus === "sent" || l.crmStatus === "mocked").length;
    const dispatched = vip + hitl + spam + nurture;
    return { vip, hitl, spam, nurture, synced, dispatched, total: leads.length };
  }, [leads, thresholds]);
```

Update the `feed` `useMemo`'s inline calls (`matchesSpam(l)`, `matchesHitl(l)`, `matchesVip(l)`,
`matchesNurture(l)`) to pass thresholds the same way, and add `thresholds` to that `useMemo`'s
dependency array too.

Update `dryRun()`'s conditions (`sample.score >= 90`, `sample.score >= 30 && sample.score <= 65`)
to use `thresholds.vipScore`, `thresholds.nurtureMin`, `thresholds.nurtureMax` instead of the
literals.

Update the workflow card titles that hardcode the numbers in display text — find:
`title: "VIP Enterprise Fast-Track (Hot Leads >= 90)"` → change to a template literal:
`` title: `VIP Enterprise Fast-Track (Hot Leads >= ${thresholds.vipScore})`, `` (this line is
inside the `workflows` `useMemo` — add `thresholds` to that `useMemo`'s dependency array, which
today is `[ghl, stats]`, making it `[ghl, stats, thresholds]`).

Do the same for `title: "Nurture Sequence for SMB / Low Intent (Score 30-65)"` →
`` title: `Nurture Sequence for SMB / Low Intent (Score ${thresholds.nurtureMin}-${thresholds.nurtureMax})`, ``
and `triggerExpr: "Score >= 90 && classification = lead"` →
`` triggerExpr: `Score >= ${thresholds.vipScore} && classification = lead`, `` and
`triggerExpr: "Score (30..65) && not HITL"` →
`` triggerExpr: `Score (${thresholds.nurtureMin}..${thresholds.nurtureMax}) && not HITL`, ``.

- [ ] **Step 5: Manually verify in the browser**

Run: `cd apps/lead-scoring && npm run dev`
Open `http://127.0.0.1:43148/settings/scoring` (or whichever port the dev server reports).
Change the "Auto-qualify at" input to `85`, click "Save HITL + rules". Reload the page —
confirm the value persisted as `85` (not reset to `80`).
Navigate to `/settings/automations` — confirm the VIP workflow card title now reads
"Hot Leads >= 90" still (thresholds are independent per-field; only `autoQualifyScore` was
changed in Scoring, not `vipScore`). This confirms the two pages read the same underlying object
without accidentally coupling unrelated fields.
Stop the dev server (`Ctrl+C`).

- [ ] **Step 6: Commit**

```bash
git add apps/lead-scoring/src/app/api/settings/brain/route.ts apps/lead-scoring/src/app/settings/scoring/page.tsx apps/lead-scoring/src/app/settings/automations/page.tsx
git commit -m "feat(leads): wire Scoring and Automations UI to shared thresholds"
```

---

## Task 3: Fix LEADS-P0-1 — add `"failed"` CrmStatus and stop clearing `needsReview` before the CRM confirms

**Files:**
- Modify: `packages/helix-core/src/types.ts`
- Modify: `apps/lead-scoring/src/app/api/leads/[id]/crm/route.ts`
- Modify: `apps/lead-scoring/src/app/leads/page.tsx`
- Modify: `apps/lead-scoring/src/app/inbox/page.tsx`
- Modify: `apps/lead-scoring/src/components/leads-engine/TriageOverview.tsx`
- Modify: `apps/lead-scoring/src/app/audit/page.tsx`

**Interfaces:**
- Consumes: nothing from Tasks 1-2.
- Produces: `CrmStatus = "not_sent" | "mocked" | "sent" | "failed"` (extends existing type).
- Produces: `StoredLead.crmError?: string` (new optional field).
- Produces: the four frontend "approve & push" call sites now call `/crm` first and only call
  `/review` if the CRM push succeeded — this is the contract Task 5 (undo toast) and any future
  Fase B work on bulk approve must follow.

- [ ] **Step 1: Add `"failed"` to `CrmStatus` and `crmError` to `StoredLead`**

In `packages/helix-core/src/types.ts`, change:

```ts
export type CrmStatus = "not_sent" | "mocked" | "sent";
```

to:

```ts
export type CrmStatus = "not_sent" | "mocked" | "sent" | "failed";
```

Add `crmError?: string;` to `StoredLead`, right after the existing `ghlOpportunityError?: string;`
line.

- [ ] **Step 2: Run the helix-core typecheck to confirm the type change compiles cleanly**

Run: `cd packages/helix-core && npx tsc --noEmit`
Expected: PASS (adding a union member and an optional field is additive; nothing should break).

- [ ] **Step 3: Make `crm/route.ts` persist failure state instead of dropping it silently**

In `apps/lead-scoring/src/app/api/leads/[id]/crm/route.ts`, inside `sendToCrm`, find:

```ts
  const result = await sendLeadToGhl(working);
  if (result.mocked) {
    return Response.json(
      {
        error: "GHL_API_KEY and GHL_LOCATION_ID required. Paste them in Settings. CRM was not sent.",
        lead: working,
      },
      { status: 409 }
    );
  }
```

Replace with (persist `crmStatus: "not_sent"` explicitly — config is missing, this isn't a
failed attempt against a real API, but the lead must carry the flag so downstream reads don't
see a stale prior value):

```ts
  const result = await sendLeadToGhl(working);
  if (result.mocked) {
    const notSent = await patchLead(id, { crmStatus: "not_sent", crmError: undefined }, orgId);
    return Response.json(
      {
        error: "GHL_API_KEY and GHL_LOCATION_ID required. Paste them in Settings. CRM was not sent.",
        lead: notSent ?? working,
      },
      { status: 409 }
    );
  }
```

Find the final fallthrough:

```ts
  return Response.json({ error: result.error || "GHL send failed", lead: working }, { status: 502 });
```

Replace with:

```ts
  const failed = await patchLead(
    id,
    { crmStatus: "failed", crmError: result.error || "GHL send failed" },
    orgId
  );
  return Response.json({ error: result.error || "GHL send failed", lead: failed ?? working }, { status: 502 });
```

- [ ] **Step 4: Manually verify the CRM route now persists failure state**

Run: `cd apps/lead-scoring && npm run dev`

With no `GHL_API_KEY` set (default dev state), find a seeded lead id — run:

```bash
curl -s http://127.0.0.1:43148/api/leads | node -e "const d=JSON.parse(require('fs').readFileSync(0)); console.log(d.leads[0].id)"
```

(adjust the port if the dev server reports a different one). Take that id and run:

```bash
curl -s -X POST http://127.0.0.1:43148/api/leads/<the-id>/crm
```

Expected: HTTP 409, JSON body with `lead.crmStatus === "not_sent"` explicitly present in the
response (previously it was just whatever it was before — now explicitly confirmed).

Stop the dev server (`Ctrl+C`).

- [ ] **Step 5: Fix `leads/page.tsx`'s `pushCrm()` to push to CRM before clearing review**

Open `apps/lead-scoring/src/app/leads/page.tsx`, find `pushCrm()` (around line 422-440). It
currently does:

```ts
    if (selected.needsReview) {
      await fetch(`/api/leads/${selected.id}/review`, { method: "POST" });
    }
    const res = await fetch(`/api/leads/${selected.id}/crm`, { method: "POST" });
```

Read the full function first (`Read` the file at that offset) to get the exact surrounding
variable names (`selected`, `setSelected`, `setLeads`, `setError`, etc. — confirmed present from
this plan's research, but re-read before editing since exact local variable names in error
handling branches were not fully quoted in the design phase). Restructure so the CRM call runs
first and `/review` only runs on success:

```ts
    setError(null);
    const res = await fetch(`/api/leads/${selected.id}/crm`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    const data = (await res.json()) as { lead?: StoredLead; error?: string };
    if (!res.ok) {
      if (data.lead) {
        setLeads((prev) => prev.map((l) => (l.id === selected.id ? data.lead! : l)));
        setSelected(data.lead);
      }
      setError(data.error || `CRM ${res.status}`);
      return;
    }
    if (data.lead) {
      setLeads((prev) => prev.map((l) => (l.id === selected.id ? data.lead! : l)));
      setSelected(data.lead);
    }
    if (selected.needsReview) {
      const reviewRes = await fetch(`/api/leads/${selected.id}/review`, { method: "POST" });
      const reviewData = (await reviewRes.json()) as { lead?: StoredLead };
      if (reviewData.lead) {
        setLeads((prev) => prev.map((l) => (l.id === selected.id ? reviewData.lead! : l)));
        setSelected(reviewData.lead);
      }
    }
    window.dispatchEvent(new CustomEvent("helix:leads-refresh"));
```

Adapt variable names to whatever the actual `pushCrm` function signature/closure uses once
re-read — the shape (CRM call → check `res.ok` → only then call `/review`) is the required
contract regardless of exact local variable naming.

- [ ] **Step 6: Fix `inbox/page.tsx`'s `act(id, "approve")` the same way**

In `apps/lead-scoring/src/app/inbox/page.tsx`, find the `path === "approve"` branch inside
`act()` (around line 125-141):

```ts
      if (path === "approve") {
        await fetch(`/api/leads/${id}/review`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(noteBody),
        });
        const crm = await fetch(`/api/leads/${id}/crm`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(noteBody),
        });
        if (!crm.ok) {
          const data = (await crm.json()) as { error?: string };
          setError(data.error || `CRM ${crm.status}`);
        } else {
          setNote("");
        }
      } else if (path === "crm") {
```

Replace the `if (path === "approve")` block with (CRM first, review only on success):

```ts
      if (path === "approve") {
        const crm = await fetch(`/api/leads/${id}/crm`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(noteBody),
        });
        if (!crm.ok) {
          const data = (await crm.json()) as { error?: string };
          setError(data.error || `CRM ${crm.status}`);
        } else {
          await fetch(`/api/leads/${id}/review`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(noteBody),
          });
          setNote("");
        }
      } else if (path === "crm") {
```

At the end of `act()`, after the existing `await refresh();` inside the `finally` block's
sibling code (the line right before `} finally { setBusy(null); }`), also dispatch the shared
refresh event so other open tabs/surfaces (sidebar badge, analytics, audit) pick up the change:

```ts
      await refresh();
      window.dispatchEvent(new CustomEvent("helix:leads-refresh"));
    } finally {
      setBusy(null);
    }
```

- [ ] **Step 7: Fix `TriageOverview.tsx`'s `approveAndPush()` the same way**

Open `apps/lead-scoring/src/components/leads-engine/TriageOverview.tsx`, find `approveAndPush`
(around line 92-104):

```ts
    await fetch(`/api/leads/${id}/review`, { method: "POST" });
    const crm = await fetch(`/api/leads/${id}/crm`, { method: "POST" });
```

Replace with:

```ts
    const crm = await fetch(`/api/leads/${id}/crm`, { method: "POST" });
    if (crm.ok) {
      await fetch(`/api/leads/${id}/review`, { method: "POST" });
    }
```

Read the surrounding function body first to confirm how it reports errors and whether it already
dispatches `helix:leads-refresh` after (this component is listed in the design doc as already
listening for that event — confirm it also *dispatches* it after `approveAndPush`; if it doesn't,
add `window.dispatchEvent(new CustomEvent("helix:leads-refresh"));` after the `if (crm.ok)` block,
regardless of the outcome, so other surfaces refresh even when the push failed and nothing
changed except the toast/error state).

- [ ] **Step 8: Add a `CRM_SYNC_FAILED` audit event for leads with `crmStatus === "failed"`**

Open `apps/lead-scoring/src/app/audit/page.tsx`, find the block that builds the `CRM_SYNC` event
(around line 80-109):

```ts
    if (lead.crmStatus === "sent" || lead.crmStatus === "mocked") {
      const at = lead.reviewedAt ?? lead.createdAt;
      const parts = formatParts(at);
      events.push({
        id: `crm-${lead.id}`,
        ...
      });
    }
```

Add a new sibling block right after that closing `}`, still inside the `for (const lead of leads)`
loop:

```ts
    if (lead.crmStatus === "failed") {
      const at = lead.reviewedAt ?? lead.createdAt;
      const parts = formatParts(at);
      events.push({
        id: `crm-failed-${lead.id}`,
        at,
        ...parts,
        kind: "CRM_SYNC_FAILED",
        severity: "WARNING",
        actor: "Sync Relay",
        actorSub: "GHL dispatch failed",
        target: `Lead #${baseId}`,
        targetSub: `${lead.name} · ${lead.crmError ?? "unknown error"}`,
        hash: shortHash(`crm-failed:${lead.id}:${lead.crmError ?? ""}`),
        signed: true,
        title: "CRM handoff failed",
        prev: { crmStatus: "not_sent" },
        next: { crmStatus: "failed", crmError: lead.crmError ?? null },
        raw: {
          event_type: "CRM_SYNC_FAILED",
          lead_id: lead.id,
          name: lead.name,
          crmStatus: lead.crmStatus,
          crmError: lead.crmError ?? null,
        },
      });
    }
```

- [ ] **Step 9: Manually verify the full approve-with-failing-CRM flow end to end**

Run: `cd apps/lead-scoring && npm run dev`
Open the app in a browser (whatever port the dev server reports). Navigate to `/inbox`. With no
`GHL_API_KEY` configured, pick the pending lead (Ava, seeded) and click Approve (or press `A`).

Expected:
- An error toast/message appears mentioning GHL keys are required.
- The lead does NOT disappear from the inbox queue (still pending).
- Navigate to `/` (dashboard) or `/analytics` — the pending count still shows 1 (not 0).
- Navigate to `/audit` — a `CRM_SYNC_FAILED`-kind entry (or whatever the UI renders `kind` as)
  appears for that lead, with severity WARNING.
- The sidebar badge on "Triage Inbox" still shows the pending count.

Stop the dev server (`Ctrl+C`) once confirmed.

- [ ] **Step 10: Commit**

```bash
git add packages/helix-core/src/types.ts apps/lead-scoring/src/app/api/leads/[id]/crm/route.ts apps/lead-scoring/src/app/leads/page.tsx apps/lead-scoring/src/app/inbox/page.tsx apps/lead-scoring/src/components/leads-engine/TriageOverview.tsx apps/lead-scoring/src/app/audit/page.tsx
git commit -m "fix(leads): stop clearing needsReview before CRM push confirms (LEADS-P0-1)"
```

---

## Task 4: Sync the sidebar badge, analytics, and audit pages to the shared refresh event

**Files:**
- Modify: `apps/lead-scoring/src/components/app-shell.tsx`
- Modify: `apps/lead-scoring/src/app/analytics/page.tsx`
- Modify: `apps/lead-scoring/src/app/audit/page.tsx`
- Modify: `apps/lead-scoring/src/components/lead-dashboard.tsx`

**Interfaces:**
- Consumes: the `helix:leads-refresh` `CustomEvent` already dispatched by `leads/page.tsx`,
  `settings/scoring/page.tsx`, and now (from Task 3) `inbox/page.tsx` and `TriageOverview.tsx`.
- Produces: nothing new — this task only adds listeners, no new events or types.

- [ ] **Step 1: Make `app-shell.tsx`'s badge counter listen for the refresh event**

Open `apps/lead-scoring/src/components/app-shell.tsx`, find the `useEffect` that fetches
`/api/status` and `/api/leads` to compute `hotCount`/`reviewCount`/`slaPct` (around line 89-105):

```ts
  useEffect(() => {
    void Promise.all([
      fetch("/api/status").then((r) => r.json()).catch(() => ({})),
      fetch("/api/leads").then((r) => r.json()).catch(() => ({ leads: [] })),
    ]).then(([status, leadsRes]) => {
      setGhlConnected(Boolean((status as { ghl?: boolean }).ghl));
      const leads = ((leadsRes as { leads?: StoredLead[] }).leads ?? []) as StoredLead[];
      setHotCount(leads.filter((l) => l.tier === "hot" && l.classification === "lead").length);
      setReviewCount(leads.filter((l) => l.needsReview).length);
      if (leads.length === 0) {
        setSlaPct(null);
      } else {
        const clear = leads.filter((l) => !l.needsReview).length;
        setSlaPct(Math.round((clear / leads.length) * 1000) / 10);
      }
    });
  }, [pathname]);
```

Extract the fetch logic into a named function and call it both on `pathname` change and on the
custom event:

```ts
  useEffect(() => {
    function loadBadgeState() {
      void Promise.all([
        fetch("/api/status").then((r) => r.json()).catch(() => ({})),
        fetch("/api/leads").then((r) => r.json()).catch(() => ({ leads: [] })),
      ]).then(([status, leadsRes]) => {
        setGhlConnected(Boolean((status as { ghl?: boolean }).ghl));
        const leads = ((leadsRes as { leads?: StoredLead[] }).leads ?? []) as StoredLead[];
        setHotCount(leads.filter((l) => l.tier === "hot" && l.classification === "lead").length);
        setReviewCount(leads.filter((l) => l.needsReview).length);
        if (leads.length === 0) {
          setSlaPct(null);
        } else {
          const clear = leads.filter((l) => !l.needsReview).length;
          setSlaPct(Math.round((clear / leads.length) * 1000) / 10);
        }
      });
    }
    loadBadgeState();
    window.addEventListener("helix:leads-refresh", loadBadgeState);
    return () => window.removeEventListener("helix:leads-refresh", loadBadgeState);
  }, [pathname]);
```

- [ ] **Step 2: Make `analytics/page.tsx` listen for the refresh event**

Read the file first to find its exact fetch-on-mount `useEffect` (design research located the
`review` count derivation at line ~27 inside a `useMemo`, but the actual `fetch("/api/leads")`
call lives in a separate `useEffect` — confirm its exact shape before editing). Wrap that
`useEffect`'s fetch logic in a named function the same way as Step 1, call it once on mount, and
add:

```ts
    window.addEventListener("helix:leads-refresh", loadAnalytics);
    return () => window.removeEventListener("helix:leads-refresh", loadAnalytics);
```

(name the function `loadAnalytics` or whatever fits the existing local naming convention in that
file — consistency with the file's own style matters more than the exact name).

- [ ] **Step 3: Make `audit/page.tsx` listen for the refresh event**

Read the file's fetch-on-mount logic (design research located it around line ~221, feeding into
`buildEvents(leads)`). Apply the same pattern: extract to a named function, call on mount, add
`window.addEventListener("helix:leads-refresh", <fnName>)` with cleanup.

- [ ] **Step 4: Make `lead-dashboard.tsx`'s `sendCrm` and `clearReview` dispatch the refresh event**

Open `apps/lead-scoring/src/components/lead-dashboard.tsx`. In `sendCrm` (around line 321-331):

```ts
  async function sendCrm(id: string) {
    setError(null);
    const res = await fetch(`/api/leads/${id}/crm`, { method: "POST" });
    const data = (await res.json()) as { lead?: StoredLead; error?: string };
    if (data.lead) {
      setLeads((prev) => prev.map((l) => (l.id === id ? data.lead! : l)));
      setSelected(data.lead);
      showToast("Lead sent to CRM");
    }
    if (!res.ok) setError(data.error || `GHL ${res.status}`);
  }
```

Add a dispatch after the existing logic, regardless of success/failure (so other surfaces always
re-sync, whether the push succeeded or the lead's `crmStatus` changed to `"failed"`/`"not_sent"`
per Task 3):

```ts
  async function sendCrm(id: string) {
    setError(null);
    const res = await fetch(`/api/leads/${id}/crm`, { method: "POST" });
    const data = (await res.json()) as { lead?: StoredLead; error?: string };
    if (data.lead) {
      setLeads((prev) => prev.map((l) => (l.id === id ? data.lead! : l)));
      setSelected(data.lead);
      if (res.ok) showToast("Lead sent to CRM");
    }
    if (!res.ok) setError(data.error || `GHL ${res.status}`);
    window.dispatchEvent(new CustomEvent("helix:leads-refresh"));
  }
```

Do the same for `clearReview` (around line 346-353):

```ts
  async function clearReview(id: string) {
    const res = await fetch(`/api/leads/${id}/review`, { method: "POST" });
    const data = (await res.json()) as { lead?: StoredLead };
    if (data.lead) {
      setLeads((prev) => prev.map((l) => (l.id === id ? data.lead! : l)));
      setSelected(data.lead);
    }
    window.dispatchEvent(new CustomEvent("helix:leads-refresh"));
  }
```

- [ ] **Step 5: Manually verify cross-surface sync in the browser**

Run: `cd apps/lead-scoring && npm run dev`
Open two browser tabs to the app: Tab A on `/inbox`, Tab B on `/` (dashboard, showing the
sidebar badge). With no `GHL_API_KEY` configured, approve Ava in Tab A (expect the error toast
from Task 3's fix — the lead stays pending). Switch to Tab B without reloading — the sidebar
badge should still show 1 pending (it won't auto-update across tabs without a page focus/nav
event since `CustomEvent` doesn't cross tabs, but confirm that navigating within Tab B, e.g.
`/` → `/leads` → `/`, shows the correct count — this validates the per-tab fetch-on-mount/event
logic is at least internally consistent, which is the actual scope of this task; cross-tab
real-time sync would require a different mechanism and is out of scope for Fase A).
Stop the dev server (`Ctrl+C`).

- [ ] **Step 6: Commit**

```bash
git add apps/lead-scoring/src/components/app-shell.tsx apps/lead-scoring/src/app/analytics/page.tsx apps/lead-scoring/src/app/audit/page.tsx apps/lead-scoring/src/components/lead-dashboard.tsx
git commit -m "fix(leads): sync sidebar badge, analytics, and audit to the shared refresh event"
```

---

## Task 5: Fix LEADS-P1-2 — connectors copy, and verify LEADS-P1-3

**Files:**
- Modify: `apps/lead-scoring/src/app/settings/integrations/page.tsx`

**Interfaces:**
- Consumes: nothing from other tasks.
- Produces: nothing consumed by other tasks.

- [ ] **Step 1: Fix the hardcoded "1 CRM live" label**

Open `apps/lead-scoring/src/app/settings/integrations/page.tsx`, find (around line 296-298):

```tsx
            <span className="rounded-full bg-surface-container px-2 py-0.5 font-mono text-[10px] text-on-surface-variant">
              1 CRM live
            </span>
```

Replace with:

```tsx
            <span className="rounded-full bg-surface-container px-2 py-0.5 font-mono text-[10px] text-on-surface-variant">
              {ghl ? "1 CRM live" : "0 CRM live"}
            </span>
```

(`ghl` is already a `useState<boolean>` in scope in this component, set from `/api/status` in
`refresh()` — confirmed present at line ~55/69 during design research.)

- [ ] **Step 2: Manually verify the copy now matches connector state**

Run: `cd apps/lead-scoring && npm run dev`
With no `GHL_API_KEY` set, open `/settings/integrations` — confirm the badge now reads
"0 CRM live" (previously always said "1 CRM live"). Confirm the GHL card below still correctly
shows "Offline" (this was already correct — only the top badge was wrong).
Stop the dev server (`Ctrl+C`).

- [ ] **Step 3: Verify LEADS-P1-3 (`/settings` does not 404)**

Run: `cd apps/lead-scoring && npm run dev`
Run: `curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:43148/settings`
Expected: `200`.
Also click through the sidebar "Desk Settings" link in the running browser session to confirm
the same visually. No code change needed — this step is a verification record, not a fix.
Stop the dev server (`Ctrl+C`).

- [ ] **Step 4: Commit**

```bash
git add apps/lead-scoring/src/app/settings/integrations/page.tsx
git commit -m "fix(leads): connectors badge reflects real GHL status (LEADS-P1-2)"
```

---

## Task 6: Add the undo toast for Approve & Push (3.3)

**Files:**
- Modify: `apps/lead-scoring/src/app/inbox/page.tsx`

**Interfaces:**
- Consumes: the CRM-first-then-review contract from Task 3 (the `approve` branch in `act()` only
  calls `/review` after `/crm` succeeds).
- Produces: nothing consumed by other tasks — this is a leaf UI feature.

- [ ] **Step 1: Add undo state and a toast with a 5-second countdown**

Open `apps/lead-scoring/src/app/inbox/page.tsx`. Add state near the existing
`const [error, setError] = useState<string | null>(null);`:

```ts
  const [undo, setUndo] = useState<{ id: string; secondsLeft: number } | null>(null);
```

Add a ref to hold the interval/timeout handles so they can be cleared on unmount or on manual
undo, near the top of the component body:

```ts
  const undoTimerRef = useRef<{ interval: number; timeout: number } | null>(null);
```

(add `useRef` to the existing `import { useCallback, useEffect, useMemo, useState } from "react";`
line, making it `import { useCallback, useEffect, useMemo, useRef, useState } from "react";`.)

Add a cleanup function and the undo trigger, placed near the other helper functions (after
`act()`):

```ts
  function clearUndoTimer() {
    if (undoTimerRef.current) {
      window.clearInterval(undoTimerRef.current.interval);
      window.clearTimeout(undoTimerRef.current.timeout);
      undoTimerRef.current = null;
    }
  }

  function startUndoWindow(id: string) {
    clearUndoTimer();
    setUndo({ id, secondsLeft: 5 });
    const interval = window.setInterval(() => {
      setUndo((cur) => {
        if (!cur || cur.id !== id) return cur;
        const next = cur.secondsLeft - 1;
        return next > 0 ? { id, secondsLeft: next } : cur;
      });
    }, 1000);
    const timeout = window.setTimeout(() => {
      clearUndoTimer();
      setUndo(null);
    }, 5000);
    undoTimerRef.current = { interval, timeout };
  }

  async function undoApprove(id: string) {
    clearUndoTimer();
    setUndo(null);
    await fetch(`/api/leads/${id}/reactivate`, { method: "POST" }).catch(() => null);
    await refresh();
    window.dispatchEvent(new CustomEvent("helix:leads-refresh"));
  }
```

Add a `useEffect` to clear the timer on unmount, near the other `useEffect`s:

```ts
  useEffect(() => {
    return () => clearUndoTimer();
  }, []);
```

Note: `undoApprove` calls `POST /api/leads/[id]/reactivate` — check whether this route already
exists (`apps/lead-scoring/src/app/api/leads/reactivate/route.ts` was seen in the earlier file
listing, but as a top-level collection route, not `[id]`-scoped — read it before relying on it).
If it does not accept a single lead id in the shape needed to set `needsReview: true` again, use
the existing `/api/leads/[id]/review` semantics inverted: since there's no "un-review" endpoint,
add one. In `apps/lead-scoring/src/app/api/leads/[id]/review/route.ts`, add a `DELETE` handler
that reopens the lead for review:

```ts
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = requireOperator(req);
  if (denied) return denied;
  const { id } = await params;
  return withOrgScope(async (orgId) => {
    const lead = await patchLead(id, { needsReview: true }, orgId);
    if (!lead) return Response.json({ error: "Lead not found" }, { status: 404 });
    return Response.json({ lead });
  });
}
```

And change `undoApprove` to call `DELETE` instead of the nonexistent reactivate shape:

```ts
  async function undoApprove(id: string) {
    clearUndoTimer();
    setUndo(null);
    await fetch(`/api/leads/${id}/review`, { method: "DELETE" }).catch(() => null);
    await refresh();
    window.dispatchEvent(new CustomEvent("helix:leads-refresh"));
  }
```

- [ ] **Step 2: Trigger the undo window when an approve succeeds**

In `act()`, inside the `if (path === "approve")` branch (already restructured by Task 3 to push
CRM first), find the success branch:

```ts
        } else {
          await fetch(`/api/leads/${id}/review`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(noteBody),
          });
          setNote("");
        }
```

Add `startUndoWindow(id);` right after `setNote("");`:

```ts
        } else {
          await fetch(`/api/leads/${id}/review`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(noteBody),
          });
          setNote("");
          startUndoWindow(id);
        }
```

- [ ] **Step 3: Add `Ctrl+Z` keyboard handling and the toast UI**

Find the existing keyboard `useEffect` (around line 76-90, handles `a`/`d`/`j` keys). Add a
branch for `Ctrl+Z`/`Cmd+Z` at the top of the `onKey` function, before the existing
`instanceof HTMLInputElement` guard (undo should work even while the note textarea has focus, so
place it before that early-return, but still guard against it firing while typing an actual "z"
character — check `metaKey || ctrlKey` first):

```ts
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "z" && undo) {
        e.preventDefault();
        void undoApprove(undo.id);
        return;
      }
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement)
        return;
```

Add `undo` to that `useEffect`'s dependency array (it currently closes over `leads`/`selectedId`
— check the existing array and add `undo` alongside).

Add the toast JSX near the end of the component's render, in a location that renders regardless
of the selected lead (e.g. right before the closing `</div>` of the top-level return, or wherever
this file already places transient UI like `error` — check for an existing `{error ? (...) : null}`
block and place the toast as a sibling right after it):

```tsx
      {undo ? (
        <div className="fixed right-4 bottom-4 z-50 flex items-center gap-3 rounded-lg border border-outline-variant/40 bg-surface-container-high px-4 py-2 text-sm text-on-surface shadow-lg">
          <span>Approved & pushed to CRM — undo reopens HITL only, not the CRM push ({undo.secondsLeft}s)</span>
          <button
            type="button"
            onClick={() => void undoApprove(undo.id)}
            className="rounded bg-primary-container px-2 py-1 text-xs font-semibold text-on-primary-container"
          >
            Undo (Ctrl+Z)
          </button>
        </div>
      ) : null}
```

- [ ] **Step 4: Manually verify the undo flow**

Run: `cd apps/lead-scoring && npm run dev`
With `GHL_API_KEY`/`GHL_LOCATION_ID` set to any dummy values that make `isGhlConfigured()` return
true but the actual API call fail (or, simpler: temporarily point `GHL_BASE`-dependent code isn't
feasible without real credentials — instead, verify the toast's *timer and undo mechanics* using
a lead where you don't have real GHL credentials by checking that the "approve" flow's *error*
path, from Task 3, correctly does NOT show the undo toast (only success does) — this is the
observable, testable behavior without needing live GHL access):
1. With no GHL keys configured, approve a pending lead. Expect: error toast, no undo toast (since
   the push failed and `/review` was never called — confirms Task 3 + Task 6 don't conflict).
2. If GHL keys ARE available in this environment (check with the user or `.env.local` before
   assuming), approve a lead successfully. Expect: undo toast appears, counts down from 5,
   pressing `Ctrl+Z` before it expires reopens the lead in the inbox queue (`needsReview: true`
   again) and removes the toast immediately.
Stop the dev server (`Ctrl+C`).

- [ ] **Step 5: Commit**

```bash
git add apps/lead-scoring/src/app/inbox/page.tsx apps/lead-scoring/src/app/api/leads/[id]/review/route.ts
git commit -m "feat(leads): add 5s undo toast after Approve & Push (3.3)"
```

---

## Self-Review Notes (completed during plan authoring)

- **Spec coverage:** LEADS-P0-1 → Tasks 3-4. LEADS-P1-1 + F-2 → Tasks 1-2. LEADS-P1-2 → Task 5
  Steps 1-2. LEADS-P1-3 → Task 5 Step 3 (verification only, per spec). 3.3 → Task 6. All five
  spec sections have a task.
- **Placeholder scan:** no TBD/TODO; every step has literal code or an exact verification
  command. Two steps (Task 3 Step 5, Task 6 Step 1/4) explicitly instruct the implementer to
  re-read a file before editing because this plan's authoring pass could not fully quote every
  local variable name in every branch — this is a deliberate instruction to verify against the
  live file, not a placeholder for missing design.
- **Type consistency:** `ScoreThresholds` fields (`autoQualifyScore`, `dqScore`, `vipScore`,
  `nurtureMin`, `nurtureMax`) are named identically across Task 1 (definition), Task 2 (UI), and
  their defaults match in both `heuristic.ts` and `brain.ts`. `CrmStatus`'s new `"failed"` member
  and `crmError` field (Task 3) are consumed consistently by Task 3's own audit-page addition and
  Task 4's dashboard dispatch — no other task reads `crmError`, so no drift risk there.
