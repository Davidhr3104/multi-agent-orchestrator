import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { StoredOrder } from "@helix/core";
import { isolateSecrets } from "./test-secrets";
import { getAiCostTotals, resetAiCostLedger } from "./claude-usage";
import { explainOrderFraud, extractFraudSignals } from "./fraud-explanation";

const SHOP = "test-shop.myshopify.com";

const ORDER: StoredOrder = {
  id: "order-5550001",
  shopifyOrderId: "gid://shopify/Order/5550001",
  customerName: "Dana",
  customerEmail: "dana.private@gmail.com",
  totalPrice: 1890,
  currency: "USD",
  financialStatus: "pending",
  fulfillmentStatus: "unfulfilled",
  items: [{ title: "Camera", sku: "CAM-1", quantity: 1, price: 1890 }],
  shippingAddress: { name: "Dana", address1: "5 Rd", city: "Lagos", country: "Nigeria", zip: "100001" },
  createdAt: "2026-10-02T08:00:00Z",
  customerOrderCount: 0,
  shopifyRisks: [{ recommendation: "investigate", score: 0.6, message: "Billing address does not match card", source: "Shopify Protect" }],
  fraudScore: 67,
  fraudReasoning: "Heuristic fraud score 67 (high).",
  riskLevel: "high",
  requiresReview: true,
  engine: "heuristic",
  demoMode: true,
  shopifySignalApplied: true,
};

const RAW = {
  id: 5550001,
  email: "dana.private@gmail.com",
  billing_address: { name: "D. Okafor", country_code: "US", zip: "10001" },
  shipping_address: { name: "Dana", address1: "5 Rd", city: "Lagos", country: "Nigeria", country_code: "NG", zip: "100001" },
  customer: { orders_count: 0, total_spent: "0.00" },
  payment_gateway_names: ["shopify_payments"],
};

let prompts: string[] = [];

function stubFetch(claudeText: string, shopifyStatus = 200) {
  prompts = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input);
      if (url === `https://${SHOP}/admin/api/2024-10/orders/5550001.json`) {
        return shopifyStatus === 200 ? Response.json({ order: RAW }) : new Response("", { status: shopifyStatus });
      }
      if (url === "https://api.anthropic.com/v1/messages") {
        prompts.push(String(init?.body));
        return Response.json({ content: [{ type: "text", text: claudeText }], usage: { input_tokens: 800, output_tokens: 120 } });
      }
      throw new Error(`Unexpected network call: ${url}`);
    })
  );
}

beforeEach(() => {
  process.env.SHOPIFY_STORE_DOMAIN = SHOP;
  process.env.SHOPIFY_ACCESS_TOKEN = "shpat_test_not_real";
  process.env.ANTHROPIC_API_KEY = "test-key";
  isolateSecrets();
  resetAiCostLedger();
});

afterEach(() => {
  vi.unstubAllGlobals();
  for (const k of ["SHOPIFY_STORE_DOMAIN", "SHOPIFY_ACCESS_TOKEN", "ANTHROPIC_API_KEY"]) delete process.env[k];
  isolateSecrets();
});

describe("extractFraudSignals", () => {
  it("reads billing vs shipping mismatches and Shopify risk assessments from the raw order", () => {
    const signals = extractFraudSignals(ORDER, RAW);
    const byField = Object.fromEntries(signals.map((s) => [s.field, s]));
    expect(byField["billing_address.country_code vs shipping_address.country_code"]).toMatchObject({ kind: "risk", value: "US ≠ NG" });
    expect(byField["billing_address.name vs shipping_address.name"]).toMatchObject({ kind: "risk", value: false });
    expect(byField["customer.orders_count"]).toMatchObject({ value: 0, kind: "risk" });
    expect(byField["risks[].recommendation"]).toMatchObject({ value: "investigate", kind: "risk" });
    expect(byField["email (domain only)"].value).toBe("gmail.com");
  });
});

describe("explainOrderFraud", () => {
  it("has Claude explain the real Shopify fields, without sending the customer's name or email", async () => {
    stubFetch(
      "Billing country US differs from shipping country NG [billing_address.country_code vs shipping_address.country_code], and this is a first order [customer.orders_count] of 1890.00 USD [total_price]. Shopify Protect recommends investigation [risks[].recommendation]."
    );
    const r = await explainOrderFraud(ORDER);
    expect(r.engine).toBe("claude");
    expect(r.source).toBe("shopify");
    expect(r.fetchedFromShopify).toBe(true);
    expect(r.explanation).toMatch(/\[billing_address.country_code/);
    expect(prompts[0]).not.toContain("dana.private");
    expect(prompts[0]).not.toContain("Okafor");
    expect(r.usage?.estimatedUsd).toBeCloseTo((800 * 3 + 120 * 15) / 1_000_000, 6);
    expect(getAiCostTotals().byFeature.fraud_explanation.calls).toBe(1);
  });

  it("keeps the deterministic explanation when Claude cites a number that is not in the order", async () => {
    stubFetch("This customer has 14 chargebacks on file.");
    const r = await explainOrderFraud(ORDER);
    expect(r.engine).toBe("deterministic");
    expect(r.engineNote).toMatch(/14/);
    expect(r.explanation).toMatch(/^Fraud score 67\/100 \(high\)/);
  });

  it("says when Shopify did not answer and works from stored fields", async () => {
    stubFetch("First order [customer.orders_count] with pending payment [financial_status].", 503);
    const r = await explainOrderFraud(ORDER);
    expect(r.fetchedFromShopify).toBe(false);
    expect(r.signals.some((s) => s.field.startsWith("billing_address"))).toBe(false);
  });

  it("labels the deterministic fallback when no Anthropic key is set", async () => {
    delete process.env.ANTHROPIC_API_KEY;
    isolateSecrets();
    stubFetch("unused");
    const r = await explainOrderFraud(ORDER);
    expect(r.engine).toBe("deterministic");
    expect(r.engineNote).toMatch(/ANTHROPIC_API_KEY/);
    expect(prompts).toHaveLength(0);
  });
});
