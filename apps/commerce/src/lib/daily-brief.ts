import type { StoredOrder } from "@helix/core";
import { summarizeDeskRisk } from "@helix/core";

export type DailyOpsBrief = {
  date: string;
  highRiskCount: number;
  highRiskUsd: number;
  topOrders: { id: string; label: string; usd: number; fraudScore: number }[];
  savedTodayUsd: number;
  ordersToday: number;
};

function isToday(iso: string, now: number): boolean {
  const t = new Date(iso);
  const n = new Date(now);
  return t.getUTCFullYear() === n.getUTCFullYear() && t.getUTCMonth() === n.getUTCMonth() && t.getUTCDate() === n.getUTCDate();
}

/** "3 high-risk orders, $X on hold" — today's snapshot, not a persisted trend. */
export function summarizeDailyBrief(allOrders: StoredOrder[], now = Date.now()): DailyOpsBrief {
  const today = allOrders.filter((o) => isToday(o.createdAt, now));
  const risk = summarizeDeskRisk(today);

  const highRisk = today
    .filter((o) => o.requiresReview || o.riskLevel === "high" || o.riskLevel === "critical")
    .filter((o) => o.reviewDecision !== "cancelled" && o.reviewDecision !== "approved")
    .sort((a, b) => b.fraudScore - a.fraudScore)
    .slice(0, 3);

  return {
    date: new Date(now).toISOString().slice(0, 10),
    highRiskCount: highRisk.length,
    highRiskUsd: risk.atRiskUsd,
    topOrders: highRisk.map((o) => ({
      id: o.id,
      label: `${o.customerName} (${o.shopifyOrderId.split("/").pop()})`,
      usd: o.totalPrice,
      fraudScore: o.fraudScore,
    })),
    savedTodayUsd: risk.savedUsd,
    ordersToday: today.length,
  };
}

export function formatDailyBriefText(brief: DailyOpsBrief): string {
  const lines = [
    `${brief.date} — ${brief.ordersToday} orders today`,
    brief.highRiskCount > 0
      ? `${brief.highRiskCount} high-risk order${brief.highRiskCount === 1 ? "" : "s"}, $${brief.highRiskUsd.toFixed(2)} on hold`
      : "No high-risk orders today",
    ...brief.topOrders.map((o) => `  • ${o.label} — $${o.usd.toFixed(2)} (score ${o.fraudScore})`),
    brief.savedTodayUsd > 0 ? `$${brief.savedTodayUsd.toFixed(2)} saved today (cancelled fraud)` : "",
  ].filter(Boolean);
  return lines.join("\n");
}
