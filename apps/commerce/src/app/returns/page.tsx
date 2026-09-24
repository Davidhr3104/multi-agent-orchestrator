"use client";

import { useEffect, useState } from "react";
import type { ReturnRequest } from "@helix/core";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/format";

export default function ReturnsPage() {
  const [returns, setReturns] = useState<ReturnRequest[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    const res = await fetch("/api/returns");
    const data = (await res.json()) as { returns: ReturnRequest[] };
    setReturns(data.returns);
  }

  useEffect(() => {
    void refresh();
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Returns / RMA</h1>
        <p className="mt-1 text-xs text-muted-foreground">
          Approving a return refunds the order via Shopify (real orders) or marks it refunded (demo orders).
        </p>
      </div>

      {error ? <p className="text-xs text-[#dc2626]">{error}</p> : null}

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
              <div className="flex gap-2">
                <button
                  disabled={busyId === r.id}
                  onClick={() => void resolve(r.id, "approved")}
                  className="rounded bg-[#059669] px-3 py-1.5 font-medium text-white disabled:opacity-50"
                >
                  {busyId === r.id ? "…" : "Approve refund"}
                </button>
                <button
                  disabled={busyId === r.id}
                  onClick={() => void resolve(r.id, "rejected")}
                  className="rounded border border-[#dc2626]/40 px-3 py-1.5 font-medium text-[#dc2626] disabled:opacity-50"
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
