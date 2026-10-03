import type { ReorderRequest, StoredOrder, StoredProduct } from "@helix/core";

/**
 * Pure helpers behind the Inventory page. Every figure is computed from fields that exist on the
 * stored products/orders (inventory, reorder point, price, trailing velocity, order line items).
 * There is no supplier, lead-time, capacity or per-size data in the store, so none is produced here.
 *
 * Runs in the browser, so it cannot import the @helix/core barrel or lib/restock (both reach
 * server-only code). The constants and the two formulas below mirror them; the tests pin the parity.
 */

const DAY_MS = 86_400_000;
export const RESTOCK_LEAD_DAYS = 14;
export const RESTOCK_COVERAGE_DAYS = 30;

export function skuKey(sku: string | undefined, title: string): string {
  return (sku?.trim() || `title:${title.trim().toLowerCase()}`).toUpperCase();
}

export function suggestReorderQuantity(input: Pick<StoredProduct, "salesVelocity" | "reorderPoint" | "currentInventory">): number {
  const coverageUnits = Math.ceil(input.salesVelocity * RESTOCK_COVERAGE_DAYS);
  const minUnits = Math.max(1, input.reorderPoint * 2 - input.currentInventory);
  return Math.max(coverageUnits, minUnits, 1);
}

/** Below this many days of cover a SKU is critical (half the restock lead time). */
export const CRITICAL_COVER_DAYS = Math.floor(RESTOCK_LEAD_DAYS / 2);
/** Above this many days of cover a SKU is overstocked (3x the reorder coverage window). */
export const OVERSTOCK_COVER_DAYS = RESTOCK_COVERAGE_DAYS * 3;

export type HealthTier = "urgent" | "watch" | "optimal" | "overstock";
export const HEALTH_ORDER: readonly HealthTier[] = ["urgent", "watch", "optimal", "overstock"];
export const HEALTH_LABEL: Record<HealthTier, string> = { urgent: "Urgent", watch: "Watch", optimal: "Optimal", overstock: "Overstock" };
export const HEALTH_COLOR: Record<HealthTier, string> = { urgent: "#f87171", watch: "#f59e0b", optimal: "#34d399", overstock: "#38bdf8" };

type ProductFields = Pick<StoredProduct, "currentInventory" | "reorderPoint" | "salesVelocity" | "price">;

/** Whole days of stock at the trailing velocity; null when nothing sells (no honest projection). */
export function coverDays(p: Pick<StoredProduct, "currentInventory" | "salesVelocity">): number | null {
  if (p.currentInventory <= 0) return 0;
  if (p.salesVelocity <= 0) return null;
  return Math.floor(p.currentInventory / p.salesVelocity);
}

/**
 * urgent: out of stock or under CRITICAL_COVER_DAYS of cover.
 * watch: at/below the reorder point or inside the restock lead time.
 * overstock: more than OVERSTOCK_COVER_DAYS of cover, or not selling with stock above 2x the reorder point.
 */
export function healthTier(p: ProductFields): HealthTier {
  const cover = coverDays(p);
  if (p.currentInventory <= 0 || (cover !== null && cover < CRITICAL_COVER_DAYS)) return "urgent";
  if (p.currentInventory <= p.reorderPoint || (cover !== null && cover <= RESTOCK_LEAD_DAYS)) return "watch";
  if ((cover !== null && cover > OVERSTOCK_COVER_DAYS) || (cover === null && p.currentInventory > p.reorderPoint * 2)) return "overstock";
  return "optimal";
}

/**
 * Stock level the reorder heuristic tops up to: 30 days of sales or 2x the reorder point, whichever
 * is larger. Used as the bar scale instead of a "capacity" the store does not record.
 */
export function targetStock(p: ProductFields): number {
  return Math.max(1, p.reorderPoint * 2, Math.ceil(p.salesVelocity * RESTOCK_COVERAGE_DAYS));
}

/** Units on hand as a whole percentage of targetStock (can exceed 100). */
export function targetPct(p: ProductFields): number {
  return Math.round((Math.max(0, p.currentInventory) / targetStock(p)) * 100);
}

/** Demand over the restock lead time that current stock cannot cover, in units. */
export function shortfallUnits(p: ProductFields, leadDays = RESTOCK_LEAD_DAYS): number {
  return Math.max(0, Math.ceil(p.salesVelocity * leadDays - Math.max(0, p.currentInventory)));
}

/** Revenue that would go unfilled during the lead time if nothing is reordered: shortfall x price. */
export function revenueAtRisk(p: ProductFields, leadDays = RESTOCK_LEAD_DAYS): number {
  return Math.round(shortfallUnits(p, leadDays) * p.price * 100) / 100;
}

/** Suggested reorder units (same heuristic the reorder API uses), or 0 when no restock is due. */
export function reorderSuggestion(p: ProductFields & Pick<StoredProduct, "restockRecommended">): number {
  return p.restockRecommended ? suggestReorderQuantity(p) : 0;
}

export function openReorderFor(reorders: readonly ReorderRequest[], productId: string): ReorderRequest | undefined {
  return reorders.find((r) => r.productId === productId && r.status !== "cancelled" && r.status !== "received");
}

export type InventorySummary = {
  skuCount: number;
  totalUnits: number;
  /** Units held by SKUs that are above their reorder point. */
  unitsAboveReorder: number;
  inventoryValue: number;
  lowStock: StoredProduct[];
  revenueAtRisk: number;
  /** Revenue of the next lead-time window of demand at the trailing velocity. */
  leadTimeDemandValue: number;
  worstAtRisk: StoredProduct | null;
  tiers: Record<HealthTier, number>;
  /** Optimal SKUs as a share of all SKUs, 0-100 (one decimal), or null with no SKUs. */
  healthyPct: number | null;
};

export function summarizeInventory(products: readonly StoredProduct[], leadDays = RESTOCK_LEAD_DAYS): InventorySummary {
  const tiers: Record<HealthTier, number> = { urgent: 0, watch: 0, optimal: 0, overstock: 0 };
  let totalUnits = 0;
  let unitsAboveReorder = 0;
  let inventoryValue = 0;
  let atRisk = 0;
  let demandValue = 0;
  let worst: StoredProduct | null = null;
  for (const p of products) {
    const units = Math.max(0, p.currentInventory);
    totalUnits += units;
    if (units > p.reorderPoint) unitsAboveReorder += units;
    inventoryValue += units * p.price;
    const risk = revenueAtRisk(p, leadDays);
    atRisk += risk;
    demandValue += Math.max(0, p.salesVelocity) * leadDays * p.price;
    if (risk > 0 && (!worst || risk > revenueAtRisk(worst, leadDays))) worst = p;
    tiers[healthTier(p)] += 1;
  }
  const lowStock = products
    .filter((p) => healthTier(p) === "urgent" || healthTier(p) === "watch")
    .sort((a, b) => (coverDays(a) ?? Infinity) - (coverDays(b) ?? Infinity));
  return {
    skuCount: products.length,
    totalUnits,
    unitsAboveReorder,
    inventoryValue: Math.round(inventoryValue * 100) / 100,
    lowStock,
    revenueAtRisk: Math.round(atRisk * 100) / 100,
    leadTimeDemandValue: Math.round(demandValue * 100) / 100,
    worstAtRisk: worst,
    tiers,
    healthyPct: products.length ? Math.round((tiers.optimal / products.length) * 1000) / 10 : null,
  };
}

export type TrajectoryPoint = { day: number; label: string; units: number };
export type Trajectory = {
  history: TrajectoryPoint[];
  projection: TrajectoryPoint[];
  /** Sum of reorder points: the floor below which the catalog is drawing on safety stock. */
  safetyUnits: number;
  /** First day offset (>0) at which some currently-stocked, selling SKU hits zero, or null. */
  firstStockoutDay: number | null;
};

function isVoid(o: StoredOrder): boolean {
  return o.reviewDecision === "cancelled" || o.fulfillmentStatus === "cancelled" || o.financialStatus === "voided" || o.financialStatus === "refunded";
}

function dayLabel(now: number, offset: number): string {
  return new Date(now + offset * DAY_MS).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

/**
 * History: today's units plus the units sold after each past day, from order line items matched to a
 * tracked SKU (receipts/restocks are not recorded, so this is a reconstruction, not a ledger).
 * Projection: each SKU depletes at its trailing velocity until it reaches zero.
 */
export function depletionTrajectory(
  products: readonly StoredProduct[],
  orders: readonly StoredOrder[],
  opts: { historyDays?: number; forecastDays?: number; now?: number } = {}
): Trajectory {
  const historyDays = opts.historyDays ?? 14;
  const forecastDays = opts.forecastDays ?? 14;
  const now = opts.now ?? Date.now();
  const tracked = new Set(products.map((p) => skuKey(p.sku, p.title)));
  const total = products.reduce((s, p) => s + Math.max(0, p.currentInventory), 0);

  const soldByAge = new Array<number>(historyDays + 1).fill(0);
  for (const o of orders) {
    if (isVoid(o)) continue;
    const age = Math.floor((now - new Date(o.createdAt).getTime()) / DAY_MS);
    if (!Number.isFinite(age) || age < 0 || age > historyDays) continue;
    for (const item of o.items) {
      if (tracked.has(skuKey(item.sku, item.title))) soldByAge[age] += Math.max(0, item.quantity);
    }
  }
  // Stock at the end of day -d = today's stock + everything sold on days -(d-1) .. 0.
  const history: TrajectoryPoint[] = [];
  let soldSince = 0;
  for (let d = 0; d <= historyDays; d++) {
    history.unshift({ day: d === 0 ? 0 : -d, label: dayLabel(now, -d), units: total + soldSince });
    soldSince += soldByAge[d];
  }

  const projection: TrajectoryPoint[] = [];
  for (let d = 0; d <= forecastDays; d++) {
    const units = products.reduce((s, p) => s + Math.max(0, Math.max(0, p.currentInventory) - Math.max(0, p.salesVelocity) * d), 0);
    projection.push({ day: d, label: dayLabel(now, d), units: Math.round(units * 10) / 10 });
  }

  const stockouts = products
    .filter((p) => p.currentInventory > 0 && p.salesVelocity > 0)
    .map((p) => Math.ceil(p.currentInventory / p.salesVelocity));
  return {
    history,
    projection,
    safetyUnits: products.reduce((s, p) => s + Math.max(0, p.reorderPoint), 0),
    firstStockoutDay: stockouts.length ? Math.min(...stockouts) : null,
  };
}

/** Estimated stock-out date at the trailing velocity: now when out, null when nothing sells. */
export function estimatedStockoutDate(p: Pick<StoredProduct, "currentInventory" | "salesVelocity">, now = Date.now()): Date | null {
  if (p.currentInventory <= 0) return new Date(now);
  const cover = coverDays(p);
  return cover === null ? null : new Date(now + cover * DAY_MS);
}

export type SkuOrderLine = {
  orderId: string;
  shopifyOrderId: string;
  createdAt: string;
  customerName: string;
  quantity: number;
  status: string;
};

function orderStatusLabel(o: StoredOrder): string {
  if (isVoid(o)) return o.financialStatus === "refunded" ? "Refunded" : "Cancelled";
  if (o.requiresReview && !o.reviewDecision) return "Needs review";
  if (o.financialStatus === "pending") return "Payment pending";
  return o.fulfillmentStatus === "fulfilled" ? "Fulfilled" : "Unfulfilled";
}

/** Orders containing this product (matched by SKU, or by title for SKU-less lines), newest first. */
export function ordersForProduct(orders: readonly StoredOrder[], p: Pick<StoredProduct, "sku" | "title">, limit = 8): SkuOrderLine[] {
  const key = skuKey(p.sku, p.title);
  const titleKey = skuKey(undefined, p.title);
  const lines: SkuOrderLine[] = [];
  for (const o of orders) {
    const qty = o.items.filter((it) => [key, titleKey].includes(skuKey(it.sku, it.title))).reduce((s, it) => s + Math.max(0, it.quantity), 0);
    if (qty === 0) continue;
    lines.push({ orderId: o.id, shopifyOrderId: o.shopifyOrderId, createdAt: o.createdAt, customerName: o.customerName, quantity: qty, status: orderStatusLabel(o) });
  }
  return lines.sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, limit);
}

export function reordersForProduct(reorders: readonly ReorderRequest[], productId: string): ReorderRequest[] {
  return reorders.filter((r) => r.productId === productId).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

const CSV_HEADER = [
  "Title",
  "SKU",
  "Units on hand",
  "Reorder point",
  "Target stock",
  "Velocity per day",
  "Days of cover",
  "Health",
  "Unit price",
  "Revenue at risk",
  "Suggested reorder",
] as const;

function csvCell(v: string | number): string {
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function inventoryCsv(products: readonly StoredProduct[]): string {
  const rows = products.map((p) => {
    const cover = coverDays(p);
    return [
      p.title,
      p.sku,
      p.currentInventory,
      p.reorderPoint,
      targetStock(p),
      p.salesVelocity,
      cover === null ? "" : cover,
      HEALTH_LABEL[healthTier(p)],
      p.price.toFixed(2),
      revenueAtRisk(p).toFixed(2),
      reorderSuggestion(p),
    ].map(csvCell);
  });
  return [CSV_HEADER.join(","), ...rows.map((r) => r.join(","))].join("\n");
}
