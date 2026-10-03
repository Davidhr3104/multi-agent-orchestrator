import { describe, expect, it } from "vitest";
import type { ReturnRequest, StoredOrder, StoredProduct } from "@helix/core";
import {
  aggregateCustomers,
  dailyBuckets,
  dailyOpenRiskUsd,
  daysOfCover,
  exposureUsd,
  humanize,
  inventoryValue,
  lifetimeOrders,
  orderNumber,
  pluralize,
  returnStats,
  revenueByProduct,
  riskCounts,
  riskSlices,
  stockStatus,
} from "./commerce-charts";

const NOW = Date.parse("2026-10-02T12:00:00Z");
const DAY = 86_400_000;

function order(over: Partial<StoredOrder> = {}): StoredOrder {
  return {
    id: "o1",
    shopifyOrderId: "gid://shopify/Order/1001",
    customerName: "A",
    customerEmail: "a@x.com",
    totalPrice: 100,
    currency: "USD",
    financialStatus: "paid",
    fulfillmentStatus: "unfulfilled",
    items: [{ title: "Tee", quantity: 2, price: 10 }],
    shippingAddress: {},
    createdAt: new Date(NOW).toISOString(),
    customerOrderCount: 0,
    fraudScore: 50,
    fraudReasoning: "",
    riskLevel: "low",
    requiresReview: false,
    engine: "heuristic",
    demoMode: true,
    shopifySignalApplied: false,
    ...over,
  };
}

describe("formatting helpers", () => {
  it("shortens a Shopify gid to #number", () => {
    expect(orderNumber("gid://shopify/Order/1005")).toBe("#1005");
    expect(orderNumber("abc")).toBe("abc");
  });
  it("pluralizes", () => {
    expect(pluralize(1, "item")).toBe("1 item");
    expect(pluralize(0, "item")).toBe("0 items");
    expect(pluralize(2, "person", "people")).toBe("2 people");
  });
  it("humanizes snake case", () => {
    expect(humanize("return_refund")).toBe("Return refund");
  });
});

describe("risk", () => {
  it("counts and drops empty slices in risk order", () => {
    const orders = [order({ riskLevel: "critical" }), order({ riskLevel: "low" }), order({ riskLevel: "low" })];
    expect(riskCounts(orders)).toEqual({ low: 2, medium: 0, high: 0, critical: 1 });
    expect(riskSlices(orders).map((s) => s.label)).toEqual(["Low", "Critical"]);
  });
  it("weights exposure by fraud score and clamps it", () => {
    expect(exposureUsd({ totalPrice: 200, fraudScore: 50 })).toBe(100);
    expect(exposureUsd({ totalPrice: 200, fraudScore: 250 })).toBe(200);
    expect(exposureUsd({ totalPrice: 200, fraudScore: -5 })).toBe(0);
  });
});

describe("dailyBuckets", () => {
  it("puts today in the last bucket and ignores orders outside the window", () => {
    const orders = [
      order({ createdAt: new Date(NOW - 1 * 3_600_000).toISOString(), totalPrice: 10 }),
      order({ createdAt: new Date(NOW - 2 * DAY).toISOString(), totalPrice: 5 }),
      order({ createdAt: new Date(NOW - 30 * DAY).toISOString(), totalPrice: 999 }),
    ];
    const b = dailyBuckets(orders, 7, NOW);
    expect(b).toHaveLength(7);
    expect(b[6]).toMatchObject({ revenue: 10, orders: 1 });
    expect(b[4]).toMatchObject({ revenue: 5, orders: 1 });
    expect(b.reduce((s, x) => s + x.revenue, 0)).toBe(15);
  });
});

describe("revenueByProduct", () => {
  it("sums price x quantity per title, largest first", () => {
    const rows = revenueByProduct([
      order({ items: [{ title: "Tee", quantity: 2, price: 10 }] }),
      order({ items: [{ title: "Bag", quantity: 1, price: 100 }, { title: "Tee", quantity: 1, price: 10 }] }),
    ]);
    expect(rows).toEqual([
      { label: "Bag", value: 100, units: 1 },
      { label: "Tee", value: 30, units: 3 },
    ]);
  });
});

describe("customers", () => {
  it("never reports fewer lifetime orders than the order being viewed", () => {
    expect(lifetimeOrders({ customerOrderCount: 0 })).toBe(1);
    expect(lifetimeOrders({ customerOrderCount: 6 })).toBe(6);
  });
  it("segments by lifetime orders and sorts by spend", () => {
    const rows = aggregateCustomers([
      order({ customerEmail: "a@x.com", customerOrderCount: 6, totalPrice: 50 }),
      order({ customerEmail: "b@x.com", customerOrderCount: 0, totalPrice: 500 }),
      order({ customerEmail: "c@x.com", customerOrderCount: 0, totalPrice: 5 }),
      order({ customerEmail: "c@x.com", customerOrderCount: 0, totalPrice: 5 }),
    ]);
    expect(rows.map((r) => r.email)).toEqual(["b@x.com", "a@x.com", "c@x.com"]);
    expect(rows.find((r) => r.email === "a@x.com")?.segment).toBe("returning");
    expect(rows.find((r) => r.email === "b@x.com")?.segment).toBe("new");
    expect(rows.find((r) => r.email === "c@x.com")?.segment).toBe("returning");
  });
});

describe("stock", () => {
  const p = (inv: number, rp: number, v: number, price = 10) =>
    ({ currentInventory: inv, reorderPoint: rp, salesVelocity: v, price }) as StoredProduct;
  it("classifies stock", () => {
    expect(stockStatus(p(0, 5, 1))).toBe("out");
    expect(stockStatus(p(5, 5, 1))).toBe("low");
    expect(stockStatus(p(6, 5, 1))).toBe("ok");
  });
  it("gives days of cover only when something is selling", () => {
    expect(daysOfCover(p(10, 5, 2))).toBe(5);
    expect(daysOfCover(p(10, 5, 0))).toBeNull();
  });
  it("values inventory without going negative", () => {
    expect(inventoryValue(p(3, 1, 1, 10))).toBe(30);
    expect(inventoryValue(p(-3, 1, 1, 10))).toBe(0);
  });
});

describe("returnStats", () => {
  const r = (status: ReturnRequest["status"], amt: number) => ({ status, refundAmount: amt }) as ReturnRequest;
  it("computes rate and totals", () => {
    const s = returnStats([r("requested", 10), r("refunded", 40), r("rejected", 99)], 10);
    expect(s).toEqual({ count: 3, refundUsd: 40, pendingUsd: 10, ratePct: 30 });
  });
  it("has no rate without orders", () => {
    expect(returnStats([], 0).ratePct).toBeNull();
  });
});

describe("dailyOpenRiskUsd", () => {
  it("counts only open high-risk orders on the day they were placed", () => {
    const series = dailyOpenRiskUsd(
      [
        order({ riskLevel: "critical", totalPrice: 300 }),
        order({ riskLevel: "high", totalPrice: 100, reviewDecision: "cancelled" }),
        order({ riskLevel: "low", totalPrice: 50 }),
        order({ riskLevel: "high", totalPrice: 20, createdAt: new Date(NOW - DAY).toISOString() }),
      ],
      3,
      NOW
    );
    expect(series).toEqual([0, 20, 300]);
  });
});
