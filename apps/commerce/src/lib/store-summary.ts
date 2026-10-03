import type { StoredOrder, StoredProduct } from "@helix/core";
import { claudeText, unsupportedNumbers, type ClaudeUsage } from "@/lib/claude-usage";

export const SUMMARY_WINDOW_HOURS = 24;

const round2 = (n: number) => Math.round(n * 100) / 100;

export type StoreMetrics = {
  windowHours: number;
  ordersInWindow: number;
  /** Revenue per currency over non-cancelled orders in the window. */
  revenueByCurrency: Record<string, number>;
  awaitingReviewCount: number;
  /** Total of orders flagged for review that no human has decided yet (all time, not just the window). */
  atRiskUsd: number;
  highRiskInWindow: number;
  lowStockCount: number;
  outOfStockCount: number;
  lowStockItems: { title: string; sku: string; inventory: number; reorderPoint: number }[];
};

function cancelled(o: StoredOrder): boolean {
  return o.reviewDecision === "cancelled" || o.fulfillmentStatus === "cancelled" || o.financialStatus === "voided";
}

export function computeStoreMetrics(orders: StoredOrder[], products: StoredProduct[], now = Date.now()): StoreMetrics {
  const start = now - SUMMARY_WINDOW_HOURS * 3_600_000;
  const recent = orders.filter((o) => {
    const t = new Date(o.createdAt).getTime();
    return t >= start && t <= now;
  });

  const revenueByCurrency: Record<string, number> = {};
  for (const o of recent) {
    if (cancelled(o)) continue;
    revenueByCurrency[o.currency] = round2((revenueByCurrency[o.currency] ?? 0) + o.totalPrice);
  }

  const awaiting = orders.filter((o) => o.requiresReview && !o.reviewDecision && !cancelled(o));
  const low = products.filter((p) => p.currentInventory <= p.reorderPoint);

  return {
    windowHours: SUMMARY_WINDOW_HOURS,
    ordersInWindow: recent.length,
    revenueByCurrency,
    awaitingReviewCount: awaiting.length,
    atRiskUsd: round2(awaiting.reduce((s, o) => s + o.totalPrice, 0)),
    highRiskInWindow: recent.filter((o) => o.riskLevel === "high" || o.riskLevel === "critical").length,
    lowStockCount: low.length,
    outOfStockCount: products.filter((p) => p.currentInventory <= 0).length,
    lowStockItems: low
      .sort((a, b) => a.currentInventory - b.currentInventory)
      .slice(0, 5)
      .map((p) => ({ title: p.title, sku: p.sku, inventory: p.currentInventory, reorderPoint: p.reorderPoint })),
  };
}

export function deterministicSummary(m: StoreMetrics): string {
  const revenue = Object.entries(m.revenueByCurrency)
    .map(([cur, v]) => `${v.toFixed(2)} ${cur}`)
    .join(" + ");
  const parts = [
    `Last ${m.windowHours} hours: ${m.ordersInWindow} orders${revenue ? `, ${revenue} revenue` : ""}, ${m.highRiskInWindow} high-risk.`,
    m.awaitingReviewCount > 0
      ? `${m.awaitingReviewCount} orders await human review (${m.atRiskUsd.toFixed(2)} at risk).`
      : "No orders awaiting review.",
    m.lowStockCount > 0
      ? `${m.lowStockCount} products at or below reorder point (${m.outOfStockCount} out of stock)${
          m.lowStockItems[0] ? `, lowest: ${m.lowStockItems[0].title} with ${m.lowStockItems[0].inventory} units` : ""
        }.`
      : "No low-stock products.",
  ];
  return parts.join(" ");
}

export type StoreSummary = {
  source: "shopify" | "demo";
  metrics: StoreMetrics;
  summary: string;
  engine: "claude" | "deterministic";
  engineNote?: string;
  usage?: ClaudeUsage;
  generatedAt: string;
};

const SYSTEM = `You write a short daily briefing for an online store operator.
Rules:
- Every number you write MUST appear in the metrics JSON. Do not add, subtract, average or estimate anything.
- If a metric is 0, you may say "none" or "no".
- Mention orders awaiting human review and low stock when present; a human approves all actions.
- 3 to 5 sentences, plain text, no markdown, no greeting.`;

export async function buildStoreSummary(
  orders: StoredOrder[],
  products: StoredProduct[],
  source: "shopify" | "demo",
  now = Date.now()
): Promise<StoreSummary> {
  const metrics = computeStoreMetrics(orders, products, now);
  const base = { source, metrics, generatedAt: new Date(now).toISOString() };
  const fallback = deterministicSummary(metrics);

  const ai = await claudeText({
    feature: "store_summary",
    system: SYSTEM,
    prompt: `Metrics (JSON, computed by code):\n${JSON.stringify(metrics)}`,
    maxTokens: 400,
  });
  if (ai.text === null) {
    return { ...base, summary: fallback, engine: "deterministic", engineNote: `Deterministic summary — ${ai.error}.` };
  }
  const invented = unsupportedNumbers(ai.text, metrics);
  if (invented.length) {
    return {
      ...base,
      summary: fallback,
      engine: "deterministic",
      engineNote: `Claude's text was discarded: it contained numbers not in the metrics (${invented.join(", ")}).`,
      usage: ai.usage,
    };
  }
  return { ...base, summary: ai.text, engine: "claude", usage: ai.usage };
}
