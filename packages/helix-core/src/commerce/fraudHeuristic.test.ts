import { describe, expect, it } from "vitest";
import { scoreFraudHeuristic } from "./fraudHeuristic";
import type { OrderInput } from "./types";

function baseOrder(overrides: Partial<OrderInput> = {}): OrderInput {
  return {
    shopifyOrderId: "1001",
    customerName: "Jane Doe",
    customerEmail: "jane@example.com",
    totalPrice: 85,
    currency: "USD",
    financialStatus: "paid",
    fulfillmentStatus: "unfulfilled",
    items: [{ title: "T-Shirt", quantity: 1, price: 85 }],
    shippingAddress: {
      name: "Jane Doe",
      address1: "123 Main St",
      city: "Austin",
      province: "TX",
      country: "US",
      zip: "78701",
    },
    createdAt: new Date().toISOString(),
    customerOrderCount: 3,
    ...overrides,
  };
}

describe("scoreFraudHeuristic", () => {
  it("scores a normal repeat-customer order as low risk", () => {
    const result = scoreFraudHeuristic(baseOrder());
    expect(result.riskLevel).toBe("low");
    expect(result.requiresReview).toBe(false);
    expect(result.engine).toBe("heuristic");
    expect(result.demoMode).toBe(true);
  });

  it("flags a first-time high-value order with mismatched name as high/critical risk", () => {
    const result = scoreFraudHeuristic(
      baseOrder({
        customerName: "Jane Doe",
        totalPrice: 2400,
        customerOrderCount: 0,
        shippingAddress: {
          name: "Someone Else",
          address1: "999 Other Ave",
          city: "Miami",
          province: "FL",
          country: "US",
          zip: "33101",
        },
      })
    );
    expect(["high", "critical"]).toContain(result.riskLevel);
    expect(result.requiresReview).toBe(true);
  });

  it("flags missing shipping address as at least medium risk", () => {
    const result = scoreFraudHeuristic(
      baseOrder({ shippingAddress: {}, customerOrderCount: 0 })
    );
    expect(["medium", "high", "critical"]).toContain(result.riskLevel);
  });

  it("never returns a fraud score outside 0-100", () => {
    const result = scoreFraudHeuristic(baseOrder({ totalPrice: 999999, customerOrderCount: 0 }));
    expect(result.fraudScore).toBeGreaterThanOrEqual(0);
    expect(result.fraudScore).toBeLessThanOrEqual(100);
  });

  it("always requires review for critical risk", () => {
    const result = scoreFraudHeuristic(
      baseOrder({
        totalPrice: 5000,
        customerOrderCount: 0,
        shippingAddress: {},
        customerName: "A B",
      })
    );
    if (result.riskLevel === "critical") {
      expect(result.requiresReview).toBe(true);
    }
  });

  it("marks shopifySignalApplied false and unaffected when no Shopify risk data exists", () => {
    const result = scoreFraudHeuristic(baseOrder());
    expect(result.shopifySignalApplied).toBe(false);
  });

  it("escalates a normally-low-risk order to review when Shopify recommends cancel", () => {
    const clean = scoreFraudHeuristic(baseOrder());
    const flagged = scoreFraudHeuristic(
      baseOrder({
        shopifyRisks: [
          { recommendation: "cancel", score: 0.9, message: "Stolen card suspected", source: "Shopify Protect" },
        ],
      })
    );
    expect(flagged.shopifySignalApplied).toBe(true);
    expect(flagged.fraudScore).toBeGreaterThan(clean.fraudScore);
    expect(flagged.requiresReview).toBe(true);
    expect(flagged.fraudReasoning).toContain("Shopify Protect");
    expect(flagged.fraudReasoning).toContain("CANCEL");
  });

  it("uses the worst of multiple Shopify risk signals", () => {
    const result = scoreFraudHeuristic(
      baseOrder({
        shopifyRisks: [
          { recommendation: "accept", score: 0.1, message: "ok", source: "Shopify" },
          { recommendation: "cancel", score: 0.95, message: "high risk", source: "Shopify Protect" },
        ],
      })
    );
    expect(result.fraudReasoning).toContain("CANCEL");
  });

  it("does not push a low-value repeat-customer order to requiresReview on an 'accept' Shopify signal", () => {
    const result = scoreFraudHeuristic(
      baseOrder({
        shopifyRisks: [{ recommendation: "accept", score: 0.05, message: "low risk", source: "Shopify" }],
      })
    );
    expect(result.shopifySignalApplied).toBe(true);
    expect(result.requiresReview).toBe(false);
  });
});
