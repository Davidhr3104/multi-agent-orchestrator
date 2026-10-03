import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { suggestReorderQuantity, type StoredOrder, type StoredProduct } from "@helix/core";
import { isolateSecrets } from "./test-secrets";
import { getAiCostTotals, resetAiCostLedger } from "./claude-usage";
import { buildRestockReport, computeRestockLines, computeSalesVelocity } from "./restock";

const NOW = Date.parse("2026-10-02T12:00:00Z");
const DAY = 86_400_000;

function order(id: number, daysAgo: number, items: { sku?: string; title: string; quantity: number }[], extra: Partial<StoredOrder> = {}): StoredOrder {
  return {
    id: `order-${id}`,
    shopifyOrderId: `gid://shopify/Order/${9000 + id}`,
    customerName: "C",
    customerEmail: "c@example.com",
    totalPrice: 10,
    currency: "USD",
    financialStatus: "paid",
    fulfillmentStatus: "unfulfilled",
    items: items.map((i) => ({ ...i, price: 5 })),
    shippingAddress: {},
    createdAt: new Date(NOW - daysAgo * DAY).toISOString(),
    customerOrderCount: 1,
    fraudScore: 10,
    fraudReasoning: "",
    riskLevel: "low",
    requiresReview: false,
    engine: "heuristic",
    demoMode: true,
    shopifySignalApplied: false,
    ...extra,
  };
}

function product(sku: string, title: string, currentInventory: number, reorderPoint: number): StoredProduct {
  return {
    id: `product-${sku}`,
    shopifyProductId: `gid://shopify/Product/${sku}`,
    title,
    sku,
    currentInventory,
    reorderPoint,
    price: 20,
    salesVelocity: 0,
    predictedStockoutDays: 0,
    restockRecommended: false,
    reasoning: "",
    engine: "heuristic",
    demoMode: true,
  };
}

const ORDERS = [
  order(1, 29, [{ sku: "TEE-1", title: "Tee", quantity: 4 }]),
  order(2, 10, [{ sku: "TEE-1", title: "Tee", quantity: 2 }, { sku: "MUG-1", title: "Mug", quantity: 1 }]),
  order(3, 1, [{ sku: "tee-1", title: "Tee", quantity: 3 }]),
  order(4, 2, [{ sku: "TEE-1", title: "Tee", quantity: 50 }], { reviewDecision: "cancelled" }),
  order(5, 45, [{ sku: "TEE-1", title: "Tee", quantity: 99 }]),
  order(6, 3, [{ title: "No Sku Candle", quantity: 6 }]),
];

beforeEach(() => {
  delete process.env.ANTHROPIC_API_KEY;
  isolateSecrets();
  resetAiCostLedger();
});

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.ANTHROPIC_API_KEY;
  isolateSecrets();
});

describe("computeSalesVelocity", () => {
  it("counts units per SKU inside the window, skipping cancelled and out-of-window orders", () => {
    const v = computeSalesVelocity(ORDERS, { now: NOW, windowDays: 30 });
    expect(v.ordersInWindow).toBe(4);
    expect(v.observedDays).toBe(29);
    expect(v.bySku["TEE-1"].unitsSold).toBe(9);
    expect(v.bySku["TEE-1"].orders).toBe(3);
    expect(v.bySku["TEE-1"].perDay).toBe(Math.round((9 / 29) * 100) / 100);
    expect(v.bySku["MUG-1"].unitsSold).toBe(1);
    expect(v.bySku["TITLE:NO SKU CANDLE"].unitsSold).toBe(6);
  });

  it("divides by the observed span when history is shorter than the window", () => {
    const v = computeSalesVelocity([order(1, 2, [{ sku: "A", title: "A", quantity: 10 }])], { now: NOW, windowDays: 30 });
    expect(v.observedDays).toBe(2);
    expect(v.bySku.A.perDay).toBe(5);
  });

  it("returns an empty report (no division by zero) when nothing sold", () => {
    const v = computeSalesVelocity([], { now: NOW });
    expect(v.ordersInWindow).toBe(0);
    expect(v.bySku).toEqual({});
  });
});

describe("computeRestockLines", () => {
  it("computes the reorder quantity in code from real velocity", () => {
    const v = computeSalesVelocity(ORDERS, { now: NOW, windowDays: 30 });
    const lines = computeRestockLines([product("TEE-1", "Tee", 3, 5), product("MUG-1", "Mug", 500, 5)], v);
    expect(lines).toHaveLength(1);
    const tee = lines[0];
    expect(tee.perDay).toBe(v.bySku["TEE-1"].perDay);
    expect(tee.daysOfCover).toBe(Math.floor(3 / tee.perDay));
    expect(tee.suggestedQuantity).toBe(suggestReorderQuantity({ salesVelocity: tee.perDay, reorderPoint: 5, currentInventory: 3 }));
  });

  it("flags a product at its reorder point even with no sales", () => {
    const lines = computeRestockLines([product("ZZZ", "Unsold", 2, 5)], computeSalesVelocity([], { now: NOW }));
    expect(lines[0].daysOfCover).toBeNull();
    expect(lines[0].suggestedQuantity).toBe(8);
  });
});

describe("buildRestockReport", () => {
  const products = [product("TEE-1", "Tee", 3, 5)];

  it("stays deterministic and labelled without an Anthropic key, with no network call", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const r = await buildRestockReport(products, ORDERS, "shopify", NOW);
    expect(r.engine).toBe("deterministic");
    expect(r.engineNote).toMatch(/ANTHROPIC_API_KEY/);
    expect(r.draft).toBe(true);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("uses Claude's prose but keeps the computed quantity, and meters the call", async () => {
    process.env.ANTHROPIC_API_KEY = "test-key";
    isolateSecrets();
    const qty = suggestReorderQuantity({ salesVelocity: 0.31, reorderPoint: 5, currentInventory: 3 });
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json({
          content: [{ type: "text", text: JSON.stringify({ "TEE-1": `Only 3 left against a reorder point of 5; ordering ${qty} covers 30 days.` }) }],
          usage: { input_tokens: 1000, output_tokens: 200 },
        })
      )
    );
    const r = await buildRestockReport(products, ORDERS, "shopify", NOW);
    expect(r.engine).toBe("claude");
    expect(r.lines[0].reasoning).toMatch(/Only 3 left/);
    expect(r.lines[0].suggestedQuantity).toBe(qty);
    expect(getAiCostTotals().byFeature.restock_reasoning.calls).toBe(1);
    expect(getAiCostTotals().estimatedUsd).toBeCloseTo(0.006, 6);
  });

  it("discards Claude text that invents a number", async () => {
    process.env.ANTHROPIC_API_KEY = "test-key";
    isolateSecrets();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json({
          content: [{ type: "text", text: JSON.stringify({ "TEE-1": "Order 777 units to be safe." }) }],
          usage: { input_tokens: 10, output_tokens: 10 },
        })
      )
    );
    const r = await buildRestockReport(products, ORDERS, "shopify", NOW);
    expect(r.lines[0].reasoning).not.toMatch(/777/);
    expect(r.engineNote).toMatch(/TEE-1/);
  });
});
