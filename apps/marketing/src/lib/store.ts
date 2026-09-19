import {
  runCampaignPipeline,
  type AttributedLead,
  type CampaignStatus,
  type SpendRowInput,
  type StoredCampaign,
} from "@helix/core";

const campaigns = new Map<string, StoredCampaign>();
const leads: AttributedLead[] = [];
let seeded = false;

const SAMPLE_SPEND: SpendRowInput[] = [
  {
    campaignId: "ad-a-volume",
    name: "Ad A — volume HVAC",
    platform: "meta",
    spend: 2400,
    impressions: 180000,
    clicks: 4200,
    formLeads: 120,
  },
  {
    campaignId: "ad-b-quality",
    name: "Ad B — quality HVAC",
    platform: "meta",
    spend: 380,
    impressions: 22000,
    clicks: 640,
    formLeads: 22,
  },
  {
    campaignId: "ad-c-mid",
    name: "Ad C — search mix",
    platform: "google",
    spend: 910,
    impressions: 41000,
    clicks: 980,
    formLeads: 34,
  },
  {
    campaignId: "ad-d-thin",
    name: "Ad D — new creative",
    platform: "other",
    spend: 90,
    impressions: 4000,
    clicks: 80,
    formLeads: 3,
  },
];

function makeLeads(): AttributedLead[] {
  const rows: AttributedLead[] = [];
  for (let i = 0; i < 20; i += 1) {
    rows.push({
      id: `lead-a-${i}`,
      campaignId: "ad-a-volume",
      name: `Form ${i + 1}`,
      email: `volume${i}@spam.example`,
      classification: i < 9 ? "spam" : "info",
      score: 18 + (i % 10),
      tier: "cold",
      confidence: 0.74,
    });
  }
  for (let i = 0; i < 8; i += 1) {
    rows.push({
      id: `lead-b-${i}`,
      campaignId: "ad-b-quality",
      name: `Maya ${i + 1}`,
      email: `hot${i}@northwindhvac.example`,
      classification: "lead",
      score: 78 + i,
      tier: "hot",
      confidence: 0.84,
    });
  }
  for (let i = 0; i < 10; i += 1) {
    const score = 48 + i * 2;
    rows.push({
      id: `lead-c-${i}`,
      campaignId: "ad-c-mid",
      name: `Mix ${i + 1}`,
      email: `mix${i}@example.com`,
      classification: score >= 75 ? "lead" : "info",
      score,
      tier: score >= 75 ? "hot" : score >= 50 ? "warm" : "cold",
      confidence: 0.6,
    });
  }
  rows.push({
    id: "lead-d-1",
    campaignId: "ad-d-thin",
    name: "Jordan",
    email: "jordan@bookedjobs.example",
    classification: "lead",
    score: 71,
    tier: "warm",
    confidence: 0.55,
  });
  return rows;
}

function seedIfNeeded() {
  if (seeded) return;
  seeded = true;
  leads.splice(0, leads.length, ...makeLeads());
  for (const spend of SAMPLE_SPEND) {
    const campaign = runCampaignPipeline(spend, leads);
    campaign.id = `seed-${spend.campaignId}`;
    campaigns.set(campaign.id, campaign);
  }
}

export function listCampaigns(): StoredCampaign[] {
  seedIfNeeded();
  return [...campaigns.values()].sort((a, b) => a.name.localeCompare(b.name));
}

export function listLeads(): AttributedLead[] {
  seedIfNeeded();
  return [...leads];
}

export function getCampaign(id: string): StoredCampaign | null {
  seedIfNeeded();
  return campaigns.get(id) ?? null;
}

export function ingestSpend(rows: SpendRowInput[]): StoredCampaign[] {
  seedIfNeeded();
  const created: StoredCampaign[] = [];
  for (const row of rows) {
    const existing = [...campaigns.values()].find((c) => c.campaignId === row.campaignId);
    const next = runCampaignPipeline(row, leads);
    if (existing) {
      next.id = existing.id;
      next.status = existing.status.startsWith("pause") || existing.status === "paused"
        ? existing.status
        : next.status;
    }
    campaigns.set(next.id, next);
    created.push(next);
  }
  return created;
}

export function reviewCampaign(
  id: string,
  action: "pause" | "scale" | "keep",
  note?: string
): StoredCampaign | null {
  const current = getCampaign(id);
  if (!current) return null;
  const status: CampaignStatus =
    action === "pause" ? "paused" : action === "scale" ? "scale_recommended" : "active";
  const next: StoredCampaign = {
    ...current,
    action,
    status,
    needsReview: false,
    hitlNote: note?.trim() || current.hitlNote,
  };
  campaigns.set(id, next);
  return next;
}
