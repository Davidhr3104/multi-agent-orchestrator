import { suggestReorderQuantity, type StoredOrder, type StoredProduct } from "@helix/core";
import { claudeText, unsupportedNumbers, type ClaudeUsage } from "@/lib/claude-usage";

export const VELOCITY_WINDOW_DAYS = 30;
/** Same lead time the inventory heuristic uses to decide a restock is due. */
export const RESTOCK_LEAD_DAYS = 14;
export const RESTOCK_COVERAGE_DAYS = 30;

const DAY_MS = 86_400_000;

export type SkuVelocity = { sku: string; unitsSold: number; orders: number; perDay: number };

export type VelocityReport = {
  windowDays: number;
  /** Days actually divided by: the window, or less when the order history is shorter than the window. */
  observedDays: number;
  ordersInWindow: number;
  bySku: Record<string, SkuVelocity>;
};

function isCancelled(o: StoredOrder): boolean {
  return (
    o.reviewDecision === "cancelled" ||
    o.fulfillmentStatus === "cancelled" ||
    o.financialStatus === "voided" ||
    o.financialStatus === "refunded"
  );
}

export function skuKey(sku: string | undefined, title: string): string {
  return (sku?.trim() || `title:${title.trim().toLowerCase()}`).toUpperCase();
}

/**
 * Units per day per SKU over the last `windowDays`, from order line items. Cancelled, voided and
 * refunded orders are excluded. When the oldest order in the window is newer than the window start
 * (young store, or only the latest N orders were fetched), dividing by the full window would
 * understate velocity, so it divides by the observed span instead (min 1 day).
 */
export function computeSalesVelocity(
  orders: StoredOrder[],
  opts: { windowDays?: number; now?: number } = {}
): VelocityReport {
  const windowDays = opts.windowDays ?? VELOCITY_WINDOW_DAYS;
  const now = opts.now ?? Date.now();
  const start = now - windowDays * DAY_MS;
  const inWindow = orders.filter((o) => {
    const t = new Date(o.createdAt).getTime();
    return Number.isFinite(t) && t >= start && t <= now && !isCancelled(o);
  });

  const oldest = inWindow.reduce((min, o) => Math.min(min, new Date(o.createdAt).getTime()), now);
  const observedDays = inWindow.length === 0 ? windowDays : Math.min(windowDays, Math.max(1, (now - oldest) / DAY_MS));

  const bySku: Record<string, SkuVelocity> = {};
  for (const o of inWindow) {
    const seen = new Set<string>();
    for (const item of o.items) {
      const key = skuKey(item.sku, item.title);
      const row = (bySku[key] ??= { sku: key, unitsSold: 0, orders: 0, perDay: 0 });
      row.unitsSold += Math.max(0, item.quantity);
      if (!seen.has(key)) {
        row.orders += 1;
        seen.add(key);
      }
    }
  }
  for (const row of Object.values(bySku)) row.perDay = Math.round((row.unitsSold / observedDays) * 100) / 100;

  return { windowDays, observedDays: Math.round(observedDays * 10) / 10, ordersInWindow: inWindow.length, bySku };
}

export type RestockLine = {
  productId: string;
  title: string;
  sku: string;
  currentInventory: number;
  reorderPoint: number;
  unitsSold: number;
  perDay: number;
  /** null when nothing sold in the window (no stockout projection possible). */
  daysOfCover: number | null;
  suggestedQuantity: number;
  reasoning: string;
};

export type RestockReport = {
  source: "shopify" | "demo";
  windowDays: number;
  observedDays: number;
  ordersInWindow: number;
  leadDays: number;
  coverageDays: number;
  lines: RestockLine[];
  engine: "claude" | "deterministic";
  engineNote?: string;
  usage?: ClaudeUsage;
  /** Drafts only: nothing is sent to a supplier or written to Shopify. */
  draft: true;
};

/** All numbers (velocity, cover, suggested quantity) are computed here — the model never picks them. */
export function computeRestockLines(products: StoredProduct[], velocity: VelocityReport): RestockLine[] {
  const lines: RestockLine[] = [];
  for (const p of products) {
    const v = velocity.bySku[skuKey(p.sku, p.title)] ?? velocity.bySku[skuKey(undefined, p.title)];
    const perDay = v?.perDay ?? 0;
    const daysOfCover = perDay > 0 ? Math.floor(p.currentInventory / perDay) : null;
    const due = p.currentInventory <= p.reorderPoint || (daysOfCover !== null && daysOfCover <= RESTOCK_LEAD_DAYS);
    if (!due) continue;
    const suggestedQuantity = suggestReorderQuantity({
      salesVelocity: perDay,
      reorderPoint: p.reorderPoint,
      currentInventory: p.currentInventory,
    });
    lines.push({
      productId: p.id,
      title: p.title,
      sku: p.sku,
      currentInventory: p.currentInventory,
      reorderPoint: p.reorderPoint,
      unitsSold: v?.unitsSold ?? 0,
      perDay,
      daysOfCover,
      suggestedQuantity,
      reasoning: deterministicReason(p.currentInventory, p.reorderPoint, v?.unitsSold ?? 0, perDay, daysOfCover, suggestedQuantity),
    });
  }
  return lines.sort((a, b) => (a.daysOfCover ?? Infinity) - (b.daysOfCover ?? Infinity));
}

function deterministicReason(
  inventory: number,
  reorderPoint: number,
  unitsSold: number,
  perDay: number,
  daysOfCover: number | null,
  qty: number
): string {
  const sales =
    unitsSold > 0
      ? `${unitsSold} units sold in the window (${perDay}/day), ${daysOfCover} days of cover.`
      : "No sales in the window, but stock is at or below the reorder point.";
  return `${inventory} in stock vs reorder point ${reorderPoint}. ${sales} Suggest ${qty} units.`;
}

const SYSTEM = `You write short restock rationales for a store operator.
Rules:
- The suggested quantities are FINAL and were computed by code. Never propose a different number.
- Use ONLY numbers present in the JSON. Do not compute new numbers (no sums, percentages, or dates).
- One or two sentences per SKU, plain text.
- These are drafts: never say an order was placed or sent to a supplier.
Reply with ONLY a JSON object: {"<sku>": "<rationale>", ...}`;

export async function buildRestockReport(
  products: StoredProduct[],
  orders: StoredOrder[],
  source: "shopify" | "demo",
  now = Date.now()
): Promise<RestockReport> {
  const velocity = computeSalesVelocity(orders, { now });
  const lines = computeRestockLines(products, velocity);
  const base = {
    source,
    windowDays: velocity.windowDays,
    observedDays: velocity.observedDays,
    ordersInWindow: velocity.ordersInWindow,
    leadDays: RESTOCK_LEAD_DAYS,
    coverageDays: RESTOCK_COVERAGE_DAYS,
    draft: true as const,
  };
  if (lines.length === 0) return { ...base, lines, engine: "deterministic", engineNote: "No product is due for restock." };

  const payload = {
    windowDays: velocity.windowDays,
    observedDays: velocity.observedDays,
    leadDays: RESTOCK_LEAD_DAYS,
    coverageDays: RESTOCK_COVERAGE_DAYS,
    items: lines.map((l) => ({
      sku: l.sku,
      title: l.title,
      currentInventory: l.currentInventory,
      reorderPoint: l.reorderPoint,
      unitsSoldInWindow: l.unitsSold,
      unitsPerDay: l.perDay,
      daysOfCover: l.daysOfCover,
      suggestedQuantity: l.suggestedQuantity,
    })),
  };
  const ai = await claudeText({
    feature: "restock_reasoning",
    system: SYSTEM,
    prompt: `Restock data (JSON):\n${JSON.stringify(payload)}`,
    maxTokens: 700,
  });
  if (ai.text === null) {
    return { ...base, lines, engine: "deterministic", engineNote: `Deterministic reasoning — ${ai.error}.` };
  }

  let parsed: Record<string, unknown> | null = null;
  try {
    const body = ai.text.replace(/^```(?:json)?\s*|```\s*$/g, "");
    parsed = JSON.parse(body.slice(body.indexOf("{"), body.lastIndexOf("}") + 1)) as Record<string, unknown>;
  } catch {
    parsed = null;
  }
  if (!parsed) {
    return { ...base, lines, engine: "deterministic", engineNote: "Claude's reply was not valid JSON; deterministic reasoning shown.", usage: ai.usage };
  }

  const rejected: string[] = [];
  const withAi = lines.map((l) => {
    const text = typeof parsed![l.sku] === "string" ? String(parsed![l.sku]).trim() : "";
    if (!text) return l;
    const invented = unsupportedNumbers(text, payload);
    if (invented.length) {
      rejected.push(l.sku);
      return l;
    }
    return { ...l, reasoning: text };
  });
  return {
    ...base,
    lines: withAi,
    engine: "claude",
    engineNote: rejected.length
      ? `Claude cited numbers not in the data for ${rejected.join(", ")}; deterministic reasoning kept for those SKUs.`
      : undefined,
    usage: ai.usage,
  };
}
