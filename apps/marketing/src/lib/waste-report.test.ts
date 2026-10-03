import { mkdtempSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { runCampaignPipeline, type AttributedLead, type SpendEvent, type StoredCampaign } from "@helix/core";
import { getAiUsageTotals, resetAiUsage } from "./ai-usage";
import {
  buildProposals,
  computeWasteMetrics,
  deterministicNarrative,
  explainWithClaude,
  findUnverifiedNumbers,
} from "./waste-report";

process.env.HELIX_MARKETING_DATA_DIR = mkdtempSync(path.join(os.tmpdir(), "helix-mkt-waste-"));

const DAY = "2026-09-30T12:00:00.000Z";

function leads(campaignId: string, spec: { spam: number; good: number; tier?: AttributedLead["tier"]; score?: number }): AttributedLead[] {
  const out: AttributedLead[] = [];
  for (let i = 0; i < spec.spam; i++) {
    out.push({ id: `${campaignId}-s${i}`, campaignId, name: "x", email: "x@yopmail.com", classification: "spam", score: 5, tier: "cold", confidence: 0.9, createdAt: DAY });
  }
  for (let i = 0; i < spec.good; i++) {
    out.push({ id: `${campaignId}-g${i}`, campaignId, name: "y", email: "y@acme.com", classification: "lead", score: spec.score ?? 50, tier: spec.tier ?? "warm", confidence: 0.9, createdAt: DAY });
  }
  return out;
}

function campaign(campaignId: string, name: string, spend: number, l: AttributedLead[], platform: "meta" | "google" = "meta"): StoredCampaign {
  return runCampaignPipeline({ campaignId, name, platform, spend }, l);
}

const A = campaign("111", "Spam farm", 500, leads("111", { spam: 6, good: 4, score: 30, tier: "cold" }));
const B = campaign("222", "Quality search", 300, leads("222", { spam: 0, good: 10, score: 85, tier: "hot" }), "google");
const C = campaign("333", "Thin test", 100, leads("333", { spam: 0, good: 2 }));
const unmatched: SpendEvent[] = [{ id: "api-meta-444-2026-09-30", campaignId: "444", name: "No leads yet", platform: "meta", spend: 50, occurredAt: "2026-09-30" }];
const snapshot = { window: "7d" as const, from: "2026-09-24", to: "2026-09-30", campaigns: [C, B, A], unmatched };

beforeEach(() => resetAiUsage());
afterEach(() => vi.unstubAllEnvs());

describe("waste metrics (computed in code)", () => {
  it("joins spend with lead quality: spam share, spend on spam, cost per good lead", () => {
    const m = computeWasteMetrics(snapshot);
    expect(m.totalSpend).toBe(900);
    expect(m.spendOnSpam).toBe(300);
    expect(m.wastePct).toBe(0.33);
    expect(m.nGood).toBe(16);
    expect(m.blendedCostPerGoodLead).toBe(56.25);
    expect(m.unjudgedSpend).toBe(50);
    expect(m.unjudgedCampaigns).toBe(1);

    const [first] = m.campaigns;
    expect(first.campaignId).toBe("111");
    expect(first.spamShare).toBe(0.6);
    expect(first.spendOnSpam).toBe(300);
    expect(first.costPerGoodLead).toBe(125);
    expect(first.flags).toEqual(["spam_heavy", "expensive_good_leads"]);
    expect(m.campaigns.find((c) => c.campaignId === "333")?.wasteful).toBe(false);
    expect(m.bySource).toEqual([
      { source: "meta", label: "Meta Ads", spend: 600, spendOnSpam: 300, campaigns: 2 },
      { source: "google", label: "Google Ads", spend: 300, spendOnSpam: 0, campaigns: 1 },
    ]);
  });

  it("never calls unjudged spend waste and explains without AI", () => {
    const text = deterministicNarrative(computeWasteMetrics(snapshot));
    expect(text.summary).toContain("$300.00 of $900.00 (33%)");
    expect(text.summary).toContain("$50.00 on 1 campaign(s) has no scored leads yet and is not judged");
    expect(text.campaigns.map((c) => c.campaignId)).toEqual(["111"]);
  });

  it("proposes pause for waste and scale for quality — always as 'confirm', never executed", async () => {
    const proposals = await buildProposals(computeWasteMetrics(snapshot));
    expect(proposals.map((p) => [p.action, p.campaignId, p.risk])).toEqual([
      ["pause_campaign", "111", "confirm"],
      ["scale_campaign", "222", "confirm"],
    ]);
    expect(proposals[0].riskReasons.join(" ")).toMatch(/sign-off/);
  });

  it("does not re-propose what a person already decided", async () => {
    const proposals = await buildProposals(computeWasteMetrics(snapshot, new Map([["111", "pause" as const]])));
    expect(proposals.map((p) => p.campaignId)).toEqual(["222"]);
  });
});

describe("Claude explanation", () => {
  it("is skipped without a key (no network call)", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "");
    const fetchMock = vi.fn();
    expect(await explainWithClaude(computeWasteMetrics(snapshot), fetchMock as unknown as typeof fetch)).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("keeps only known campaigns, flags invented numbers, and records estimated cost", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "sk-ant-test");
    const answer = {
      summary: "$300 of $900 went to spam (33%).",
      campaigns: [
        { campaignId: "111", why: "60% of its 10 leads were spam; $125 per good lead vs $56.25. It could save 999 dollars." },
        { campaignId: "zzz", why: "Invented campaign." },
      ],
    };
    const fetchMock = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body));
      expect(body.model).toBe("claude-sonnet-4-20250514");
      expect(body.messages[0].content).toContain('"spendOnSpam":300');
      return new Response(
        JSON.stringify({ content: [{ type: "text", text: JSON.stringify(answer) }], usage: { input_tokens: 1200, output_tokens: 300 } }),
        { status: 200 }
      );
    });
    const ai = await explainWithClaude(computeWasteMetrics(snapshot), fetchMock as unknown as typeof fetch);
    expect(ai?.narrative.campaigns.map((c) => c.campaignId)).toEqual(["111"]);
    expect(ai?.unverified).toEqual(["999"]);
    const totals = getAiUsageTotals();
    expect(totals).toMatchObject({ calls: 1, inputTokens: 1200, outputTokens: 300, estimatedUsd: 0.0081, isEstimate: true });
  });

  it("returns null on an API error so the deterministic text is used", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "sk-ant-test");
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ error: { type: "authentication_error" } }), { status: 401 }));
    expect(await explainWithClaude(computeWasteMetrics(snapshot), fetchMock as unknown as typeof fetch)).toBeNull();
    expect(getAiUsageTotals().calls).toBe(0);
  });

  it("number check accepts formatted metrics", () => {
    expect(findUnverifiedNumbers("$1,250.00 and 45% and 56.25", { a: 1250, b: 0.45, c: 56.25 })).toEqual([]);
  });
});
