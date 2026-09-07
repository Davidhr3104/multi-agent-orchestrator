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
});
