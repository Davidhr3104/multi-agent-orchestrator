# Ask AI Drawer — Helix for Leads (pilot)

## Purpose

The inline `AskAiCard` (already shipped in all 5 apps) answers questions
about one record or general app mechanics. This spec adds a second,
richer surface: a right-side drawer opened by clicking the cube image
inside `AskAiCard`, modeled on the user's supplied mockup (header with
live status, a message timeline of rich cards, structured action
proposals with an explicit confirm button, an attachment tray, and a
persistent AI-disclaimer line). The drawer can reason over **all** of an
app's records at once (not just one), and can propose — never silently
execute — simple actions like archiving cold leads.

**Both surfaces stay.** The inline card remains for quick, single-record
or general questions. The drawer is for broader analysis and the first
executable action. Neither replaces the other.

**Hard constraint carried across every app:** the drawer's layout/shell is
one shared pattern, reused across all 5 Helix apps exactly like
`AskAiCard` already is. Brand color and *domain content* (system prompt,
snapshot shape, available actions) are per-app and must never leak into
another app — Leads' drawer must never see Commerce's order data or
Commerce's action vocabulary, and vice versa. This spec covers **Leads
only**; the same shell repeats per-app later with each app's own content,
the same way the inline card did.

## Scope

**In scope (Leads pilot):**
- A `Sheet`-based right-side drawer (`side="right"`, reusing the existing
  `Sheet`/`SheetContent` component already present in `apps/lead-scoring`)
  triggered by clicking the cube image in `AskAiCard`.
- Drawer header: icon, "Ask Helix AI", a "COPILOT" badge, a live status
  indicator (`Listening` while a request is in flight, otherwise mirrors
  the existing `engine` state — `Online & Ready` / `Limited Mode`), close
  button.
- Message timeline rendered as cards (not plain paragraphs like the
  inline card): user messages show text + any attached image/text chips;
  assistant messages show analysis text and, when applicable, a
  structured **action proposal card** (see below).
- A snapshot-based "all records" context: when the drawer is opened
  without a specific lead selected, the backend builds a compact summary
  (counts per tier, top N leads by score, basic trend) of every lead in
  `listLeads()` and passes it as context — no dynamic search/tool-calling
  in this pass. When a lead *is* selected on the dashboard, the drawer
  behaves like today's card: scoped to that one lead.
- One executable action in this pass: **archive candidate leads**. The
  assistant can propose "archive these N cold leads" with the specific
  lead ids/names listed; nothing is archived until the user clicks an
  explicit **Confirm** button on that proposal card. Confirming calls the
  existing `POST /api/leads/[id]/archive` route per target — the drawer
  never bypasses that route or duplicates its logic.
- Attachments: an image or pasted long text can be attached to a
  question and sent to Claude as part of that turn (image content block
  / inlined text) — read-only for this pass, not persisted to Supabase or
  associated with any lead record.
- A fixed, always-visible disclaimer line at the bottom of the drawer:
  "Helix AI can make mistakes. Review the information before acting."
- Quick action chips at the bottom of the drawer (mirrors the mockup's
  "Run Go/No-Go / Extract Clauses / Audit Compliance" row), Leads-specific
  (e.g. "Summarize hot leads", "Find stale leads", "Draft a follow-up").

**Explicitly out of scope for this pass:**
- Any action beyond archive (no score overrides, no CRM pushes, no
  outreach sending from the drawer).
- Persisting attachments as files tied to a lead record.
- Dynamic search/tool-calling over leads (RAG) — the snapshot is
  precomputed once per drawer-open, not re-queried mid-conversation.
- The other 4 apps' drawers — separate follow-up work once this pilot is
  validated, each with its own color/content, never Leads' content reused
  verbatim.
- Any change to the inline `AskAiCard`'s existing single-record/general
  behavior — it keeps working exactly as it does today.

## Architecture

### 1. Extend `packages/helix-core/src/ask-ai.ts`

The existing `askAi()` function's contract (`systemPrompt`, `recordContext`,
`history`) is reused as-is for the drawer's plain Q&A turns — no change
needed there. What's new is a second, additive function for the one
structured case (action proposals), so `askAi()` itself stays simple and
untouched:

```ts
export type AskAiActionProposal = {
  type: "action_proposal";
  action: string;            // e.g. "archive_leads" — app-defined, opaque to helix-core
  summary: string;           // human-readable description of what will happen
  targets: { id: string; label: string }[];
};

export type AskAiDrawerResult = AskAiResult & {
  proposal?: AskAiActionProposal;
};

export async function askAiWithProposal(params: {
  systemPrompt: string;
  recordContext?: string;
  history: AskAiMessage[];
  proposalInstruction: string; // app-specific: when/how to emit a proposal, and its exact JSON shape
}): Promise<AskAiDrawerResult>;
```

Behavior: calls Claude the same way `askAi()` does, but the
`proposalInstruction` (built by the Leads route, not hardcoded in
`helix-core`) tells the model to emit a fenced JSON block matching
`AskAiActionProposal`'s shape when — and only when — the user's request
clearly maps to the one supported action. `askAiWithProposal` parses that
block out of the response text (reusing the existing `parseJsonObject`
helper from `claude.ts`) and returns it separately from the prose
`answer`; if no valid block is found, `proposal` is `undefined` and the
turn is just a normal answer. Falls back the same way `askAi()` does when
Claude isn't configured — with `proposal: undefined` (no proposals in
fallback mode, since there's no model available to reason about intent).

### 2. `apps/lead-scoring/src/app/api/ask-ai/route.ts` — extend

The existing route keeps its current `{ leadId?, history }` contract for
the inline card unchanged. Add a `mode` field:

```ts
POST /api/ask-ai
Body: { leadId?: string; history: AskAiMessage[]; mode?: "card" | "drawer" }
```

- `mode` omitted or `"card"`: exactly today's behavior (unchanged).
- `mode: "drawer"`:
  - If `leadId` present: same single-lead `recordContext` as today.
  - If `leadId` absent: build a snapshot context from `listLeads(orgId)` —
    total count, count per tier, top 10 by score (name, score, tier,
    days since created), and a one-line count of leads idle >30 days
    with no activity (the "cold candidate" set the archive action targets).
  - Calls `askAiWithProposal(...)` (not `askAi(...)`) with a Leads-specific
    `proposalInstruction` describing the `archive_leads` action shape and
    the rule for when to propose it (only when the user explicitly asks
    to clean up / archive / remove stale leads — never proposed
    unprompted).
  - Returns `{ answer, engine, proposal? }`.

### 3. `apps/lead-scoring/src/app/api/ask-ai/execute/route.ts` (new)

```ts
POST /api/ask-ai/execute
Body: { action: "archive_leads"; targetIds: string[] }
```

- Validates `action === "archive_leads"` (400 on anything else — this
  route is intentionally a closed allowlist of one, not a generic
  action-execution endpoint).
- For each id in `targetIds`, calls the same archive logic the existing
  `POST /api/leads/[id]/archive` route uses (import/reuse its handler
  function rather than re-implementing patch logic — check that route's
  current file to see whether its logic is already extracted into a
  callable function or needs a small extraction first; either way, no
  duplicated archive logic between the two routes).
- Returns `{ archived: string[]; failed: { id: string; error: string }[] }`
  — partial failures are reported per-id, not an all-or-nothing 500.

### 4. Frontend — `apps/lead-scoring/src/components/ask-ai-drawer.tsx` (new)

A new component, not a modification of `ask-ai-card.tsx`. `AskAiCard`
gains an `onOpenDrawer` callback wired to the cube `<img>`'s `onClick`;
the parent (`TriageOverview`) owns a boolean `drawerOpen` state and
renders `<AskAiDrawer open={drawerOpen} onOpenChange={setDrawerOpen} />`
using the existing `Sheet`/`SheetContent` primitives with `side="right"`.

Structure (Leads' own cyan brand color, matching `AskAiCard`'s existing
palette — not the mockup's literal colors, which were a generic
reference):

- Header: icon + "Ask Helix AI" + "COPILOT" badge + status text (see
  Scope) + close button.
- Scrollable message list: each turn as a card (user card right-aligned
  or distinctly styled, assistant card left-aligned/full-width). When an
  assistant message has a `proposal`, render it as a distinct card:
  summary text, the target list, a **Confirm** button (calls
  `POST /api/ask-ai/execute`, then shows a success/partial-failure
  summary inline and appends a system-style confirmation message to the
  timeline) and a **Dismiss** button (just drops the proposal, no call).
- Attachment tray above the input: shows attached image thumbnails /
  text-snippet chips for the message being composed, removable before
  sending.
- Input row: text input, attach button (image or paste-long-text), send
  button. Attaching an image reads it client-side (e.g.
  `FileReader`/`base64`) and includes it in the next `POST /api/ask-ai`
  call's history entry as an image content block (this requires the
  request body's `history` entries to optionally carry an `attachments`
  field — extend `AskAiMessage` additively in `helix-core` with an
  optional `attachments?: { type: "image"; data: string; mediaType: string }[]`
  field; `askAi`/`askAiWithProposal` pass it straight through into the
  Anthropic message content array instead of a plain string when present).
- Quick action chips row above the disclaimer (Leads-specific presets).
- Fixed disclaimer line, always visible, never dismissible: "Helix AI can
  make mistakes. Review the information before acting."

### 5. Why `helix-core` stays domain-agnostic

`askAiWithProposal`'s `proposalInstruction` and `AskAiActionProposal.action`
are both opaque strings the calling route defines — `helix-core` has no
knowledge of "archive_leads," "leads," "tiers," or any Leads-specific
concept. This is what keeps the same shared function usable later by
Commerce's own (different) action vocabulary without ever importing or
branching on Leads' domain logic — the constraint the user stated
explicitly.

## Data flow

```
User clicks cube image in AskAiCard
  → TriageOverview sets drawerOpen = true
  → AskAiDrawer renders (Sheet side="right")

User asks a question (optionally with an attached image)
  → POST /api/ask-ai { history, mode: "drawer", leadId? }
    → if leadId: same single-lead context as the inline card
    → if no leadId: build snapshot from listLeads(orgId)
    → askAiWithProposal({ systemPrompt, recordContext, history, proposalInstruction })
        → Claude configured?
            no  → fallback (same shape as askAi(), proposal always undefined)
            yes → call Anthropic, parse out a fenced proposal JSON block if present
    ← { answer, engine, proposal? }
  ← rendered as an assistant card; if proposal present, rendered as an
    action-proposal card with Confirm/Dismiss

User clicks Confirm on a proposal
  → POST /api/ask-ai/execute { action: "archive_leads", targetIds }
    → per id: same logic as POST /api/leads/[id]/archive
  ← { archived, failed }
  ← drawer appends a confirmation message, disables Confirm on that card
```

## Testing

- `packages/helix-core/src/ask-ai.test.ts`: extend with tests for
  `askAiWithProposal` — no proposal in the response text → `proposal`
  undefined; a valid fenced JSON proposal block → parsed and returned;
  Claude not configured → fallback shape with `proposal: undefined`;
  malformed/partial JSON in the block → treated as no proposal (never
  throws).
- Route-level (manual, following the same convention already used for
  `POST /api/ask-ai` — no existing automated route-test harness in this
  app): verify `mode: "drawer"` without `leadId` returns a snapshot-based
  answer; verify `POST /api/ask-ai/execute` archives real seeded leads
  and that archived leads actually change state (check via
  `GET /api/leads` afterward); verify an invalid `action` value 400s;
  verify a partially-invalid `targetIds` array (one real id, one fake)
  returns a partial `failed` entry rather than failing the whole request.

## Verification before calling this done

- `npm test --workspace=@helix/core` passes including the new
  `askAiWithProposal` tests.
- `npm run build --workspace=helix-lead-scoring` passes with no
  TypeScript errors.
- Local dev server: open the drawer from the dashboard, ask a general
  question (drawer with no lead open) and confirm the snapshot-based
  answer references real seeded lead data; ask something that should
  trigger the archive proposal (e.g. "archive my cold leads") and confirm
  a proposal card renders with real candidate leads; click Confirm and
  verify (via the leads list) that those leads are actually archived;
  attach an image to a question and confirm it's included in the request
  (network tab) without crashing the turn.
