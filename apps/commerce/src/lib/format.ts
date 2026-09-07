export function formatCurrency(amount: number, currency = "USD"): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(amount);
}

export function formatDate(iso: string): string {
  return iso.slice(0, 10);
}

export function formatRelativeDate(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const diffDays = Math.floor(diffMs / 86_400_000);
  if (diffDays <= 0) return "today";
  if (diffDays === 1) return "1 day ago";
  return `${diffDays} days ago`;
}

export function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    timeZoneName: "short",
  });
}

export type OrderStatusPill = {
  label: string;
  tone: "review" | "fulfilled" | "transit" | "pending";
};

/** Derives a single display status from the order's real fields — never a fabricated state. */
export function orderStatusPill(order: {
  requiresReview: boolean;
  fulfillmentStatus: string;
  financialStatus: string;
}): OrderStatusPill {
  if (order.requiresReview) return { label: "Review Req", tone: "review" };
  if (order.financialStatus === "pending") return { label: "Pending Payment", tone: "pending" };
  if (order.fulfillmentStatus === "fulfilled") return { label: "Fulfilled", tone: "fulfilled" };
  return { label: "In Transit", tone: "transit" };
}
