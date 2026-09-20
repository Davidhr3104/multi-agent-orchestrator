import { describe, expect, it } from "vitest";
import { summarizeDeskRisk } from "./risk";
import type { StoredOrder } from "./types";

function order(partial: Partial<StoredOrder> & Pick<StoredOrder, "id" | "totalPrice" | "fraudScore">): StoredOrder {
  return {
    shopifyOrderId: partial.shopifyOrderId ?? `#${partial.id}`,
    customerName: partial.customerName ?? "Test",
    customerEmail: partial.customerEmail ?? "t@example.com",
    currency: "USD",
    financialStatus: "paid",
    fulfillmentStatus: partial.fulfillmentStatus ?? "unfulfilled",
    items: [],
    shippingAddress: {},
    createdAt: "2026-09-18T12:00:00.000Z",
    customerOrderCount: 0,
    fraudReasoning: "test",
    riskLevel: partial.riskLevel ?? (partial.fraudScore >= 75 ? "critical" : partial.fraudScore >= 50 ? "high" : "low"),
    requiresReview: partial.requiresReview ?? partial.fraudScore >= 50,
    engine: "heuristic",
    demoMode: true,
    ...partial,
  };
}

describe("summarizeDeskRisk", () => {
  it("counts pending high-risk as atRisk and cancelled as saved", () => {
    const summary = summarizeDeskRisk([
      order({ id: "1", totalPrice: 400, fraudScore: 80, requiresReview: true }),
      order({
        id: "2",
        totalPrice: 250,
        fraudScore: 90,
        requiresReview: false,
        reviewDecision: "cancelled",
        fulfillmentStatus: "cancelled",
      }),
      order({ id: "3", totalPrice: 50, fraudScore: 10, requiresReview: false }),
    ]);
    expect(summary.atRiskUsd).toBe(400);
    expect(summary.savedUsd).toBe(250);
    expect(summary.pendingReviewCount).toBe(1);
    expect(summary.cancelledCount).toBe(1);
    expect(summary.worstOrderId).toBe("1");
  });
});
