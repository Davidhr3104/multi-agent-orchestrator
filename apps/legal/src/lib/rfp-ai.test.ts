import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_LEGAL_PROFILE } from "@helix/core";
import type { LegalRfp } from "./legal-rfp";
import { extractRfpWithAi, proposeGoNoGo } from "./rfp-ai";

const BODY = [
  "Title: Legal Services - Medical Record Review",
  "Agency: VETERANS AFFAIRS",
  "Response deadline: 2026-10-20T16:00:00-05:00",
  "Description:",
  "The VA requires independent medical record review for tort claims in Texas. Estimated value $120,000.",
].join("\n");
const INPUT = { title: "Legal Services - Medical Record Review", issuer: "VETERANS AFFAIRS", body: BODY, clientProfile: DEFAULT_LEGAL_PROFILE };

function claudeReply(payload: unknown, usage = { input_tokens: 2400, output_tokens: 500 }) {
  return vi.fn(
    async () =>
      new Response(
        JSON.stringify({ model: "claude-sonnet-4-20250514", content: [{ type: "text", text: JSON.stringify(payload) }], usage }),
        { status: 200, headers: { "content-type": "application/json" } }
      )
  );
}

beforeEach(() => {
  process.env.ANTHROPIC_API_KEY = "test-anthropic-key";
});
afterEach(() => {
  delete process.env.ANTHROPIC_API_KEY;
});

describe("extractRfpWithAi", () => {
  it("accepts Claude fields only as cited when the quote is really in the source, and meters the call", async () => {
    const fetchImpl = claudeReply({
      method: "BEAR",
      amount: "$120,000",
      deadline: "2026-10-20",
      matchScore: 81,
      tier: "hot",
      confidence: 0.8,
      reasoning: "Medical record review in Texas fits the injury desk.",
      fields: [
        { key: "amount", label: "Amount", value: "$120,000", confidence: 0.9, quote: "Estimated value $120,000" },
        { key: "deadline", label: "Deadline", value: "2026-10-20", confidence: 0.9, quote: "Response deadline: 2026-10-20T16:00:00-05:00" },
        { key: "bond", label: "Bond", value: "$1M bond", confidence: 0.7, quote: "Performance bond of $1,000,000" },
      ],
    });
    const r = await extractRfpWithAi(INPUT, { rfpId: "sam-x", fetchImpl: fetchImpl as unknown as typeof fetch });
    const [request] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(request).toBe("https://api.anthropic.com/v1/messages");
    expect(r.scored.engine).toBe("claude");
    expect(r.scored.needsReview).toBe(true);
    expect(r.scored.fields.map((f) => f.verified)).toEqual([true, true, false]);
    expect(r.scored.unverifiedCount).toBe(1);
    expect(r.extraction).toMatchObject({ engine: "claude", verifiedFields: 2, totalFields: 3 });
    expect(r.usage).toHaveLength(1);
    expect(r.usage[0]).toMatchObject({ purpose: "extraction", inputTokens: 2400, outputTokens: 500, rfpId: "sam-x" });
    expect(r.usage[0].estimatedUsd).toBeCloseTo(0.0072 + 0.0075, 6);
  });

  it("falls back to labelled heuristics without a key and makes no request", async () => {
    delete process.env.ANTHROPIC_API_KEY;
    const fetchImpl = vi.fn();
    const r = await extractRfpWithAi(INPUT, { fetchImpl: fetchImpl as unknown as typeof fetch });
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(r.scored.engine).toBe("heuristic");
    expect(r.extraction.note).toMatch(/not AI/);
    expect(r.usage).toEqual([]);
  });

  it("still counts the tokens when Claude answers with invalid JSON", async () => {
    const fetchImpl = vi.fn(
      async () => new Response(JSON.stringify({ content: [{ type: "text", text: "sorry" }], usage: { input_tokens: 100, output_tokens: 5 } }))
    );
    const r = await extractRfpWithAi(INPUT, { fetchImpl: fetchImpl as unknown as typeof fetch });
    expect(r.scored.engine).toBe("heuristic");
    expect(r.usage[0]).toMatchObject({ inputTokens: 100, outputTokens: 5 });
  });
});

describe("proposeGoNoGo", () => {
  const rfp = {
    id: "sam-x",
    title: INPUT.title,
    issuer: INPUT.issuer,
    body: BODY,
    clientProfile: DEFAULT_LEGAL_PROFILE,
    matchScore: 80,
    tier: "hot",
    method: "BEAR",
    amount: "$120,000",
    deadline: "2026-10-20",
    confidence: 0.8,
    reasoning: "",
    fields: [],
    unverifiedCount: 0,
    needsReview: true,
    engine: "claude",
    createdAt: "2026-10-02T00:00:00Z",
    runId: "r",
    corpusStatus: "not_asked",
  } satisfies LegalRfp;

  it("returns a cited recommendation and never a partner decision", async () => {
    const fetchImpl = claudeReply({
      recommendation: "GO",
      confidence: 0.7,
      rationale: "Clinical record review in Texas.",
      reasons: [{ point: "Core practice", quote: "independent medical record review" }],
      risks: [{ point: "Bond", quote: "made-up clause" }],
      conditions: ["Confirm no VA conflicts"],
    });
    const { proposal, usage } = await proposeGoNoGo(rfp, { profile: DEFAULT_LEGAL_PROFILE, fetchImpl: fetchImpl as unknown as typeof fetch });
    expect(proposal).toMatchObject({ engine: "claude", recommendation: "GO", conditions: ["Confirm no VA conflicts"] });
    expect(proposal.reasons[0].verified).toBe(true);
    expect(proposal.risks[0].verified).toBe(false);
    expect(usage[0].purpose).toBe("go-no-go");
    expect("partnerDecision" in proposal).toBe(false);
  });

  it("rejects an invalid verdict and lets a NO-GO conflict check drive the rule-based fallback", async () => {
    const fetchImpl = claudeReply({ recommendation: "YES" });
    const coi = {
      rfpId: "sam-x",
      issuer: "VA",
      verdict: "NO-GO" as const,
      score: 10,
      why: "Adverse party",
      engine: "heuristic" as const,
      claudeFailed: true,
      hits: [],
      checkedAt: "",
    };
    const { proposal } = await proposeGoNoGo(rfp, { profile: DEFAULT_LEGAL_PROFILE, coi, fetchImpl: fetchImpl as unknown as typeof fetch });
    expect(proposal.engine).toBe("heuristic");
    expect(proposal.recommendation).toBe("NO-GO");
    expect(proposal.note).toMatch(/valid recommendation/);
  });
});
