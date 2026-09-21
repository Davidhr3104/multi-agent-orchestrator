"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { DeskRiskSummary, StoredOrder } from "@helix/core";
import { formatCurrency, formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { OrderInspector } from "@/components/order-inspector";

export function RiskDesk({
  initialOrders,
  initialRisk,
}: {
  initialOrders: StoredOrder[];
  initialRisk: DeskRiskSummary;
}) {
  const [orders, setOrders] = useState(initialOrders);
  const [risk, setRisk] = useState(initialRisk);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filter, setFilter] = useState<"at_risk" | "saved" | "all">("at_risk");

  async function refresh() {
    const res = await fetch("/api/risk", { cache: "no-store" });
    const data = (await res.json()) as { orders: StoredOrder[]; risk: DeskRiskSummary };
    setOrders(data.orders ?? []);
    setRisk(data.risk ?? initialRisk);
  }

  const selected = orders.find((o) => o.id === selectedId) ?? null;

  const ranked = useMemo(() => {
    const list = orders.filter((o) => {
      if (filter === "saved") {
        return o.reviewDecision === "cancelled" || o.fulfillmentStatus === "cancelled";
      }
      if (filter === "at_risk") {
        const high =
          o.requiresReview ||
          o.riskLevel === "high" ||
          o.riskLevel === "critical" ||
          o.fraudScore >= 50;
        if (!high) return false;
        if (o.reviewDecision === "cancelled" || o.reviewDecision === "approved") return false;
        return true;
      }
      return o.fraudScore >= 50 || o.requiresReview || o.reviewDecision === "cancelled";
    });
    return [...list].sort((a, b) => b.fraudScore - a.fraudScore || b.totalPrice - a.totalPrice);
  }, [orders, filter]);

  async function review(decision: "approved" | "flagged" | "cancelled") {
    if (!selected) return;
    const res = await fetch(`/api/orders/${selected.id}/review`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ decision }),
    });
    const data = (await res.json()) as { order?: StoredOrder };
    if (data.order) {
      setOrders((prev) => prev.map((o) => (o.id === data.order!.id ? data.order! : o)));
      await refresh();
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">$ at risk</h1>
          <p className="mt-1 max-w-2xl text-xs text-muted-foreground">
            Money exposed in high-risk orders waiting on HITL, vs dollars blocked by cancel. This is the
            Commerce sell story — not another Shopify admin clone.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => void refresh()}
            className="text-xs font-medium text-muted-foreground hover:text-foreground"
          >
            Refresh
          </button>
          <Link href="/orders" className="text-xs font-medium text-primary hover:underline">
            Open full orders →
          </Link>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat
          label="$ at risk"
          value={formatCurrency(risk.atRiskUsd)}
          hint={`${risk.pendingReviewCount} pending · ${risk.flaggedCount} flagged`}
          hot
        />
        <Stat
          label="$ saved"
          value={formatCurrency(risk.savedUsd)}
          hint={`${risk.cancelledCount} cancelled before ship`}
          good
        />
        <Stat
          label="Approved high-risk"
          value={formatCurrency(risk.approvedHighRiskUsd)}
          hint={`${risk.approvedHighRiskCount} override(s)`}
        />
        <Stat
          label="Worst open"
          value={risk.worstOrderLabel ?? "—"}
          hint={
            risk.worstOrderUsd
              ? `${formatCurrency(risk.worstOrderUsd)} · score ${risk.worstFraudScore}`
              : "No open high-risk"
          }
        />
      </div>

      <div className="flex flex-wrap gap-2">
        {(
          [
            ["at_risk", "Open risk"],
            ["saved", "Saved (cancelled)"],
            ["all", "All risk-related"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setFilter(id)}
            className={cn(
              "rounded-lg border px-3 py-1.5 text-xs font-medium transition",
              filter === id
                ? "border-primary/40 bg-primary/10 text-primary"
                : "border-border text-muted-foreground hover:text-foreground"
            )}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-12">
        <div className="glass-panel overflow-hidden rounded-xl lg:col-span-8">
          <div className="border-b border-border/60 px-4 py-3 text-xs font-medium text-muted-foreground">
            Orders by fraud score · {orders.length} total · {ranked.length} shown
          </div>
          {ranked.length === 0 ? (
            <p className="px-4 py-8 text-sm text-muted-foreground">
              No matching orders. Load demo in Settings or Sync Shopify, then score high-risk orders.
            </p>
          ) : (
            <table className="w-full text-left text-xs">
              <thead className="border-b border-border/50 text-[10px] uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-2 font-medium">Order</th>
                  <th className="px-3 py-2 font-medium">Customer</th>
                  <th className="px-3 py-2 font-medium">$</th>
                  <th className="px-3 py-2 font-medium">Score</th>
                  <th className="px-3 py-2 font-medium">Risk</th>
                  <th className="px-3 py-2 font-medium">Decision</th>
                  <th className="px-3 py-2 font-medium">Date</th>
                </tr>
              </thead>
              <tbody>
                {ranked.map((o) => (
                  <tr
                    key={o.id}
                    onClick={() => setSelectedId(o.id)}
                    className={cn(
                      "cursor-pointer border-b border-border/30 hover:bg-white/[0.03]",
                      selectedId === o.id && "bg-primary/5"
                    )}
                  >
                    <td className="px-4 py-2.5 font-medium text-foreground">{o.shopifyOrderId}</td>
                    <td className="px-3 py-2.5 text-muted-foreground">{o.customerName}</td>
                    <td className="px-3 py-2.5 text-foreground">
                      {formatCurrency(o.totalPrice, o.currency)}
                    </td>
                    <td
                      className={cn(
                        "px-3 py-2.5 font-semibold",
                        o.fraudScore >= 75
                          ? "text-rose-400"
                          : o.fraudScore >= 50
                            ? "text-amber-400"
                            : "text-foreground"
                      )}
                    >
                      {o.fraudScore}
                    </td>
                    <td className="px-3 py-2.5 capitalize text-muted-foreground">{o.riskLevel}</td>
                    <td className="px-3 py-2.5 text-muted-foreground">
                      {o.reviewDecision ?? (o.requiresReview ? "needs review" : "—")}
                    </td>
                    <td className="px-3 py-2.5 text-muted-foreground">{formatDate(o.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="lg:col-span-4">
          {selected ? (
            <OrderInspector
              order={selected}
              onClose={() => setSelectedId(null)}
              onReview={(decision) => void review(decision)}
            />
          ) : (
            <div className="glass-panel glass-panel-glow rounded-xl p-5 text-sm text-muted-foreground shadow-2xl">
              Select an order to approve, flag, or cancel. Cancel moves $ into saved.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  hint,
  hot,
  good,
}: {
  label: string;
  value: string;
  hint: string;
  hot?: boolean;
  good?: boolean;
}) {
  return (
    <div className="glass-panel rounded-xl px-4 py-3">
      <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p
        className={cn(
          "mt-1 truncate text-xl font-semibold tracking-tight",
          hot ? "text-rose-400" : good ? "text-emerald-400" : "text-foreground"
        )}
      >
        {value}
      </p>
      <p className="mt-1 text-[11px] text-muted-foreground">{hint}</p>
    </div>
  );
}
