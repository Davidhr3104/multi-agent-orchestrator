import { describe, expect, it } from "vitest";
import { joinCampaignMetrics, scoreCampaignHeuristic } from "./heuristic";
import { summarizeDeskWaste } from "./waste";
import type { AttributedLead, StoredCampaign } from "./types";

const trashLeads: AttributedLead[] = Array.from({ length: 20 }, (_, i) => ({
  id: `a-${i}`,
  campaignId: "ad-a-volume",
  name: `Lead ${i}`,
  email: `a${i}@example.com`,
  classification: i < 8 ? "spam" : "info",
  score: 20 + (i % 8),
  tier: "cold" as const,
  confidence: 0.7,
  createdAt: "2026-09-18",
}));

describe("spendOnSpam metrics", () => {
  it("attributes spend proportional to spam rate", () => {
    const metrics = joinCampaignMetrics(
      { campaignId: "ad-a-volume", name: "Ad A", platform: "meta", spend: 1000, formLeads: 100 },
      trashLeads
    );
    expect(metrics.nSpam).toBe(8);
    expect(metrics.spamRate).toBe(0.4);
    expect(metrics.spendOnSpam).toBe(400);
  });

  it("summarizes desk waste and flags the worst campaign", () => {
    const scored = scoreCampaignHeuristic(
      { campaignId: "ad-a-volume", name: "Ad A volume", platform: "meta", spend: 2400, formLeads: 120 },
      trashLeads
    );
    const campaign: StoredCampaign = {
      ...scored,
      id: "camp-ad-a-volume",
      campaignId: "ad-a-volume",
      name: "Ad A volume",
      platform: "meta",
      spend: 2400,
      formLeads: 120,
      createdAt: "2026-09-18",
      runId: "test",
      status: "pause_recommended",
    };
    const waste = summarizeDeskWaste([campaign]);
    expect(waste.spendOnSpam).toBeGreaterThan(0);
    expect(waste.worstCampaignId).toBe("ad-a-volume");
    expect(waste.wastePct).toBeGreaterThan(0);
  });
});
