import type { DeskWasteSummary, StoredCampaign } from "./types";

function round(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Desk-level “$ spent on spam” story for Marketing. */
export function summarizeDeskWaste(campaigns: StoredCampaign[]): DeskWasteSummary {
  const totalSpend = round(campaigns.reduce((s, c) => s + c.spend, 0));
  const spendOnSpam = round(campaigns.reduce((s, c) => s + c.metrics.spendOnSpam, 0));
  const nSpam = campaigns.reduce((s, c) => s + c.metrics.nSpam, 0);
  const nHot = campaigns.reduce((s, c) => s + c.metrics.nHot, 0);
  const nLeads = campaigns.reduce((s, c) => s + c.metrics.nLeads, 0);
  const wastePct = totalSpend <= 0 ? 0 : round(spendOnSpam / totalSpend);
  const costPerHot = nHot > 0 ? round(totalSpend / nHot) : null;
  const hotShare = nLeads === 0 ? 0 : nHot / nLeads;
  const spendOnHotShare = round(totalSpend * hotShare);

  let worst: StoredCampaign | null = null;
  for (const c of campaigns) {
    if (!worst || c.metrics.spendOnSpam > worst.metrics.spendOnSpam) worst = c;
  }

  return {
    totalSpend,
    spendOnSpam,
    spendOnHotShare,
    wastePct,
    nSpam,
    nHot,
    nLeads,
    costPerHot,
    worstCampaignId: worst?.campaignId ?? null,
    worstCampaignName: worst?.name ?? null,
    worstSpendOnSpam: worst?.metrics.spendOnSpam ?? 0,
  };
}
