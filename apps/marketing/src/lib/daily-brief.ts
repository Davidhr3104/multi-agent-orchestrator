import type { DeskSnapshot } from "@/lib/store";

export type DailyMarketingBrief = {
  date: string;
  todaySpend: number;
  wastePct: number;
  spendOnSpam: number;
  costPerHot: number | null;
  topWasteCampaign: { name: string; spendOnSpam: number } | null;
  campaignsNeedingReview: number;
};

/** "yesterday you burned $X across N campaigns" — today's snapshot, not a persisted trend. */
export function summarizeDailyBrief(snapshot: DeskSnapshot, now = Date.now()): DailyMarketingBrief {
  const today = new Date(now).toISOString().slice(0, 10);
  const todaySpend = snapshot.series.find((s) => s.day === today)?.spend ?? 0;
  const needsReview = snapshot.campaigns.filter((c) => c.needsReview).length;

  return {
    date: today,
    todaySpend,
    wastePct: snapshot.waste.wastePct,
    spendOnSpam: snapshot.waste.spendOnSpam,
    costPerHot: snapshot.waste.costPerHot,
    topWasteCampaign: snapshot.waste.worstCampaignName
      ? { name: snapshot.waste.worstCampaignName, spendOnSpam: snapshot.waste.worstSpendOnSpam }
      : null,
    campaignsNeedingReview: needsReview,
  };
}

export function formatDailyBriefText(brief: DailyMarketingBrief): string {
  const lines = [
    `${brief.date} — $${brief.todaySpend.toFixed(2)} spent today`,
    `${(brief.wastePct * 100).toFixed(0)}% of 7d spend on spam ($${brief.spendOnSpam.toFixed(2)})`,
    brief.costPerHot !== null ? `Cost per hot lead: $${brief.costPerHot.toFixed(2)}` : "No hot leads in window",
    brief.topWasteCampaign
      ? `  • Worst offender: ${brief.topWasteCampaign.name} — $${brief.topWasteCampaign.spendOnSpam.toFixed(2)} on spam`
      : "",
    brief.campaignsNeedingReview > 0
      ? `${brief.campaignsNeedingReview} campaign${brief.campaignsNeedingReview === 1 ? "" : "s"} awaiting HITL review`
      : "No campaigns awaiting review",
  ].filter(Boolean);
  return lines.join("\n");
}
