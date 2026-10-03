import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { StoredOrder, StoredProduct } from "@helix/core";
import { isolateSecrets } from "./test-secrets";
import { getAiCostTotals, resetAiCostLedger, unsupportedNumbers, estimateUsd } from "./claude-usage";
import { buildStoreSummary, computeStoreMetrics, deterministicSummary } from "./store-summary";

const NOW = Date.parse("2026-10-02T12:00:00Z");
const HOUR = 3_600_000;

function order(id: number, hoursAgo: number, totalPrice: number, extra: Partial<StoredOrder> = {}): StoredOrder {
  return {
    id: `order-${id}`,
    shopifyOrderId: `gid://shopify/Order/${7000 + id}`,
    customerName: "C",
    customerEmail: "c@example.com",
    totalPrice,
    currency: "USD",
    financialStatus: "paid",
    fulfillmentStatus: "unfulfilled",
    items: [],
    shippingAddress: {},
    createdAt: new Date(NOW - hoursAgo * HOUR).toISOString(),
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

const product = (sku: string, inv: number, rp: number): StoredProduct => ({
  id: `p-${sku}`,
  shopifyProductId: `gid://shopify/Product/${sku}`,
  title: `Item ${sku}`,
  sku,
  currentInventory: inv,
  reorderPoint: rp,
  price: 1,
  salesVelocity: 0,
  predictedStockoutDays: 0,
  restockRecommended: false,
  reasoning: "",
  engine: "heuristic",
  demoMode: true,
});

const ORDERS = [
  order(1, 2, 100),
  order(2, 5, 250.5, { riskLevel: "critical", requiresReview: true }),
  order(3, 20, 40, { reviewDecision: "cancelled", fulfillmentStatus: "cancelled" }),
  order(4, 30, 999, { riskLevel: "high", requiresReview: true }),
  order(5, 3, 80, { currency: "EUR" }),
];
const PRODUCTS = [product("A", 0, 5), product("B", 3, 5), product("C", 50, 5)];

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

describe("computeStoreMetrics", () => {
  it("computes 24h orders, revenue per currency, at-risk $ and low stock from the records", () => {
    const m = computeStoreMetrics(ORDERS, PRODUCTS, NOW);
    expect(m.ordersInWindow).toBe(4);
    expect(m.revenueByCurrency).toEqual({ USD: 350.5, EUR: 80 });
    expect(m.awaitingReviewCount).toBe(2);
    expect(m.atRiskUsd).toBe(1249.5);
    expect(m.highRiskInWindow).toBe(1);
    expect(m.lowStockCount).toBe(2);
    expect(m.outOfStockCount).toBe(1);
    expect(m.lowStockItems[0].sku).toBe("A");
  });

  it("deterministic summary only uses computed numbers", () => {
    const m = computeStoreMetrics(ORDERS, PRODUCTS, NOW);
    expect(unsupportedNumbers(deterministicSummary(m), m)).toEqual([]);
  });
});

describe("buildStoreSummary", () => {
  it("falls back to a labelled deterministic summary without a key", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const s = await buildStoreSummary(ORDERS, PRODUCTS, "demo", NOW);
    expect(s.engine).toBe("deterministic");
    expect(s.source).toBe("demo");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("sends only computed metrics to Claude and accepts prose that reuses them", async () => {
    process.env.ANTHROPIC_API_KEY = "test-key";
    isolateSecrets();
    const fetchMock = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body)) as { model: string; messages: { content: string }[] };
      expect(body.model).toBe("claude-sonnet-4-20250514");
      expect(body.messages[0].content).toContain('"atRiskUsd":1249.5');
      return Response.json({
        content: [{ type: "text", text: "4 orders in the last 24 hours brought 350.50 USD. 2 orders worth 1249.50 await your review." }],
        usage: { input_tokens: 500, output_tokens: 60 },
      });
    });
    vi.stubGlobal("fetch", fetchMock);
    const s = await buildStoreSummary(ORDERS, PRODUCTS, "shopify", NOW);
    expect(s.engine).toBe("claude");
    expect(s.summary).toMatch(/1249.50/);
    expect(getAiCostTotals().byFeature.store_summary.calls).toBe(1);
    expect(getAiCostTotals().inputTokens).toBe(500);
  });

  it("rejects a Claude summary that invents a KPI", async () => {
    process.env.ANTHROPIC_API_KEY = "test-key";
    isolateSecrets();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json({ content: [{ type: "text", text: "Conversion rose 12% to 4 orders." }], usage: { input_tokens: 1, output_tokens: 1 } }))
    );
    const s = await buildStoreSummary(ORDERS, PRODUCTS, "shopify", NOW);
    expect(s.engine).toBe("deterministic");
    expect(s.engineNote).toMatch(/12/);
  });

  it("degrades to deterministic when Anthropic errors", async () => {
    process.env.ANTHROPIC_API_KEY = "test-key";
    isolateSecrets();
    vi.stubGlobal("fetch", vi.fn(async () => new Response("overloaded", { status: 529 })));
    const s = await buildStoreSummary(ORDERS, PRODUCTS, "shopify", NOW);
    expect(s.engine).toBe("deterministic");
    expect(s.engineNote).toMatch(/529/);
  });
});

describe("cost estimate", () => {
  it("uses the named per-million-token constants", () => {
    expect(estimateUsd(1_000_000, 0)).toBe(3);
    expect(estimateUsd(0, 1_000_000)).toBe(15);
  });
});
