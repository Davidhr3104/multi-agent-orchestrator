import { describe, expect, it } from "vitest";
import { suggestReorderQuantity as coreSuggest, type ReorderRequest, type StoredOrder, type StoredProduct } from "@helix/core";
import { RESTOCK_COVERAGE_DAYS as CORE_COVERAGE, RESTOCK_LEAD_DAYS as CORE_LEAD, skuKey as coreSkuKey } from "./restock";
import {
  RESTOCK_COVERAGE_DAYS,
  RESTOCK_LEAD_DAYS,
  coverDays,
  depletionTrajectory,
  estimatedStockoutDate,
  healthTier,
  ordersForProduct,
  reordersForProduct,
  inventoryCsv,
  openReorderFor,
  reorderSuggestion,
  revenueAtRisk,
  shortfallUnits,
  skuKey,
  suggestReorderQuantity,
  summarizeInventory,
  targetPct,
  targetStock,
} from "./inventory-metrics";

const NOW = Date.parse("2026-10-03T12:00:00Z");
const DAY = 86_400_000;

function product(over: Partial<StoredProduct> = {}): StoredProduct {
  return {
    id: "p1",
    shopifyProductId: "gid://shopify/Product/1",
    title: "Tee",
    sku: "TEE-001",
    currentInventory: 100,
    reorderPoint: 20,
    price: 10,
    salesVelocity: 2,
    predictedStockoutDays: 50,
    restockRecommended: false,
    reasoning: "",
    engine: "heuristic",
    demoMode: true,
    ...over,
  };
}

function order(over: Partial<StoredOrder> = {}): StoredOrder {
  return {
    id: "o1",
    shopifyOrderId: "gid://shopify/Order/1",
    customerName: "A",
    customerEmail: "a@x.com",
    totalPrice: 20,
    currency: "USD",
    financialStatus: "paid",
    fulfillmentStatus: "unfulfilled",
    items: [{ title: "Tee", sku: "TEE-001", quantity: 2, price: 10 }],
    shippingAddress: {},
    createdAt: new Date(NOW).toISOString(),
    customerOrderCount: 0,
    fraudScore: 10,
    fraudReasoning: "",
    riskLevel: "low",
    requiresReview: false,
    engine: "heuristic",
    demoMode: true,
    shopifySignalApplied: false,
    ...over,
  };
}

describe("parity with the server-side heuristics", () => {
  it("uses the same lead/coverage windows and reorder formula", () => {
    expect(RESTOCK_LEAD_DAYS).toBe(CORE_LEAD);
    expect(RESTOCK_COVERAGE_DAYS).toBe(CORE_COVERAGE);
    for (const p of [product(), product({ currentInventory: 0, salesVelocity: 2.1 }), product({ salesVelocity: 0, reorderPoint: 5, currentInventory: 1 })]) {
      expect(suggestReorderQuantity(p)).toBe(coreSuggest(p));
    }
    expect(skuKey(" tee-001 ", "Tee")).toBe(coreSkuKey(" tee-001 ", "Tee"));
    expect(skuKey(undefined, " Wool Throw ")).toBe(coreSkuKey(undefined, " Wool Throw "));
  });
});

describe("per-SKU metrics", () => {
  it("cover days: 0 when out, null when not selling", () => {
    expect(coverDays(product({ currentInventory: 0 }))).toBe(0);
    expect(coverDays(product({ salesVelocity: 0 }))).toBeNull();
    expect(coverDays(product({ currentInventory: 15, salesVelocity: 2 }))).toBe(7);
  });

  it("classifies health tiers", () => {
    expect(healthTier(product({ currentInventory: 0 }))).toBe("urgent");
    expect(healthTier(product({ currentInventory: 6, reorderPoint: 8, salesVelocity: 0.8 }))).toBe("watch");
    expect(healthTier(product({ currentInventory: 2, reorderPoint: 5, salesVelocity: 1.5 }))).toBe("urgent");
    expect(healthTier(product({ currentInventory: 18, reorderPoint: 10, salesVelocity: 1.2 }))).toBe("optimal");
    expect(healthTier(product({ currentInventory: 20, reorderPoint: 5, salesVelocity: 2 }))).toBe("watch");
    expect(healthTier(product({ currentInventory: 500, salesVelocity: 1 }))).toBe("overstock");
    expect(healthTier(product({ currentInventory: 50, reorderPoint: 20, salesVelocity: 0 }))).toBe("overstock");
    expect(healthTier(product({ currentInventory: 30, reorderPoint: 20, salesVelocity: 0 }))).toBe("optimal");
  });

  it("target stock is the larger of 2x reorder point and 30 days of sales", () => {
    expect(targetStock(product({ reorderPoint: 40, salesVelocity: 6 }))).toBe(180);
    expect(targetStock(product({ reorderPoint: 15, salesVelocity: 0.1 }))).toBe(30);
    expect(targetPct(product({ currentInventory: 90, reorderPoint: 40, salesVelocity: 6 }))).toBe(50);
    expect(targetPct(product({ currentInventory: 240, reorderPoint: 40, salesVelocity: 6 }))).toBe(133);
  });

  it("revenue at risk is the uncovered lead-time demand times price", () => {
    const drone = product({ currentInventory: 2, salesVelocity: 1.5, price: 3120 });
    expect(shortfallUnits(drone)).toBe(19);
    expect(revenueAtRisk(drone)).toBe(59280);
    expect(revenueAtRisk(product())).toBe(0);
  });

  it("only suggests a reorder when one is recommended", () => {
    expect(reorderSuggestion(product())).toBe(0);
    expect(reorderSuggestion(product({ restockRecommended: true, currentInventory: 0, reorderPoint: 15, salesVelocity: 2.1 }))).toBe(63);
  });

  it("finds the open reorder for a product", () => {
    const base = { sku: "S", title: "T", quantitySuggested: 5, createdAt: "" };
    const reorders: ReorderRequest[] = [
      { ...base, id: "r1", productId: "p1", status: "received" },
      { ...base, id: "r2", productId: "p1", status: "draft" },
    ];
    expect(openReorderFor(reorders, "p1")?.id).toBe("r2");
    expect(openReorderFor(reorders, "p2")).toBeUndefined();
  });
});

describe("summarizeInventory", () => {
  it("totals units, value, risk and tiers from the products only", () => {
    const s = summarizeInventory([
      product({ id: "a", currentInventory: 100 }),
      product({ id: "b", currentInventory: 2, salesVelocity: 1.5, price: 100, reorderPoint: 5 }),
      product({ id: "c", currentInventory: 0, reorderPoint: 15 }),
    ]);
    expect(s.skuCount).toBe(3);
    expect(s.totalUnits).toBe(102);
    expect(s.unitsAboveReorder).toBe(100);
    expect(s.inventoryValue).toBe(1200);
    expect(s.tiers).toEqual({ urgent: 2, watch: 0, optimal: 1, overstock: 0 });
    expect(s.lowStock.map((p) => p.id)).toEqual(["c", "b"]);
    expect(s.revenueAtRisk).toBe(1900 + 280);
    expect(s.worstAtRisk?.id).toBe("b");
    expect(s.healthyPct).toBe(33.3);
  });

  it("returns null health for an empty catalog", () => {
    expect(summarizeInventory([]).healthyPct).toBeNull();
  });
});

describe("depletionTrajectory", () => {
  it("reconstructs history from tracked order lines and projects per-SKU depletion", () => {
    const t = depletionTrajectory(
      [product({ currentInventory: 10, salesVelocity: 2, reorderPoint: 4 }), product({ id: "p2", sku: "MUG", title: "Mug", currentInventory: 3, salesVelocity: 1, reorderPoint: 2 })],
      [
        order({ createdAt: new Date(NOW - 1 * DAY).toISOString() }),
        order({ createdAt: new Date(NOW - 1 * DAY).toISOString(), items: [{ title: "Untracked", sku: "X", quantity: 50, price: 1 }] }),
        order({ createdAt: new Date(NOW - 2 * DAY).toISOString(), reviewDecision: "cancelled" }),
      ],
      { historyDays: 3, forecastDays: 6, now: NOW }
    );
    expect(t.history.map((p) => p.units)).toEqual([15, 15, 13, 13]);
    expect(t.history.at(-1)?.day).toBe(0);
    expect(t.projection.map((p) => p.units)).toEqual([13, 10, 7, 4, 2, 0, 0]);
    expect(t.safetyUnits).toBe(6);
    expect(t.firstStockoutDay).toBe(3);
  });
});

describe("product detail helpers", () => {
  it("estimates the stock-out date from velocity", () => {
    expect(estimatedStockoutDate(product({ currentInventory: 15, salesVelocity: 2 }), NOW)?.getTime()).toBe(NOW + 7 * DAY);
    expect(estimatedStockoutDate(product({ currentInventory: 0 }), NOW)?.getTime()).toBe(NOW);
    expect(estimatedStockoutDate(product({ salesVelocity: 0 }), NOW)).toBeNull();
  });

  it("lists orders containing the SKU, newest first, with real statuses", () => {
    const lines = ordersForProduct(
      [
        order({ id: "old", createdAt: new Date(NOW - 3 * DAY).toISOString(), fulfillmentStatus: "fulfilled" }),
        order({ id: "new", createdAt: new Date(NOW - DAY).toISOString(), items: [{ title: "Tee", sku: "tee-001", quantity: 1, price: 10 }, { title: "Tee", sku: "TEE-001", quantity: 2, price: 10 }] }),
        order({ id: "other", items: [{ title: "Mug", sku: "MUG", quantity: 5, price: 1 }] }),
        order({ id: "void", createdAt: new Date(NOW - 2 * DAY).toISOString(), reviewDecision: "cancelled" }),
        order({ id: "titled", createdAt: new Date(NOW - 4 * DAY).toISOString(), items: [{ title: "tee ", quantity: 4, price: 10 }], requiresReview: true }),
      ],
      product()
    );
    expect(lines.map((l) => [l.orderId, l.quantity, l.status])).toEqual([
      ["new", 3, "Unfulfilled"],
      ["void", 2, "Cancelled"],
      ["old", 2, "Fulfilled"],
      ["titled", 4, "Needs review"],
    ]);
  });

  it("lists every reorder for a product, newest first", () => {
    const base = { sku: "S", title: "T", quantitySuggested: 5 };
    const rs: ReorderRequest[] = [
      { ...base, id: "a", productId: "p1", status: "received", createdAt: "2026-09-01" },
      { ...base, id: "b", productId: "p1", status: "draft", createdAt: "2026-10-01" },
      { ...base, id: "c", productId: "p2", status: "draft", createdAt: "2026-10-02" },
    ];
    expect(reordersForProduct(rs, "p1").map((r) => r.id)).toEqual(["b", "a"]);
  });
});

describe("inventoryCsv", () => {
  it("writes a header and escapes titles", () => {
    const csv = inventoryCsv([product({ title: 'Mug, "Large"', restockRecommended: true, currentInventory: 0 })]);
    const [header, row] = csv.split("\n");
    expect(header.startsWith("Title,SKU,Units on hand")).toBe(true);
    expect(row.startsWith('"Mug, ""Large""",TEE-001,0,20,60,2,0,Urgent,10.00,280.00,')).toBe(true);
  });
});
