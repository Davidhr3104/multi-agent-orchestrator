# Ask AI — Helix for Leads (pilot) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a backend-only Ask AI feature for Helix for Leads — a shared `askAi()` function in `packages/helix-core` plus one `POST /api/ask-ai` route in `apps/lead-scoring`, answering questions grounded in a specific lead's stored reasoning/fields or in a fixed description of the app, with graceful fallback when Claude isn't configured. No frontend in this plan.

**Architecture:** `askAi()` lives in `helix-core` as a new, standalone function (not a refactor of the existing single-turn `completeWithClaude`) because it needs multi-turn `messages[]`. It calls the Anthropic Messages API directly via `fetch`, following the same `getSecret`/timeout/try-catch-to-fallback shape as `completeWithClaude`. The route in `apps/lead-scoring` builds the record context from a real `StoredLead` via the existing `getLead`/`withOrgScope` pattern, then delegates to `askAi()`.

**Tech Stack:** TypeScript, Next.js App Router (Node runtime), Vitest, npm workspaces monorepo (`packages/helix-core`, `apps/lead-scoring`), Anthropic Messages API.

## Global Constraints

- Never fail silently: unconfigured Claude or a failed API call must return a real `{ answer, engine: "fallback" }`, never a bare 500 or empty response.
- `askAi()` must not modify or wrap `completeWithClaude` — that function has other callers (e.g. `smart-reply.ts`) with a single-turn contract; leave it untouched.
- Follow the existing route conventions in `apps/lead-scoring/src/app/api/leads/[id]/route.ts`: `runtime = "nodejs"`, `withOrgScope`, JSON error bodies with matching status codes.
- No rate limiting, no cross-record search, no frontend — all explicitly out of scope for this pass.
- Test file naming and mocking style must match `packages/helix-core/src/commerce/pipeline.test.ts` (vi.mock style) and `packages/helix-core/src/secrets.test.ts` (temp HELIX_SECRETS_PATH + resetSecretsCache pattern) since `askAi()` calls `getSecret` directly, not through a mockable module boundary.

---

### Task 1: `askAi()` core function in helix-core

**Files:**
- Create: `packages/helix-core/src/ask-ai.ts`
- Test: `packages/helix-core/src/ask-ai.test.ts`

**Interfaces:**
- Consumes: `getSecret` and `resetSecretsCache`/`setSecrets` from `./secrets` (existing).
- Produces:
  ```ts
  export type AskAiRole = "user" | "assistant";
  export type AskAiMessage = { role: AskAiRole; content: string };
  export type AskAiEngine = "claude" | "fallback";
  export type AskAiResult = { answer: string; engine: AskAiEngine };

  export async function askAi(params: {
    systemPrompt: string;
    recordContext?: string;
    history: AskAiMessage[];
  }): Promise<AskAiResult>;
  ```
  Later tasks (the route) call `askAi(...)` and read `.answer` / `.engine` from the result.

- [ ] **Step 1: Write the failing tests**

Create `packages/helix-core/src/ask-ai.test.ts`:

```ts
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { askAi } from "./ask-ai";
import { resetSecretsCache, setSecrets } from "./secrets";

const prevPath = process.env.HELIX_SECRETS_PATH;
const dir = mkdtempSync(path.join(tmpdir(), "helix-ask-ai-"));
process.env.HELIX_SECRETS_PATH = path.join(dir, "secrets.json");

afterAll(() => {
  setSecrets({ ANTHROPIC_API_KEY: "" });
  if (prevPath) process.env.HELIX_SECRETS_PATH = prevPath;
  else delete process.env.HELIX_SECRETS_PATH;
  resetSecretsCache();
  rmSync(dir, { recursive: true, force: true });
});

beforeEach(() => {
  setSecrets({ ANTHROPIC_API_KEY: "" });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("askAi", () => {
  it("falls back to the record context when Claude is not configured", async () => {
    const result = await askAi({
      systemPrompt: "You explain Helix for Leads.",
      recordContext: "Lead score: 72, tier: warm.",
      history: [{ role: "user", content: "Why this score?" }],
    });
    expect(result).toEqual({
      answer: "Lead score: 72, tier: warm.",
      engine: "fallback",
    });
  });

  it("falls back to a fixed unavailable message when not configured and there is no record context", async () => {
    const result = await askAi({
      systemPrompt: "You explain Helix for Leads.",
      history: [{ role: "user", content: "What does tier mean?" }],
    });
    expect(result.engine).toBe("fallback");
    expect(result.answer).toBe(
      "Ask AI needs an Anthropic API key configured to answer questions."
    );
  });

  it("calls Claude with the full history and system context when configured", async () => {
    setSecrets({ ANTHROPIC_API_KEY: "sk-ant-test-key" });
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        content: [{ type: "text", text: "This lead scored 72 because of budget fit." }],
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const history = [
      { role: "user" as const, content: "Why this score?" },
    ];
    const result = await askAi({
      systemPrompt: "You explain Helix for Leads.",
      recordContext: "Lead score: 72, tier: warm.",
      history,
    });

    expect(result).toEqual({
      answer: "This lead scored 72 because of budget fit.",
      engine: "claude",
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.anthropic.com/v1/messages",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          "x-api-key": "sk-ant-test-key",
        }),
      })
    );
    const body = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    expect(body.system).toBe("You explain Helix for Leads.\n\nLead score: 72, tier: warm.");
    expect(body.messages).toEqual(history);
  });

  it("falls back when the Claude call throws", async () => {
    setSecrets({ ANTHROPIC_API_KEY: "sk-ant-test-key" });
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network down")));

    const result = await askAi({
      systemPrompt: "You explain Helix for Leads.",
      recordContext: "Lead score: 72, tier: warm.",
      history: [{ role: "user", content: "Why this score?" }],
    });

    expect(result).toEqual({
      answer: "Lead score: 72, tier: warm.",
      engine: "fallback",
    });
  });

  it("falls back when Claude responds with a non-ok status", async () => {
    setSecrets({ ANTHROPIC_API_KEY: "sk-ant-test-key" });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false }));

    const result = await askAi({
      systemPrompt: "You explain Helix for Leads.",
      recordContext: "Lead score: 72, tier: warm.",
      history: [{ role: "user", content: "Why this score?" }],
    });

    expect(result.engine).toBe("fallback");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test --workspace=@helix/core -- ask-ai`
Expected: FAIL with "Cannot find module './ask-ai'" (file doesn't exist yet).

- [ ] **Step 3: Write the implementation**

Create `packages/helix-core/src/ask-ai.ts`:

```ts
import { getSecret } from "./secrets";

export type AskAiRole = "user" | "assistant";
export type AskAiMessage = { role: AskAiRole; content: string };
export type AskAiEngine = "claude" | "fallback";
export type AskAiResult = { answer: string; engine: AskAiEngine };

const UNAVAILABLE_MESSAGE =
  "Ask AI needs an Anthropic API key configured to answer questions.";

function fallback(recordContext?: string): AskAiResult {
  return { answer: recordContext ?? UNAVAILABLE_MESSAGE, engine: "fallback" };
}

export async function askAi(params: {
  systemPrompt: string;
  recordContext?: string;
  history: AskAiMessage[];
}): Promise<AskAiResult> {
  const { systemPrompt, recordContext, history } = params;
  const key = getSecret("ANTHROPIC_API_KEY");
  if (!key) return fallback(recordContext);

  const system = recordContext ? `${systemPrompt}\n\n${recordContext}` : systemPrompt;

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 900,
        system,
        messages: history,
      }),
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) return fallback(recordContext);

    const data = (await res.json()) as {
      content?: { type: string; text?: string }[];
    };
    const text = data.content?.find((c) => c.type === "text")?.text?.trim();
    if (!text) return fallback(recordContext);

    return { answer: text, engine: "claude" };
  } catch {
    return fallback(recordContext);
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test --workspace=@helix/core -- ask-ai`
Expected: PASS (5 tests).

- [ ] **Step 5: Export from the package barrel**

Modify `packages/helix-core/src/index.ts` — add this line near the existing
`claude.ts` export line:

```ts
export { askAi, type AskAiEngine, type AskAiMessage, type AskAiResult, type AskAiRole } from "./ask-ai";
```

- [ ] **Step 6: Run the full helix-core test suite**

Run: `npm test --workspace=@helix/core`
Expected: PASS (all files, including the pre-existing 22 files / 108+ tests
plus the new 5 in `ask-ai.test.ts`).

- [ ] **Step 7: Commit**

```bash
git add packages/helix-core/src/ask-ai.ts packages/helix-core/src/ask-ai.test.ts packages/helix-core/src/index.ts
git commit -m "feat(helix-core): add askAi() shared multi-turn Q&A function"
```

---

### Task 2: `POST /api/ask-ai` route in Helix for Leads

**Files:**
- Create: `apps/lead-scoring/src/app/api/ask-ai/route.ts`
- Test: `apps/lead-scoring/src/app/api/ask-ai/route.test.ts` (only if
  `apps/lead-scoring` has an existing test setup for routes — see Step 0)

**Interfaces:**
- Consumes:
  - `askAi`, `AskAiMessage`, `AskAiResult` from `@helix/core` (Task 1).
  - `getLead` from `@/lib/store` — signature `getLead(id: string, orgId?: string): Promise<StoredLead | null>` (existing, matches `apps/lead-scoring/src/app/api/leads/[id]/route.ts`).
  - `withOrgScope` from `@/lib/org-auth` — signature
    `withOrgScope<T>(fn: (orgId: string | undefined) => Promise<T>): Promise<T | Response>` (existing, same file; it returns a 401 `Response` itself on org-scope failure, so the callback's `T` here is `Response` and the outer return type collapses to `Promise<Response>`).
  - `StoredLead`, `ScoredField` types from `@helix/core` (existing —
    `reasoning: string`, `fields: ScoredField[]`, `score: number`,
    `tier: LeadTier`, `confidence: number`, `classification: LeadClassification`;
    each `ScoredField` has `label: string`, `value: string`, `evidence: string`).
- Produces: the HTTP contract other code (and the future frontend) calls:
  `POST /api/ask-ai` with body `{ leadId?: string; history: AskAiMessage[] }`,
  returns `200 { answer: string; engine: "claude" | "fallback" }`,
  `400 { error: string }` for a missing/empty `history`,
  `404 { error: "Lead not found" }` for an unknown `leadId`.

- [ ] **Step 0: Check how sibling routes in apps/lead-scoring are tested**

Run: `find apps/lead-scoring/src/app/api -iname "*.test.ts"`

If this returns no files, `apps/lead-scoring` has no existing route-level
test convention — skip writing an automated test file for this route and
rely on the manual verification in Step 5 instead (this matches the spec's
"Route-level check (manual or lightweight test, following whatever pattern
sibling routes ... use)"). If it returns files, open one to copy its exact
test harness (test runner invocation, request-mocking style) before writing
`route.test.ts` for this route using that same harness.

- [ ] **Step 1: Write the system prompt constant and route skeleton**

Create `apps/lead-scoring/src/app/api/ask-ai/route.ts`:

```ts
import { askAi, type AskAiMessage } from "@helix/core";
import { getLead } from "@/lib/store";
import { withOrgScope } from "@/lib/org-auth";
import type { ScoredField } from "@helix/core";

export const runtime = "nodejs";

const SYSTEM_PROMPT = `You are Ask AI inside Helix for Leads, a B2B lead intelligence tool.

How the app works:
- Every inbound lead is scored 0-100 and placed in a tier (hot, warm, cold, or disqualified) based on fit signals like budget, timeline, and industry match.
- "Confidence" is how sure the scoring engine is about its own classification, separate from the score itself.
- "Reasoning" is the scoring engine's explanation for why it assigned that score and tier.
- Each scored field (e.g. budget, timeline, industry fit) carries its own evidence — the specific input text that justified its value.
- Operators review leads in a human-in-the-loop queue: they can Approve & Push (send to the CRM), Archive, or manually adjust a lead before it moves forward. Approve & Push shows a 5-second undo window before the CRM sync is final.
- "Pipeline stage" tracks a lead's position after being pushed to the CRM (e.g. new, contacted, qualified).

When a specific lead's data is provided below, answer using that data — do not invent facts not present in it. When no lead data is provided, answer only using the description above.`;

function buildRecordContext(lead: {
  classification: string;
  score: number;
  tier: string;
  confidence: number;
  reasoning: string;
  fields: ScoredField[];
}): string {
  const fieldLines = lead.fields
    .map((f) => `- ${f.label}: ${f.value} (evidence: ${f.evidence})`)
    .join("\n");
  return [
    `Lead classification: ${lead.classification}`,
    `Score: ${lead.score}`,
    `Tier: ${lead.tier}`,
    `Confidence: ${lead.confidence}`,
    `Reasoning: ${lead.reasoning}`,
    `Scored fields:`,
    fieldLines,
  ].join("\n");
}

export async function POST(req: Request) {
  return withOrgScope(async (orgId): Promise<Response> => {
    const body = (await req.json()) as { leadId?: string; history?: AskAiMessage[] };

    if (!Array.isArray(body.history) || body.history.length === 0) {
      return Response.json({ error: "history must be a non-empty array" }, { status: 400 });
    }

    let recordContext: string | undefined;
    if (body.leadId) {
      const lead = await getLead(body.leadId, orgId);
      if (!lead) return Response.json({ error: "Lead not found" }, { status: 404 });
      recordContext = buildRecordContext(lead);
    }

    const result = await askAi({
      systemPrompt: SYSTEM_PROMPT,
      recordContext,
      history: body.history,
    });

    return Response.json(result);
  });
}
```

- [ ] **Step 2: Run the workspace typecheck**

Run: `npm run build --workspace=helix-lead-scoring` (or the project's
typecheck script if one exists separately from build — check
`apps/lead-scoring/package.json` `scripts` first with
`cat apps/lead-scoring/package.json` and prefer a `typecheck` script if
present over a full build).
Expected: no TypeScript errors. If `ScoredField`'s actual field names differ
from `label`/`value`/`evidence` once you check
`packages/helix-core/src/types.ts` `ScoredField`, adjust
`buildRecordContext` to match the real property names — this was verified
during spec-writing but re-confirm here since the file may have moved.

- [ ] **Step 3: Start the local dev server**

Run: `npm run dev:leads`
Expected: server starts on `http://127.0.0.1:43148` with no startup errors.

- [ ] **Step 4: Manually verify the fallback path (no API key)**

With `ANTHROPIC_API_KEY` unset in `apps/lead-scoring/.env.local` (comment it
out or leave blank if present), send:

```bash
curl -s -X POST http://127.0.0.1:43148/api/ask-ai \
  -H "content-type: application/json" \
  -d '{"history":[{"role":"user","content":"What does tier mean?"}]}'
```

Expected: `200` with
`{"answer":"Ask AI needs an Anthropic API key configured to answer questions.","engine":"fallback"}`.

Then find a real seeded lead id (check the leads list endpoint or UI) and:

```bash
curl -s -X POST http://127.0.0.1:43148/api/ask-ai \
  -H "content-type: application/json" \
  -d '{"leadId":"<real-lead-id>","history":[{"role":"user","content":"Why this score?"}]}'
```

Expected: `200` with `engine: "fallback"` and `answer` containing the lead's
actual reasoning/score/tier text.

Then an unknown lead id:

```bash
curl -s -X POST http://127.0.0.1:43148/api/ask-ai \
  -H "content-type: application/json" \
  -d '{"leadId":"does-not-exist","history":[{"role":"user","content":"Why this score?"}]}'
```

Expected: `404` with `{"error":"Lead not found"}`.

Then empty history:

```bash
curl -s -X POST http://127.0.0.1:43148/api/ask-ai \
  -H "content-type: application/json" \
  -d '{"history":[]}'
```

Expected: `400` with `{"error":"history must be a non-empty array"}`.

- [ ] **Step 5: Manually verify the Claude path (if a key is available)**

If you have a real `ANTHROPIC_API_KEY` to set in
`apps/lead-scoring/.env.local`, restart the dev server and repeat the
real-lead-id curl from Step 4. Expected: `200` with `engine: "claude"` and
an `answer` that references the lead's actual score/tier in natural
language (not identical to the raw fallback text).

If no key is available, skip this step and note it in the final report —
this is not a blocker for the pilot, since the fallback path is the one
this plan guarantees works without external dependencies.

- [ ] **Step 6: Commit**

```bash
git add apps/lead-scoring/src/app/api/ask-ai/route.ts
git commit -m "feat(leads): add POST /api/ask-ai route"
```

If a `route.test.ts` was written in Step 0's branch, include it in this
commit too.

---

## Final verification (after both tasks)

- [ ] Run `npm test --workspace=@helix/core` — full suite passes.
- [ ] Run `npm run dev:leads` and confirm the server starts cleanly.
- [ ] Confirm all four curl checks from Task 2 Step 4 behave as documented.
- [ ] Report back to the user which port the dev server is on
  (`http://127.0.0.1:43148`) so they can start designing the frontend
  against the now-working `/api/ask-ai` endpoint.
