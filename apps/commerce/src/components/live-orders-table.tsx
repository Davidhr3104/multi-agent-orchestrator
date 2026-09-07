"use client";

import { useMemo, useState } from "react";
import type { StoredOrder } from "@helix/core";
import { MoreVertical } from "lucide-react";
import { formatCurrency, orderStatusPill } from "@/lib/format";
import { RiskScoreBar } from "@/components/risk-score-bar";
import { cn } from "@/lib/utils";

type Filter = "all" | "highRisk" | "review" | "clean";
const PAGE_SIZE = 5;

const STATUS_TONE: Record<string, string> = {
  review: "border-amber-500/25 bg-amber-500/10 text-amber-600 dark:text-amber-400",
  fulfilled: "border-primary/25 bg-primary/10 text-primary",
  transit: "border-cyan-500/25 bg-cyan-500/10 text-cyan-600 dark:text-cyan-400",
  pending: "border-amber-500/25 bg-amber-500/10 text-amber-600 dark:text-amber-400",
};

export function LiveOrdersTable({
  orders,
  selectedId,
  onSelect,
}: {
  orders: StoredOrder[];
  selectedId: string | null;
  onSelect: (order: StoredOrder) => void;
}) {
  const [filter, setFilter] = useState<Filter>("all");
  const [page, setPage] = useState(0);

  const counts = useMemo(
    () => ({
      all: orders.length,
      highRisk: orders.filter((o) => o.riskLevel === "high" || o.riskLevel === "critical").length,
      review: orders.filter((o) => o.requiresReview).length,
      clean: orders.filter((o) => o.riskLevel === "low").length,
    }),
    [orders]
  );

  const filtered = useMemo(() => {
    return orders.filter((o) => {
      if (filter === "highRisk") return o.riskLevel === "high" || o.riskLevel === "critical";
      if (filter === "review") return o.requiresReview;
      if (filter === "clean") return o.riskLevel === "low";
      return true;
    });
  }, [orders, filter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageOrders = filtered.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);

  function setFilterAndReset(f: Filter) {
    setFilter(f);
    setPage(0);
  }

  const filters: { id: Filter; label: string }[] = [
    { id: "all", label: `All (${counts.all})` },
    { id: "highRisk", label: `High Risk (${counts.highRisk})` },
    { id: "review", label: `Review (${counts.review})` },
    { id: "clean", label: `Clean (${counts.clean})` },
  ];

  return (
    <div className="glass-panel overflow-hidden rounded-xl">
      <div className="flex flex-col gap-3 border-b border-border p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-sm font-medium text-foreground">Live Orders Stream</h2>
          <p className="text-xs text-muted-foreground">
            Automated fraud detection and deterministic webhook routing
          </p>
        </div>
        <div className="flex items-center gap-1 rounded-lg bg-black/[0.03] p-1 dark:bg-white/[0.03]">
          {filters.map((f) => (
            <button
              key={f.id}
              onClick={() => setFilterAndReset(f.id)}
              className={cn(
                "rounded px-2.5 py-1 text-xs font-medium transition",
                filter === f.id
                  ? "bg-primary/15 text-primary"
                  : "text-muted-foreground hover:bg-black/[0.03] hover:text-foreground dark:hover:bg-white/[0.03]"
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-[13px] text-secondary-foreground">
          <thead className="border-b border-border text-[10px] tracking-wider text-muted-foreground uppercase">
            <tr>
              <th className="px-4 py-3">Order ID</th>
              <th className="px-4 py-3">Customer</th>
              <th className="px-4 py-3">Items</th>
              <th className="px-4 py-3">Total</th>
              <th className="px-4 py-3">Fulfillment</th>
              <th className="px-4 py-3">AI Risk Score</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {pageOrders.map((order) => {
              const pill = orderStatusPill(order);
              const selected = order.id === selectedId;
              return (
                <tr
                  key={order.id}
                  onClick={() => onSelect(order)}
                  className={cn(
                    "h-14 cursor-pointer transition-colors duration-150",
                    selected
                      ? "border-l-2 border-primary bg-primary/[0.06]"
                      : "hover:bg-emerald-50/30 dark:hover:bg-white/[0.02]"
                  )}
                >
                  <td className="px-4 py-3 font-mono font-medium text-foreground">
                    <span className="flex items-center gap-1.5">
                      {order.requiresReview ? (
                        <span className="size-1 rounded-full bg-amber-500" />
                      ) : null}
                      #{order.shopifyOrderId.split("/").pop()}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-medium text-foreground">{order.customerName}</div>
                    <div className="text-[11px] text-muted-foreground">{order.customerEmail}</div>
                  </td>
                  <td className="px-4 py-3 text-secondary-foreground">
                    {order.items.reduce((n, i) => n + i.quantity, 0)} items
                  </td>
                  <td className="px-4 py-3 font-mono font-medium text-foreground">
                    {formatCurrency(order.totalPrice, order.currency)}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={cn(
                        "inline-flex items-center rounded border px-2 py-0.5 text-[10px] font-medium",
                        STATUS_TONE[pill.tone]
                      )}
                    >
                      {pill.label}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <RiskScoreBar score={order.fraudScore} level={order.riskLevel} />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button className="rounded p-1 text-muted-foreground transition hover:bg-black/[0.04] hover:text-foreground dark:hover:bg-white/[0.06]">
                      <MoreVertical className="size-4" />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {filtered.length === 0 ? (
          <p className="px-4 py-8 text-sm text-muted-foreground">No orders in this filter.</p>
        ) : null}
      </div>

      <div className="flex items-center justify-between border-t border-border p-3 text-xs text-muted-foreground">
        <span>
          Showing {filtered.length === 0 ? 0 : page * PAGE_SIZE + 1}-
          {Math.min(filtered.length, page * PAGE_SIZE + PAGE_SIZE)} of {filtered.length} orders
        </span>
        <div className="flex items-center gap-2">
          <button
            disabled={page === 0}
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            className="rounded border border-border bg-black/[0.02] px-2.5 py-1 transition hover:text-foreground disabled:opacity-40 dark:bg-white/[0.02]"
          >
            Previous
          </button>
          <button
            disabled={page >= totalPages - 1}
            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
            className="rounded bg-primary px-2.5 py-1 font-medium text-primary-foreground transition hover:bg-primary/80 disabled:opacity-40"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}
