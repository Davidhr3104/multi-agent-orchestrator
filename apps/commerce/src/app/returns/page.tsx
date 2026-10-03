"use client";

import { useEffect, useState } from "react";
import type { ReturnRequest } from "@helix/core";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/format";
import { DemoChip, KpiCard } from "@helix/ui";
import { PackageOpen } from "lucide-react";
import { returnStats } from "@/lib/commerce-charts";

export default function ReturnsPage() {
  const [returns, setReturns] = useState<ReturnRequest[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [orderCount, setOrderCount] = useState(0);
  const [loaded, setLoaded] = useState(false);

  async function refresh() {
    const res = await fetch("/api/returns");
    const data = (await res.json()) as { returns: ReturnRequest[] };
    setReturns(data.returns);
    setLoaded(true);
  }

  useEffect(() => {
    void refresh();
    void fetch("/api/orders")
      .then((r) => r.json())
      .then((d: { orders: unknown[] }) => setOrderCount(d.orders.length))
      .catch(() => setOrderCount(0));
  }, []);

  async function resolve(id: string, decision: "approved" | "rejected") {
    setBusyId(id);
    setError(null);
    try {
      const res = await fetch(`/api/returns/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision }),
      });
      const data = (await res.json()) as { return?: ReturnRequest; error?: string };
      if (!res.ok) {
        setError(data.error ?? "Could not resolve return");
        return;
      }
      await refresh();
    } finally {
      setBusyId(null);
    }
  }

  const pending = returns.filter((r) => r.status === "requested");
  const resolved = returns.filter((r) => r.status !== "requested");
  const stats = returnStats(returns, orderCount);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Returns / RMA</h1>
        <p className="mt-1 text-xs text-muted-foreground">
          Approving a return refunds the order via Shopify (real orders) or marks it refunded (demo orders).
        </p>
      </div>

      {error ? <p className="text-xs text-[#dc2626]">{error}</p> : null}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard label="Returns" value={String(stats.count)} accent="#10b981" />
        <KpiCard label="Return rate" value={stats.ratePct === null ? "—" : `${stats.ratePct}%`} accent="#10b981" hint={`${stats.count} of ${orderCount} orders`} />
        <KpiCard label="Refunded" value={formatCurrency(stats.refundUsd)} accent="#34d399" hint="Approved or refunded" />
        <KpiCard label="Pending refunds" value={formatCurrency(stats.pendingUsd)} accent="#f59e0b" hint={`${pending.length} awaiting a decision`} />
      </div>

      {loaded && returns.length === 0 ? (
        <div className="glass-panel rounded-xl p-6">
          <div className="flex flex-col items-center gap-2 text-center">
            <span className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
              <PackageOpen className="size-6" aria-hidden />
            </span>
            <h2 className="text-sm font-medium text-foreground">No return requests yet</h2>
            <p className="max-w-md text-xs text-muted-foreground">
              Open a fulfilled order and choose Request return. It lands here for you to approve or reject.
            </p>
          </div>
          <div className="mx-auto mt-5 max-w-xl rounded-lg border border-dashed border-border p-3 opacity-80">
            <div className="mb-2 flex items-center justify-between text-[11px] text-muted-foreground">
              <span>What a request looks like</span>
              <DemoChip />
            </div>
            <div className="flex items-center justify-between gap-3 text-xs" aria-hidden>
              <div>
                <p className="font-medium text-foreground">customer@example.com</p>
                <p className="text-muted-foreground">Item arrived damaged · $48.00 · restock</p>
              </div>
              <span className="rounded bg-primary/10 px-2 py-1 font-medium text-primary">Approve refund</span>
            </div>
          </div>
        </div>
      ) : null}

      <div className="glass-panel rounded-xl p-5">
        <h2 className="mb-3 text-sm font-medium text-foreground">Pending ({pending.length})</h2>
        <div className="space-y-2">
          {pending.map((r) => (
            <div
              key={r.id}
              className="flex items-center justify-between rounded-lg border border-border bg-black/[0.015] p-3 text-xs dark:bg-white/[0.02]"
            >
              <div>
                <p className="font-medium text-foreground">{r.customerEmail}</p>
                <p className="text-muted-foreground">
                  {r.reason} · {formatCurrency(r.refundAmount, "USD")}
                  {r.restock ? " · restock" : ""}
                </p>
              </div>
              <div className="flex shrink-0 flex-wrap gap-2">
                <button
                  disabled={busyId === r.id}
                  onClick={() => void resolve(r.id, "approved")}
                  className="min-h-10 rounded bg-[#059669] px-3 py-1.5 font-medium text-white disabled:opacity-50"
                >
                  {busyId === r.id ? "…" : "Approve refund"}
                </button>
                <button
                  disabled={busyId === r.id}
                  onClick={() => void resolve(r.id, "rejected")}
                  className="min-h-10 rounded border border-[#dc2626]/40 px-3 py-1.5 font-medium text-[#dc2626] disabled:opacity-50"
                >
                  Reject
                </button>
              </div>
            </div>
          ))}
          {pending.length === 0 ? <p className="text-sm text-muted-foreground">No pending returns.</p> : null}
        </div>
      </div>

      <div className="glass-panel rounded-xl p-5">
        <h2 className="mb-3 text-sm font-medium text-foreground">Resolved</h2>
        <div className="space-y-2">
          {resolved.map((r) => (
            <div
              key={r.id}
              className="flex items-center justify-between rounded-lg border border-border p-3 text-xs"
            >
              <div>
                <p className="text-foreground">{r.customerEmail}</p>
                <p className="text-muted-foreground">
                  {r.reason} · {formatCurrency(r.refundAmount, "USD")}
                </p>
              </div>
              <span
                className={cn(
                  "rounded px-2 py-0.5 font-medium",
                  r.status === "refunded" ? "bg-emerald-500/10 text-emerald-500" : "bg-black/[0.04] text-muted-foreground"
                )}
              >
                {r.status}
                {r.shopifyRefundId ? " · Shopify" : ""}
              </span>
            </div>
          ))}
          {resolved.length === 0 ? <p className="text-sm text-muted-foreground">Nothing resolved yet.</p> : null}
        </div>
      </div>
    </div>
  );
}
