import { describe, expect, it } from "vitest";
import type { StoredOrder, StoredProduct } from "@helix/core";
import { buildDemoReply } from "./demo-assistant";

function order(p: Partial<StoredOrder> & { id: string; shopifyOrderId: string; customerName: string }): StoredOrder {
  return {
    customerEmail: "x@example.com",
    totalPrice: 100,
    currency: "USD",
    financialStatus: "paid",
    fulfillmentStatus: "unfulfilled",
    items: [],
    fraudScore: 8,
    fraudReasoning: "Established customer, normal basket.",
    riskLevel: "low",
    requiresReview: false,
    createdAt: "2026-09-28T00:00:00Z",
    ...p,
  } as StoredOrder;
}

const sofia = order({ id: "o1003", shopifyOrderId: "gid://shopify/Order/1003", customerName: "Sofia Reyes", totalPrice: 2450, fraudScore: 93, riskLevel: "critical", requiresReview: true, fraudReasoning: "New account, high value, mismatched shipping." });
const newcust = order({ id: "o1005", shopifyOrderId: "gid://shopify/Order/1005", customerName: "New Customer", totalPrice: 3120, fraudScore: 98, riskLevel: "critical", requiresReview: true });
const marcus = order({ id: "o1002", shopifyOrderId: "gid://shopify/Order/1002", customerName: "Marcus Webb", totalPrice: 189 });
const priya = order({ id: "o1001", shopifyOrderId: "gid://shopify/Order/1001", customerName: "Priya Nair", fulfillmentStatus: "fulfilled" });
const orders = [sofia, newcust, marcus, priya];

const prod = (id: string, title: string, inv: number, point: number, restock: boolean) =>
  ({ id, title, sku: id.toUpperCase(), currentInventory: inv, reorderPoint: point, predictedStockoutDays: inv, restockRecommended: restock }) as unknown as StoredProduct;
const products = [prod("p1", "Wool Blanket Throw", 0, 15, true), prod("p2", "Drone Kit", 2, 5, true), prod("p3", "Cotton Tee", 240, 40, false)];

describe("commerce demo assistant", () => {
  it("summarizes orders with revenue and how many need review", () => {
    const r = buildDemoReply("How are my orders looking?", orders, products);
    expect(r.answer).toContain("4 orders");
    expect(r.answer).toMatch(/2 .*review/i);
    expect(r.proposal).toBeUndefined();
  });

  it("ranks the riskiest orders first", () => {
    const r = buildDemoReply("Which orders look risky?", orders, products);
    expect(r.answer.indexOf("New Customer")).toBeLessThan(r.answer.indexOf("Sofia Reyes"));
    expect(r.answer).not.toContain("Marcus Webb");
  });

  it("explains an order by number using its own reasoning", () => {
    const r = buildDemoReply("Why was order #1003 flagged?", orders, products);
    expect(r.answer).toContain("Sofia Reyes");
    expect(r.answer).toContain("93");
    expect(r.answer).toContain("mismatched shipping");
  });

  it("proposes drafting reorders only for products flagged for restock (a question, not a command)", () => {
    const r = buildDemoReply("What needs restocking?", orders, products);
    expect(r.command).toBeUndefined();
    expect(r.proposal?.action).toBe("create_reorders");
    expect(r.proposal?.targets.map((t) => t.id)).toEqual(["p1", "p2"]);
  });

  it("parses 'hold order #1003' as a command on that order", () => {
    const r = buildDemoReply("Hold order #1003", orders, products);
    expect(r.command).toBe(true);
    expect(r.proposal).toMatchObject({ action: "hold_orders" });
    expect(r.proposal?.targets.map((t) => t.id)).toEqual(["o1003"]);
  });

  it("also finds an order by the customer's name", () => {
    const r = buildDemoReply("Approve Marcus Webb's order", orders, products);
    expect(r.proposal).toMatchObject({ action: "approve_orders" });
    expect(r.proposal?.targets.map((t) => t.id)).toEqual(["o1002"]);
  });

  it("parses cancel and restock commands", () => {
    expect(buildDemoReply("Cancel order 1005", orders, products).proposal?.action).toBe("cancel_orders");
    const restock = buildDemoReply("Restock the drone kit", orders, products);
    expect(restock.command).toBe(true);
    expect(restock.proposal).toMatchObject({ action: "create_reorders" });
    expect(restock.proposal?.targets.map((t) => t.id)).toEqual(["p2"]);
  });

  it("says so instead of guessing when the order does not exist", () => {
    const r = buildDemoReply("Hold order #9999", orders, products);
    expect(r.proposal).toBeUndefined();
    expect(r.command).toBeUndefined();
    expect(r.answer).toMatch(/couldn.t find/i);
  });

  it("lists what it can do for anything else, and handles an empty desk", () => {
    expect(buildDemoReply("tell me a joke", orders, products).answer).toMatch(/hold|approve|restock/i);
    expect(buildDemoReply("How are my orders?", [], []).answer).toMatch(/no orders/i);
  });
});
