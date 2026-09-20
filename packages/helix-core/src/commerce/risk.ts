import type { StoredOrder } from "./types";

function round(n: number): number {
  return Math.round(n * 100) / 100;
}

export type DeskRiskSummary = {
  totalOrderUsd: number;
  /** High/critical (or requiresReview) still waiting on HITL — money exposed. */
  atRiskUsd: number;
  pendingReviewCount: number;
  /** Cancelled after review — fraud blocked before ship. */
  savedUsd: number;
  cancelledCount: number;
  /** Flagged / held — not cancelled, not fulfilled. */
  flaggedUsd: number;
  flaggedCount: number;
  /** Approved despite high/critical risk. */
  approvedHighRiskUsd: number;
  approvedHighRiskCount: number;
  worstOrderId: string | null;
  worstOrderLabel: string | null;
  worstOrderUsd: number;
  worstFraudScore: number;
};

function isHighRisk(order: StoredOrder): boolean {
  return (
    order.requiresReview ||
    order.riskLevel === "high" ||
    order.riskLevel === "critical" ||
    order.fraudScore >= 50
  );
}

function openAtRisk(order: StoredOrder): boolean {
  if (!isHighRisk(order)) return false;
  if (order.reviewDecision === "cancelled") return false;
  if (order.reviewDecision === "approved") return false;
  if (order.fulfillmentStatus === "cancelled") return false;
  // pending HITL or flagged hold
  return order.requiresReview || order.reviewDecision === "flagged" || !order.reviewDecision;
}

/** Desk-level $ at risk / $ saved story for Commerce. */
export function summarizeDeskRisk(orders: StoredOrder[]): DeskRiskSummary {
  const totalOrderUsd = round(orders.reduce((s, o) => s + o.totalPrice, 0));

  const pending = orders.filter(
    (o) => openAtRisk(o) && o.reviewDecision !== "flagged"
  );
  const flagged = orders.filter((o) => o.reviewDecision === "flagged");
  const cancelled = orders.filter(
    (o) => o.reviewDecision === "cancelled" || o.fulfillmentStatus === "cancelled"
  );
  const approvedHigh = orders.filter(
    (o) => o.reviewDecision === "approved" && isHighRisk(o)
  );

  const atRiskUsd = round(
    [...pending, ...flagged].reduce((s, o) => s + o.totalPrice, 0)
  );
  const savedUsd = round(cancelled.reduce((s, o) => s + o.totalPrice, 0));
  const flaggedUsd = round(flagged.reduce((s, o) => s + o.totalPrice, 0));
  const approvedHighRiskUsd = round(approvedHigh.reduce((s, o) => s + o.totalPrice, 0));

  let worst: StoredOrder | null = null;
  for (const o of orders.filter(openAtRisk)) {
    if (
      !worst ||
      o.fraudScore > worst.fraudScore ||
      (o.fraudScore === worst.fraudScore && o.totalPrice > worst.totalPrice)
    ) {
      worst = o;
    }
  }

  return {
    totalOrderUsd,
    atRiskUsd,
    pendingReviewCount: pending.length,
    savedUsd,
    cancelledCount: cancelled.length,
    flaggedUsd,
    flaggedCount: flagged.length,
    approvedHighRiskUsd,
    approvedHighRiskCount: approvedHigh.length,
    worstOrderId: worst?.id ?? null,
    worstOrderLabel: worst
      ? `${worst.shopifyOrderId} · ${worst.customerName}`
      : null,
    worstOrderUsd: worst?.totalPrice ?? 0,
    worstFraudScore: worst?.fraudScore ?? 0,
  };
}
