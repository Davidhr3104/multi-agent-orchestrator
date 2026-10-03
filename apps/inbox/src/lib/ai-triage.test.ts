import { afterEach, describe, expect, it, vi } from "vitest";
import { buildTriagePrompt, formatTriageReasoning, parseClaudeTriage, quoteIsInEmail, triageWithClaude } from "./ai-triage";
import { estimateUsd, ESTIMATED_FALLBACK_USD_PER_MTOK, resetAiUsage, summarizeAiUsage } from "./ai-usage";
import { stripQuotedReply } from "./gmail";

const email = {
  fromName: "Maya Chen",
  fromEmail: "maya@northwindhvac.com",
  subject: "Need pricing this week",
  body: "We're locking in budget for Q2 and need the exact pricing by EOD Friday.\nThanks!",
};

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("Claude triage parsing", () => {
  it("keeps quotes that are really in the email and drops invented ones", () => {
    const t = parseClaudeTriage(
      JSON.stringify({
        category: "action_required",
        sentiment: "urgent",
        urgencyScore: 140,
        leadIntent: true,
        reasons: [
          { reason: "Hard deadline", quote: "by EOD  friday" },
          { reason: "Budget approved", quote: "the CFO signed off" },
        ],
        draftReply: "Hi Maya, I'll send the pricing today.",
        confidence: 88,
      }),
      email
    )!;
    expect(t.urgencyScore).toBe(100);
    expect(t.reasons).toEqual([
      { reason: "Hard deadline", quote: "by EOD  friday" },
      { reason: "Budget approved", quote: undefined },
    ]);
    expect(formatTriageReasoning(t)).toBe("Claude triage · Hard deadline (“by EOD  friday”) · Budget approved (no exact quote)");
  });

  it("never keeps a draft for spam/fyi and rejects unknown categories", () => {
    expect(parseClaudeTriage('{"category":"fyi","draftReply":"Thanks!"}', email)?.draftReply).toBe("");
    expect(parseClaudeTriage('{"category":"urgent-ish"}', email)).toBeNull();
    expect(parseClaudeTriage("not json", email)).toBeNull();
  });

  it("matches quotes ignoring case and whitespace, but not tiny fragments", () => {
    expect(quoteIsInEmail("“EXACT pricing”", email)).toBe(true);
    expect(quoteIsInEmail("Q2", email)).toBe(false);
  });

  it("puts the operator's sent emails in the prompt only as a style reference", () => {
    const p = buildTriagePrompt(email, { tone: "friendly", toneSamples: ["Hey! Sure thing — talk soon, D."] });
    expect(p).toContain("Operator's recent sent emails (style reference only");
    expect(p).toContain("Hey! Sure thing");
    expect(buildTriagePrompt(email, { tone: "formal" })).not.toContain("Operator's recent sent emails");
  });

  it("returns null without a key so the labelled keyword triage is kept", async () => {
    vi.stubEnv("HELIX_SECRETS_PATH", "./.no-secrets-in-tests.json");
    vi.stubEnv("ANTHROPIC_API_KEY", "");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    expect(await triageWithClaude(email, { tone: "professional" })).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("calls Claude when configured and records the triage cost", async () => {
    vi.stubEnv("HELIX_SECRETS_PATH", "./.no-secrets-in-tests.json");
    vi.stubEnv("ANTHROPIC_API_KEY", "sk-test");
    resetAiUsage();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            content: [{ type: "text", text: '{"category":"action_required","sentiment":"urgent","urgencyScore":91,"reasons":[{"reason":"Deadline","quote":"by EOD Friday"}],"draftReply":"On it.","confidence":90}' }],
            usage: { input_tokens: 900, output_tokens: 120 },
          }),
          { status: 200 }
        )
      )
    );
    const t = await triageWithClaude(email, { tone: "professional" });
    expect(t).toMatchObject({ category: "action_required", urgencyScore: 91, draftReply: "On it." });
    expect(summarizeAiUsage().byPurpose.triage.calls).toBe(1);
  });
});

describe("cost estimates", () => {
  it("prices known models from the table and unknown ones at the fallback rate", () => {
    expect(estimateUsd("claude-3-5-haiku-latest", 1_000_000, 1_000_000)).toBeCloseTo(4.8);
    expect(estimateUsd("some-future-model", 1_000_000, 0)).toBe(ESTIMATED_FALLBACK_USD_PER_MTOK.input);
  });
});

describe("tone samples", () => {
  it("keeps only the operator's own words from a sent reply", () => {
    expect(stripQuotedReply("Sounds good, Tuesday works.\n\nOn Mon, Oct 5, 2026 Ava wrote:\n> Can we meet?")).toBe("Sounds good, Tuesday works.");
  });
});
