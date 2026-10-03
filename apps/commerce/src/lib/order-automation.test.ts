import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { isolateSecrets } from "./test-secrets";
import { GET as pollRoute } from "@/app/api/cron/poll-orders/route";
import { checkCronAuth, pollNewOrders } from "./order-automation";
import { getOrder, lastShopifySyncAt } from "./store";

const SHOP = "test-shop.myshopify.com";
const SLACK = "https://hooks.slack.test/T000/B000";
const NOW = Date.parse("2026-10-02T12:00:00Z");

const RAW_ORDERS = [
  {
    id: 820001,
    email: "zed@tempmail.example",
    total_price: "2500.00",
    currency: "USD",
    financial_status: "pending",
    fulfillment_status: null,
    customer: { first_name: "Zed", orders_count: 0 },
    line_items: [{ title: "Drone", sku: "DRN-9", quantity: 1, price: "2500.00" }],
    shipping_address: { name: "Zed" },
    created_at: "2026-10-02T09:00:00Z",
  },
  {
    id: 820002,
    email: "amy@example.com",
    total_price: "30.00",
    currency: "USD",
    financial_status: "paid",
    fulfillment_status: null,
    customer: { first_name: "Amy", orders_count: 7 },
    line_items: [{ title: "Mug", sku: "MUG-1", quantity: 1, price: "30.00" }],
    shipping_address: { name: "Amy", address1: "1 Main St", city: "Austin", country: "US", zip: "73301" },
    created_at: "2026-10-02T10:00:00Z",
  },
];

type Call = { url: string; method: string; body?: string };
let calls: Call[] = [];

function mockFetch() {
  calls = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input);
      calls.push({ url, method: init?.method ?? "GET", body: init?.body ? String(init.body) : undefined });
      if (url === SLACK) return new Response("ok");
      if (url.startsWith(`https://${SHOP}/admin/api/`) && url.includes("/orders.json?")) return Response.json({ orders: RAW_ORDERS });
      if (url.includes("/risks.json")) return Response.json({ risks: [] });
      throw new Error(`Unexpected network call in test: ${url}`);
    })
  );
}

beforeEach(() => {
  for (const k of ["ANTHROPIC_API_KEY", "NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"]) delete process.env[k];
  process.env.SHOPIFY_STORE_DOMAIN = SHOP;
  process.env.SHOPIFY_ACCESS_TOKEN = "shpat_test_not_real";
  process.env.CRON_SECRET = "cron-test-secret";
  process.env.SLACK_WEBHOOK_URL = SLACK;
  isolateSecrets();
  mockFetch();
});

afterEach(() => {
  vi.unstubAllGlobals();
  for (const k of ["SHOPIFY_STORE_DOMAIN", "SHOPIFY_ACCESS_TOKEN", "CRON_SECRET", "SLACK_WEBHOOK_URL"]) delete process.env[k];
  isolateSecrets();
});

const req = (auth?: string) => new Request("http://localhost/api/cron/poll-orders", { headers: auth ? { authorization: auth } : {} });

describe("cron auth", () => {
  it("fails closed when CRON_SECRET is not configured", () => {
    delete process.env.CRON_SECRET;
    isolateSecrets();
    expect(checkCronAuth(req("Bearer anything"))).toMatchObject({ ok: false, status: 503 });
  });

  it("rejects a missing or wrong bearer token", async () => {
    expect(checkCronAuth(req())).toMatchObject({ ok: false, status: 401 });
    expect(checkCronAuth(req("Bearer wrong"))).toMatchObject({ ok: false, status: 401 });
    const res = await pollRoute(req("Bearer wrong"));
    expect(res.status).toBe(401);
    expect(calls).toHaveLength(0);
  });

  it("accepts the exact Vercel Cron header", () => {
    expect(checkCronAuth(req("Bearer cron-test-secret"))).toEqual({ ok: true });
  });
});

describe("pollNewOrders", () => {
  it("scores new orders, queues proposals, alerts Slack, and never writes to Shopify", async () => {
    const run = await pollNewOrders(NOW);
    expect(run.ok).toBe(true);
    expect(run.fetched).toBe(2);
    expect(run.newOrders).toBe(2);

    const orderList = calls.find((c) => c.url.includes("/orders.json?"));
    expect(orderList?.url).toContain(`created_at_min=${encodeURIComponent("2026-10-01T10:00:00.000Z")}`);

    const hold = run.proposals.find((p) => p.label.includes("820001"));
    const approve = run.proposals.find((p) => p.label.includes("820002"));
    expect(hold).toMatchObject({ action: "hold_orders", source: "shopify" });
    expect(approve).toMatchObject({ action: "approve_orders", policyLevel: "confirm", irreversibleOnShopify: true });
    expect(approve?.reasons.join(" ")).toMatch(/external and final/);

    // Nothing was applied: no Shopify write, no local decision.
    expect(calls.filter((c) => c.url.includes(SHOP) && c.method !== "GET")).toHaveLength(0);
    for (const p of run.proposals) {
      const o = await getOrder(p.orderId);
      expect(o?.reviewDecision).toBeUndefined();
      expect(o?.fulfillmentStatus).toBe("unfulfilled");
    }

    expect(run.postedToSlack).toBe(true);
    const slack = calls.find((c) => c.url === SLACK);
    expect(slack?.body).toMatch(/Nothing was approved or cancelled automatically/);
    expect(lastShopifySyncAt()).toBe(new Date(NOW).toISOString());
  });

  it("does not re-queue or re-alert orders it has already seen", async () => {
    await pollNewOrders(NOW);
    calls = [];
    const again = await pollNewOrders(NOW + 60_000);
    expect(again.newOrders).toBe(0);
    expect(again.postedToSlack).toBe(false);
    expect(calls.some((c) => c.url === SLACK)).toBe(false);
  });

  it("reports a Shopify failure instead of claiming a sync", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("nope", { status: 401 })));
    const res = await pollRoute(req("Bearer cron-test-secret"));
    expect(res.status).toBe(502);
    const body = (await res.json()) as { ok: boolean; error: string };
    expect(body.ok).toBe(false);
    expect(body.error).toMatch(/401/);
  });

  it("live sync derives product sales velocity from real order line items", async () => {
    const recent = new Date(Date.now() - 2 * 86_400_000).toISOString();
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL | Request) => {
        const url = String(input);
        if (url.includes("/orders.json?")) {
          return Response.json({
            orders: [
              { ...RAW_ORDERS[1], id: 830001, created_at: recent, line_items: [{ title: "Mug", sku: "MUG-1", quantity: 4, price: "30.00" }] },
            ],
          });
        }
        if (url.includes("/risks.json")) return Response.json({ risks: [] });
        if (url.includes("/products.json?")) {
          return Response.json({ products: [{ id: 1, title: "Mug", variants: [{ sku: "MUG-1", inventory_quantity: 3, price: "30.00" }] }] });
        }
        throw new Error(`Unexpected network call in test: ${url}`);
      })
    );
    vi.resetModules();
    const { syncShopifyLive, listProducts } = await import("./store");
    expect(await syncShopifyLive()).toEqual({ ok: true });
    const mug = (await listProducts()).find((p) => p.sku === "MUG-1");
    expect(mug?.salesVelocity).toBe(2);
    expect(mug?.restockRecommended).toBe(true);
  });

  it("skips cleanly when Shopify is not configured", async () => {
    delete process.env.SHOPIFY_ACCESS_TOKEN;
    isolateSecrets();
    const run = await pollNewOrders(NOW);
    expect(run.skipped).toMatch(/not configured/);
    expect(calls).toHaveLength(0);
  });
});
