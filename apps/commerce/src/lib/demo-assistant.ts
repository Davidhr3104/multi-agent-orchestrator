import type { ActionProposal, StoredOrder, StoredProduct } from "@helix/core";

/**
 * Deterministic stand-in for Claude, used only on the demo desk when no ANTHROPIC_API_KEY is set.
 * Every name, score and id in a reply comes from the orders/products passed in; every proposal points
 * at a real id the action registry can act on. It never invents data.
 */

export type DemoReply = {
  answer: string;
  proposal?: ActionProposal;
  /** True when the operator explicitly asked for the change (vs. asking a question). */
  command?: boolean;
};

const money = (n: number) => `$${n.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
const orderNo = (o: StoredOrder) => o.shopifyOrderId.split("/").pop() ?? o.shopifyOrderId;
const label = (o: StoredOrder) => `#${orderNo(o)} ${o.customerName}`;
const byRiskDesc = (a: StoredOrder, b: StoredOrder) => b.fraudScore - a.fraudScore;

function findOrder(q: string, orders: StoredOrder[]): StoredOrder | undefined {
  const num = q.match(/#?\b(\d{3,6})\b/)?.[1];
  if (num) {
    const byNumber = orders.find((o) => orderNo(o) === num);
    if (byNumber) return byNumber;
  }
  return orders.find((o) => q.includes(o.customerName.toLowerCase()));
}

function findProduct(q: string, products: StoredProduct[]): StoredProduct | undefined {
  return products.find((p) => q.includes(p.title.toLowerCase()) || q.includes(p.sku.toLowerCase()) || q.includes(p.title.toLowerCase().split(" ").slice(-2).join(" ")));
}

function summary(orders: StoredOrder[]): string {
  const review = orders.filter((o) => o.requiresReview);
  const total = orders.reduce((s, o) => s + o.totalPrice, 0);
  const atRisk = review.reduce((s, o) => s + o.totalPrice, 0);
  const unfulfilled = orders.filter((o) => o.fulfillmentStatus === "unfulfilled").length;
  const parts = [`You have ${orders.length} orders worth ${money(total)}; ${unfulfilled} still unfulfilled.`];
  if (review.length) parts.push(`${review.length} need human review (${review.map(label).join(", ")}) — ${money(atRisk)} at risk.`);
  else parts.push("Nothing is waiting on fraud review.");
  return parts.join(" ");
}

function risky(orders: StoredOrder[]): string {
  const top = orders.filter((o) => o.riskLevel !== "low").sort(byRiskDesc);
  if (top.length === 0) return "No orders are above low fraud risk right now.";
  return `${top.length} order${top.length === 1 ? "" : "s"} look risky, worst first:\n${top
    .map((o) => `• ${label(o)} — fraud score ${o.fraudScore} (${o.riskLevel}), ${money(o.totalPrice)}`)
    .join("\n")}\nI can hold any of them for review, or cancel one if you're sure.`;
}

function explain(o: StoredOrder): string {
  const state = o.reviewDecision
    ? `Its review decision is ${o.reviewDecision}.`
    : o.requiresReview
      ? "It is waiting for human review."
      : `It is ${o.fulfillmentStatus}.`;
  return `${label(o)} scored ${o.fraudScore} fraud risk (${o.riskLevel}) on ${money(o.totalPrice)}.\nWhy: ${o.fraudReasoning}\n${state}`;
}

function restock(products: StoredProduct[]): DemoReply {
  const needs = products.filter((p) => p.restockRecommended).sort((a, b) => a.predictedStockoutDays - b.predictedStockoutDays);
  if (needs.length === 0) return { answer: "Nothing needs restocking — every product is above its reorder point." };
  return {
    answer: `${needs.length} product${needs.length === 1 ? "" : "s"} should be restocked:\n${needs
      .map((p) => `• ${p.title} — ${p.currentInventory} left, reorder point ${p.reorderPoint}`)
      .join("\n")}\nI can draft the reorder requests; nothing is sent to a supplier until you place them.`,
    proposal: {
      action: "create_reorders",
      summary: `Draft ${needs.length} reorder request${needs.length === 1 ? "" : "s"}.`,
      targets: needs.map((p) => ({ id: p.id, label: `${p.title} (${p.currentInventory} left)` })),
    },
  };
}

const unknown = (what: string): DemoReply => ({ answer: `I couldn't find ${what} on this desk.` });

function command(q: string, orders: StoredOrder[], products: StoredProduct[]): DemoReply | null {
  const verb = q.match(/^(?:please )?(hold|flag|pause|approve|fulfil{1,2}|cancel|restock|reorder)\b/)?.[1];
  if (!verb) return null;

  if (verb === "restock" || verb === "reorder") {
    const p = findProduct(q, products);
    if (!p) return unknown("that product");
    return {
      answer: `Drafting a reorder for ${p.title}.`,
      command: true,
      proposal: { action: "create_reorders", summary: `Draft a reorder for ${p.title}.`, targets: [{ id: p.id, label: p.title }] },
    };
  }

  const o = findOrder(q, orders);
  if (!o) return unknown("that order");
  const target = [{ id: o.id, label: label(o) }];
  if (verb === "hold" || verb === "flag" || verb === "pause") {
    return { answer: `Holding ${label(o)} for review.`, command: true, proposal: { action: "hold_orders", summary: `Hold ${label(o)}.`, targets: target } };
  }
  if (verb === "cancel") {
    return { answer: `Cancelling ${label(o)}.`, command: true, proposal: { action: "cancel_orders", summary: `Cancel ${label(o)}.`, targets: target } };
  }
  return { answer: `Approving ${label(o)}.`, command: true, proposal: { action: "approve_orders", summary: `Approve and fulfil ${label(o)}.`, targets: target } };
}

const HELP =
  'I can summarize your orders, rank the risky ones, explain why an order was flagged, and check what needs restocking. You can also tell me what to do — "Hold order #1003", "Approve order #1002", "Cancel order #1005", "Restock the drone kit" — and I only stop to ask when a change is risky or can\'t be undone.';

export function buildDemoReply(question: string, orders: StoredOrder[], products: StoredProduct[]): DemoReply {
  const q = question.trim().toLowerCase();
  if (orders.length === 0 && products.length === 0) return { answer: "There are no orders on this desk yet." };

  const cmd = command(q, orders, products);
  if (cmd) return cmd;

  if (/restock|inventory|stock|reorder/.test(q)) return restock(products);
  const named = findOrder(q, orders);
  if (named && !/summar|overview/.test(q)) return { answer: explain(named) };
  if (/risk|fraud|suspicious|flag|review/.test(q)) return { answer: risky(orders) };
  if (/order|summar|overview|how.*(doing|going|looking)|today|status/.test(q)) return { answer: orders.length ? summary(orders) : "There are no orders on this desk yet." };
  return { answer: HELP };
}
