import { describe, expect, it } from "vitest";
import { scoreCampaignHeuristic } from "./heuristic";
import { parseSpendCsv } from "./spendCsv";
import type { AttributedLead } from "./types";

const trashLeads: AttributedLead[] = Array.from({ length: 20 }, (_, i) => ({
  id: `a-${i}`,
  campaignId: "ad-a-volume",
  name: `Lead ${i}`,
  email: `a${i}@example.com`,
  classification: i < 8 ? "spam" : "info",
  score: 20 + (i % 8),
  tier: "cold" as const,
  confidence: 0.7,
}));

const qualityLeads: AttributedLead[] = Array.from({ length: 8 }, (_, i) => ({
  id: `b-${i}`,
  campaignId: "ad-b-quality",
  name: `Hot ${i}`,
  email: `b${i}@hvac.example`,
  classification: "lead" as const,
  score: 78 + i,
  tier: "hot" as const,
  confidence: 0.8,
}));

describe("scoreCampaignHeuristic", () => {
  it("pauses high-volume low-score campaigns (catalog ad A)", () => {
    const result = scoreCampaignHeuristic(
      { campaignId: "ad-a-volume", name: "Ad A volume", platform: "meta", spend: 2400, formLeads: 120 },
      trashLeads
    );
    expect(result.action).toBe("pause");
    expect(result.metrics.avgScore).toBeLessThan(40);
  });

  it("scales high-score affordable hot campaigns (catalog ad B)", () => {
    const result = scoreCampaignHeuristic(
      { campaignId: "ad-b-quality", name: "Ad B quality", platform: "meta", spend: 380, formLeads: 22 },
      qualityLeads
    );
    expect(result.action).toBe("scale");
    expect(result.metrics.nHot).toBeGreaterThanOrEqual(3);
  });
});

describe("parseSpendCsv", () => {
  it("parses campaign_id and spend", () => {
    const rows = parseSpendCsv(`campaign_id,name,platform,spend,form_leads
ad-a-volume,Ad A volume,meta,2400,120
`);
    expect(Array.isArray(rows)).toBe(true);
    if (!Array.isArray(rows)) return;
    expect(rows[0].campaignId).toBe("ad-a-volume");
    expect(rows[0].spend).toBe(2400);
    expect(rows[0].formLeads).toBe(120);
  });
});
