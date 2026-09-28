# Ask AI — Helix for Leads (pilot)

## Purpose

Helix already computes `reasoning`, `fields` (evidence per scored field), `score`,
`tier`, and `confidence` for every lead — but that data only surfaces as static
text in the UI today. Ask AI turns it into a conversational layer: an operator
can ask "why did this lead score 72?" or "what does tier mean?" and get an
answer grounded in the lead's actual stored data, or in a fixed description of
how Helix for Leads works when no specific lead is in context.

This spec covers **backend only** — a shared `askAi()` function in
`packages/helix-core` plus one API route in `apps/lead-scoring`. No UI is
built here; the user is designing the frontend separately against this
contract once the backend is live in local dev.

Helix for Leads is the pilot. If this pattern works, it repeats (same
`helix-core` function, one new route per app) across Inbox, Legal, Commerce,
and Marketing.

## Scope

**In scope:**
- A shared, reusable `askAi()` function in `helix-core`.
- One `POST /api/ask-ai` route in `apps/lead-scoring`.
- Two question modes, both handled by the same endpoint:
  1. **Record-scoped** — `leadId` provided: answers grounded in that lead's
     `reasoning`, `fields`, `score`, `tier`, `confidence`, `classification`.
  2. **General** — no `leadId`: answers grounded in a fixed system prompt
     describing how Helix for Leads works (what score/tier/confidence mean,
     what the pipeline stages are, what the HITL actions do).
- Multi-turn conversation: the caller sends the full message history each
  request (stateless server, stateful client — the frontend the user builds
  later owns persistence).
- Graceful fallback when `ANTHROPIC_API_KEY` is not configured: return the
  raw stored data (for record-scoped questions) with no paraphrasing, never
  a 500.

**Out of scope (explicitly deferred):**
- Any frontend/UI component.
- Rate limiting or per-session message caps (revisit once a trial/billing
  model exists).
- Cross-record search ("show me all leads like this one") — general mode
  only knows fixed app description text, not other leads' data.
- The other 4 Helix apps (Inbox, Legal, Commerce, Marketing) — separate spec
  once this pilot is validated.

## Architecture

### 1. `packages/helix-core/src/ask-ai.ts` (new)

```ts
export type AskAiMessage = { role: "user" | "assistant"; content: string };

export type AskAiResult = {
  answer: string;
  engine: "claude" | "fallback";
};

export async function askAi(params: {
  systemPrompt: string;
  recordContext?: string;
  history: AskAiMessage[];
}): Promise<AskAiResult>;
```

Behavior:
- `history` must be non-empty; the last entry is treated as the question
  being asked now (caller includes prior turns before it).
- If `isClaudeConfigured()` is false, or the Claude call fails/times out:
  return `{ answer: recordContext ?? "Ask AI needs an Anthropic API key configured to answer questions.", engine: "fallback" }`.
  This is a real answer, not an error — record-scoped fallback shows the
  operator the raw reasoning/fields text they'd otherwise not see explained;
  general-mode fallback with no `recordContext` says plainly that it's
  unavailable rather than silently returning nothing.
- If configured: call the Anthropic Messages API with
  `system: systemPrompt + (recordContext ? "\n\n" + recordContext : "")`
  and `messages: history` (mapped to Anthropic's `{role, content}` shape).
  Reuses the same model (`claude-sonnet-4-20250514`), same `getSecret`
  pattern, and the same try/catch-to-null-on-failure shape as
  `completeWithClaude` in `claude.ts` — this is a new function (not a
  refactor of `completeWithClaude`) because it needs multi-turn `messages`
  instead of a single `prompt` string; `completeWithClaude` is left
  untouched since other callers (smart-reply, etc.) depend on its current
  single-turn signature.
- 20s timeout via `AbortSignal.timeout`, same as the existing pattern.
- Export `askAi` and `AskAiMessage`/`AskAiResult` types from
  `packages/helix-core/src/index.ts`.

### 2. `apps/lead-scoring/src/app/api/ask-ai/route.ts` (new)

```ts
POST /api/ask-ai
Body: { leadId?: string; history: AskAiMessage[] }
```

- `runtime = "nodejs"` (matches sibling routes).
- Wrapped in `withOrgScope` (matches `leads/[id]/route.ts`) so a lead can
  only be referenced if it belongs to the caller's org.
- Validates `history` is a non-empty array; 400 if not.
- If `leadId` present: `getLead(leadId, orgId)`; 404 with
  `{ error: "Lead not found" }` if missing (matches existing convention).
  Build `recordContext` as a formatted block containing the lead's
  `classification`, `score`, `tier`, `confidence`, `reasoning`, and each
  entry of `fields` (label + value + evidence, whatever `ScoredField` holds).
- If no `leadId`: `recordContext` is `undefined`.
- `systemPrompt` is a module-level constant in this route file describing:
  what Helix for Leads does, what score/tier/classification/confidence mean,
  what each pipeline stage represents, what the main HITL actions do
  (approve & push, archive, undo). Plain text, no interpolation.
- Calls `askAi({ systemPrompt, recordContext, history })` from
  `@helix/core` and returns `Response.json({ answer, engine })`.
- Errors (bad body, lead not found) return JSON `{ error }` with the
  matching status code — same shape as sibling routes, never a bare 500
  for expected failure modes.

## Data flow

```
Frontend (built later)
  → POST /api/ask-ai { leadId?, history }
    → withOrgScope resolves orgId
    → if leadId: getLead(id, orgId) → 404 or build recordContext
    → askAi({ systemPrompt, recordContext, history })  [helix-core]
        → isClaudeConfigured()?
            no  → { answer: recordContext ?? unavailable-text, engine: "fallback" }
            yes → call Anthropic Messages API with system + full history
                    ok  → { answer: text, engine: "claude" }
                    err → { answer: recordContext ?? unavailable-text, engine: "fallback" }
    ← Response.json({ answer, engine })
```

## Testing

- `packages/helix-core/src/ask-ai.test.ts`:
  - Claude not configured → returns fallback with `recordContext` echoed
    verbatim.
  - Claude not configured, no `recordContext` → returns the fixed
    "unavailable" fallback text.
  - Claude configured, successful call → returns `{ engine: "claude" }`
    with the mocked response text (mock `fetch`, following the existing
    test patterns in `helix-core`'s other `*.test.ts` files).
  - Claude configured, call throws/times out → falls back same as
    not-configured.
- Route-level check (manual or lightweight test, following whatever pattern
  sibling routes in `apps/lead-scoring` use): valid `leadId` builds
  `recordContext` from real lead fields; invalid `leadId` returns 404;
  missing/empty `history` returns 400.

## Verification before calling this done

- `npm test --workspace=@helix/core` passes including the new `ask-ai.test.ts`.
- Local dev server (`npm run dev:leads`) running; manually POST to
  `/api/ask-ai` with curl/Postman for both modes (with a real `leadId` from
  seeded data, and without one) and confirm the response shape and fallback
  behavior with `ANTHROPIC_API_KEY` unset locally, then confirm the Claude
  path once a key is present.
