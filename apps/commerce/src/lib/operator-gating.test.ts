import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { OPERATOR_COOKIE, operatorToken } from "@helix/core/operator";
import { isolateSecrets } from "./test-secrets";

const desk = vi.hoisted(() => ({ mode: "demo" as "demo" | "live" }));

vi.mock("@/lib/store", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/store")>()),
  currentDeskMode: () => desk.mode,
}));

const { deskWriteDenied } = await import("./ai-desk");
const { listProducts, loadDemoCatalog } = await import("./store");
const reorders = await import("@/app/api/reorders/route");
const orderReview = await import("@/app/api/orders/[id]/review/route");
const storeSummary = await import("@/app/api/ai/store-summary/route");
const fraudExplanation = await import("@/app/api/ai/fraud-explanation/route");
const restock = await import("@/app/api/ai/restock/route");
const shopifySync = await import("@/app/api/shopify/sync/route");

const KEY = "test-operator-key";
const SOFIA = "order-shopifyOrder1003";
const savedAnthropic = process.env.ANTHROPIC_API_KEY;

function req(url: string, auth: "none" | "header" | "cookie" | "wrong" = "none", body?: unknown): Request {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (auth === "header") headers["x-helix-operator-key"] = KEY;
  if (auth === "wrong") headers["x-helix-operator-key"] = "nope";
  if (auth === "cookie") headers.cookie = `${OPERATOR_COOKIE}=${operatorToken(KEY)}`;
  return new Request(`http://localhost${url}`, {
    method: "POST",
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

beforeEach(async () => {
  isolateSecrets();
  delete process.env.ANTHROPIC_API_KEY;
  process.env.HELIX_OPERATOR_KEY = KEY;
  desk.mode = "demo";
  await loadDemoCatalog();
});

afterAll(() => {
  delete process.env.HELIX_OPERATOR_KEY;
  if (savedAnthropic !== undefined) process.env.ANTHROPIC_API_KEY = savedAnthropic;
});

describe("deskWriteDenied", () => {
  it("lets anyone change the demo desk", () => {
    expect(deskWriteDenied(req("/api/reorders"))).toBeNull();
  });

  it("requires the operator on a live desk", async () => {
    desk.mode = "live";
    const denied = deskWriteDenied(req("/api/reorders"));
    expect(denied?.status).toBe(401);
    expect(await denied?.json()).toEqual({ error: "Operator unlock required." });
    expect(deskWriteDenied(req("/api/reorders", "wrong"))?.status).toBe(401);
    expect(deskWriteDenied(req("/api/reorders", "header"))).toBeNull();
    expect(deskWriteDenied(req("/api/reorders", "cookie"))).toBeNull();
  });

  it("stays open when no operator key is configured", () => {
    delete process.env.HELIX_OPERATOR_KEY;
    desk.mode = "live";
    expect(deskWriteDenied(req("/api/reorders"))).toBeNull();
  });
});

describe("desk-state routes", () => {
  it("draft PO: open in demo, gated in live, allowed with the operator header", async () => {
    const productId = (await listProducts())[0].id;
    expect((await reorders.POST(req("/api/reorders", "none", { productId }))).status).toBe(200);
    desk.mode = "live";
    expect((await reorders.POST(req("/api/reorders", "none", { productId }))).status).toBe(401);
    expect((await reorders.POST(req("/api/reorders", "header", { productId }))).status).toBe(200);
  });

  it("order review: flagging a demo order needs no key in demo, the key in live", async () => {
    const params = Promise.resolve({ id: SOFIA });
    expect((await orderReview.POST(req(`/api/orders/${SOFIA}/review`, "none", { decision: "flagged" }), { params })).status).toBe(200);
    desk.mode = "live";
    expect((await orderReview.POST(req(`/api/orders/${SOFIA}/review`, "none", { decision: "flagged" }), { params })).status).toBe(401);
  });
});

describe("Claude and Shopify routes stay gated in every mode", () => {
  for (const mode of ["demo", "live"] as const) {
    it(`returns 401 without the key on a ${mode} desk`, async () => {
      desk.mode = mode;
      expect((await storeSummary.POST(req("/api/ai/store-summary"))).status).toBe(401);
      expect((await restock.POST(req("/api/ai/restock"))).status).toBe(401);
      expect((await fraudExplanation.POST(req("/api/ai/fraud-explanation", "none", { orderId: SOFIA }))).status).toBe(401);
      expect((await shopifySync.POST(req("/api/shopify/sync"))).status).toBe(401);
    });
  }

  it("runs with the operator header", async () => {
    expect((await storeSummary.POST(req("/api/ai/store-summary", "header"))).status).toBe(200);
    expect((await fraudExplanation.POST(req("/api/ai/fraud-explanation", "header", { orderId: SOFIA }))).status).toBe(200);
  });
});
