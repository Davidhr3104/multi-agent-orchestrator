import type { AdPlatform, AttributedLead, SpendEvent } from "./types";
import { addUtcDays, utcDay } from "./window";

function id(prefix: string, key: string): string {
  return `${prefix}-${key}`;
}

export function buildMarketingSeed(now: Date = new Date()): {
  spend: SpendEvent[];
  leads: AttributedLead[];
} {
  const today = utcDay(now);
  const spend: SpendEvent[] = [];
  const leads: AttributedLead[] = [];

  function pushSpend(
    campaignId: string,
    name: string,
    platform: AdPlatform,
    ago: number,
    row: { spend: number; impressions: number; clicks: number; formLeads: number }
  ) {
    const occurredAt = addUtcDays(today, -ago);
    spend.push({
      id: id("sp", `${campaignId}-${occurredAt}`),
      campaignId,
      name,
      platform,
      occurredAt,
      ...row,
    });
  }

  for (let ago = 0; ago < 90; ago += 1) {
    const recent = ago < 14 ? 1.35 : 1;
    pushSpend("ad-a-volume", "Ad A — volume HVAC", "meta", ago, {
      spend: Math.round(22 * recent * 100) / 100,
      impressions: Math.round(1800 * recent),
      clicks: Math.round(42 * recent),
      formLeads: ago % 2 === 0 ? 2 : 1,
    });
    pushSpend("ad-b-quality", "Ad B — quality HVAC", "meta", ago, {
      spend: 4.2,
      impressions: 240,
      clicks: 7,
      formLeads: ago % 8 === 0 ? 1 : 0,
    });
    pushSpend("ad-c-mid", "Ad C — search mix", "google", ago, {
      spend: 10.1,
      impressions: 450,
      clicks: 11,
      formLeads: ago % 5 === 0 ? 1 : 0,
    });
    if (ago < 4) {
      pushSpend("ad-d-thin", "Ad D — new creative", "other", ago, {
        spend: 22.5,
        impressions: 1000,
        clicks: 20,
        formLeads: 1,
      });
    }
    if (ago % 3 === 0) {
      pushSpend("ad-e-orphan", "Ad E — unmatched UTM", "meta", ago, {
        spend: 18,
        impressions: 900,
        clicks: 15,
        formLeads: 2,
      });
    }
  }

  for (let i = 0; i < 20; i += 1) {
    const ago = (i * 3) % 60;
    leads.push({
      id: `lead-a-${i}`,
      campaignId: "ad-a-volume",
      name: `Form ${i + 1}`,
      email: `volume${i}@spam.example`,
      classification: i < 9 ? "spam" : "info",
      score: 18 + (i % 10),
      tier: "cold",
      confidence: 0.74,
      createdAt: addUtcDays(today, -ago),
    });
  }
  for (let i = 0; i < 8; i += 1) {
    const ago = 4 + i * 10;
    leads.push({
      id: `lead-b-${i}`,
      campaignId: "ad-b-quality",
      name: `Maya ${i + 1}`,
      email: `hot${i}@northwindhvac.example`,
      classification: "lead",
      score: 78 + i,
      tier: "hot",
      confidence: 0.84,
      createdAt: addUtcDays(today, -ago),
    });
  }
  for (let i = 0; i < 10; i += 1) {
    const score = 48 + i * 2;
    const ago = 16 + i * 2;
    leads.push({
      id: `lead-c-${i}`,
      campaignId: "ad-c-mid",
      name: `Mix ${i + 1}`,
      email: `mix${i}@example.com`,
      classification: score >= 75 ? "lead" : "info",
      score,
      tier: score >= 75 ? "hot" : score >= 50 ? "warm" : "cold",
      confidence: 0.6,
      createdAt: addUtcDays(today, -ago),
    });
  }
  leads.push({
    id: "lead-d-1",
    campaignId: "ad-d-thin",
    name: "Jordan",
    email: "jordan@bookedjobs.example",
    classification: "lead",
    score: 71,
    tier: "warm",
    confidence: 0.55,
    createdAt: addUtcDays(today, -1),
  });

  return { spend, leads };
}
