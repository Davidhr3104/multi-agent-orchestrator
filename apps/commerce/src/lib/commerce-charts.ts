import type { ReturnRequest, StoredInquiry, StoredOrder, StoredProduct } from "@helix/core";

/**
 * Pure helpers behind the Commerce charts. Everything here is derived from fields that exist on the
 * stored records — no margins, conversion, LTV or history are invented. Kept free of React so it is
 * unit-tested directly.
 */

export const RISK_ORDER = ["low", "medium", "high", "critical"] as const;
export type Risk = (typeof RISK_ORDER)[number];

/** Semantic risk colours: low green, medium yellow, high orange, critical red. */
export const RISK_COLOR: Record<Risk, string> = {
  low: "#34d399",
  medium: "#facc15",
  high: "#fb923c",
  critical: "#f87171",
};

export const RISK_LABEL: Record<Risk, string> = { low: "Low", medium: "Medium", high: "High", critical: "Critical" };

const DAY_MS = 86_400_000;

/** "gid://shopify/Order/1005" -> "#1005". Falls back to the raw id when no number is present. */
export function orderNumber(shopifyOrderId: string): string {
  const match = shopifyOrderId.match(/(\d+)\s*$/);
  return match ? `#${match[1]}` : shopifyOrderId;
}

export function pluralize(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`;
}

export function riskCounts(orders: readonly StoredOrder[]): Record<Risk, number> {
  const out: Record<Risk, number> = { low: 0, medium: 0, high: 0, critical: 0 };
  for (const o of orders) if (o.riskLevel in out) out[o.riskLevel] += 1;
  return out;
}

export function riskSlices(orders: readonly StoredOrder[]) {
  const counts = riskCounts(orders);
  return RISK_ORDER.filter((r) => counts[r] > 0).map((r) => ({ label: RISK_LABEL[r], value: counts[r], color: RISK_COLOR[r] }));
}

export function riskSegments(orders: readonly StoredOrder[]) {
  const counts = riskCounts(orders);
  return RISK_ORDER.map((r) => ({ label: RISK_LABEL[r], value: counts[r], color: RISK_COLOR[r] }));
}

export type DayBucket = { label: string; revenue: number; orders: number };

/** Buckets orders by age in whole days (today is the last bucket). Orders older than `days` are dropped. */
export function dailyBuckets(orders: readonly StoredOrder[], days: number, now = Date.now()): DayBucket[] {
  const buckets: DayBucket[] = Array.from({ length: days }, (_, i) => {
    const d = new Date(now - (days - 1 - i) * DAY_MS);
    return { label: d.toLocaleDateString("en-US", { month: "short", day: "numeric" }), revenue: 0, orders: 0 };
  });
  for (const o of orders) {
    const age = Math.floor((now - new Date(o.createdAt).getTime()) / DAY_MS);
    const idx = days - 1 - age;
    if (idx >= 0 && idx < days) {
      buckets[idx].revenue += o.totalPrice;
      buckets[idx].orders += 1;
    }
  }
  return buckets;
}

/** Dollars exposed per order: order total weighted by its fraud score (0-100). */
export function exposureUsd(order: Pick<StoredOrder, "totalPrice" | "fraudScore">): number {
  return Math.round(order.totalPrice * (Math.max(0, Math.min(100, order.fraudScore)) / 100) * 100) / 100;
}

export function revenueByProduct(orders: readonly StoredOrder[]): { label: string; value: number; units: number }[] {
  const map = new Map<string, { value: number; units: number }>();
  for (const o of orders) {
    for (const it of o.items) {
      const cur = map.get(it.title) ?? { value: 0, units: 0 };
      cur.value += it.price * it.quantity;
      cur.units += it.quantity;
      map.set(it.title, cur);
    }
  }
  return [...map.entries()].map(([label, v]) => ({ label, ...v })).sort((a, b) => b.value - a.value);
}

export type CustomerRow = {
  email: string;
  name: string;
  orderCount: number;
  lifetimeOrders: number;
  totalSpend: number;
  lastOrderAt: string;
  hasCriticalRisk: boolean;
  segment: "new" | "returning";
};

/**
 * Groups orders by e-mail. `lifetimeOrders` is the larger of the orders seen on this desk and the
 * store's own count for the customer, and never less than 1 (the order we are looking at exists).
 */
export function aggregateCustomers(orders: readonly StoredOrder[]): CustomerRow[] {
  const byEmail = new Map<string, CustomerRow>();
  for (const o of orders) {
    const cur = byEmail.get(o.customerEmail);
    if (cur) {
      cur.orderCount += 1;
      cur.totalSpend += o.totalPrice;
      if (o.createdAt > cur.lastOrderAt) cur.lastOrderAt = o.createdAt;
      cur.hasCriticalRisk = cur.hasCriticalRisk || o.riskLevel === "critical";
      cur.lifetimeOrders = Math.max(cur.lifetimeOrders, o.customerOrderCount, cur.orderCount);
    } else {
      byEmail.set(o.customerEmail, {
        email: o.customerEmail,
        name: o.customerName,
        orderCount: 1,
        lifetimeOrders: lifetimeOrders(o),
        totalSpend: o.totalPrice,
        lastOrderAt: o.createdAt,
        hasCriticalRisk: o.riskLevel === "critical",
        segment: "new",
      });
    }
  }
  const rows = [...byEmail.values()];
  for (const r of rows) r.segment = r.lifetimeOrders > 1 ? "returning" : "new";
  return rows.sort((a, b) => b.totalSpend - a.totalSpend);
}

/** Orders a customer has placed, as far as this order record can tell. Never below 1. */
export function lifetimeOrders(order: Pick<StoredOrder, "customerOrderCount">): number {
  return Math.max(1, order.customerOrderCount || 0);
}

export type StockStatus = "out" | "low" | "ok";

export function stockStatus(p: Pick<StoredProduct, "currentInventory" | "reorderPoint">): StockStatus {
  if (p.currentInventory <= 0) return "out";
  return p.currentInventory <= p.reorderPoint ? "low" : "ok";
}

export const STOCK_COLOR: Record<StockStatus, string> = { out: "#f87171", low: "#f59e0b", ok: "#34d399" };

/** Whole days of stock left at the trailing sales velocity. null when nothing is selling (no honest estimate). */
export function daysOfCover(p: Pick<StoredProduct, "currentInventory" | "salesVelocity">): number | null {
  if (p.salesVelocity <= 0) return null;
  return Math.floor(p.currentInventory / p.salesVelocity);
}

export function inventoryValue(p: Pick<StoredProduct, "currentInventory" | "price">): number {
  return Math.max(0, p.currentInventory) * p.price;
}

export function countBy<T extends string>(items: readonly StoredInquiry[], pick: (i: StoredInquiry) => T): { key: T; count: number }[] {
  const map = new Map<T, number>();
  for (const i of items) map.set(pick(i), (map.get(pick(i)) ?? 0) + 1);
  return [...map.entries()].map(([key, count]) => ({ key, count })).sort((a, b) => b.count - a.count);
}

export function returnStats(returns: readonly ReturnRequest[], orderCount: number) {
  const refunded = returns.filter((r) => r.status === "refunded" || r.status === "approved");
  const refundUsd = refunded.reduce((s, r) => s + r.refundAmount, 0);
  const pendingUsd = returns.filter((r) => r.status === "requested").reduce((s, r) => s + r.refundAmount, 0);
  return {
    count: returns.length,
    refundUsd,
    pendingUsd,
    /** Returns / orders as a percentage, or null when there are no orders to divide by. */
    ratePct: orderCount > 0 ? Math.round((returns.length / orderCount) * 1000) / 10 : null,
  };
}

/** Humanises an inquiry type such as "return_refund" -> "Return refund". */
export function humanize(key: string): string {
  const s = key.replace(/_/g, " ");
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Open high-risk dollars by the day the order was placed (not a history of the $-at-risk figure). */
export function dailyOpenRiskUsd(orders: readonly StoredOrder[], days: number, now = Date.now()): number[] {
  const open = orders.filter(
    (o) => (o.riskLevel === "high" || o.riskLevel === "critical") && o.reviewDecision !== "cancelled" && o.reviewDecision !== "approved"
  );
  return dailyBuckets(open, days, now).map((b) => b.revenue);
}
