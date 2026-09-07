"use client";

import type { StoredOrder } from "@helix/core";
import { AlertTriangle, CheckCircle2, X } from "lucide-react";
import { formatCurrency, formatTime } from "@/lib/format";
import { cn } from "@/lib/utils";

export function OrderInspector({
  order,
  onClose,
  onReview,
}: {
  order: StoredOrder;
  onClose: () => void;
  onReview: (decision: "approved" | "flagged" | "cancelled") => void;
}) {
  const reasons = order.fraudReasoning
    .split(". ")
    .map((s) => s.trim())
    .filter(Boolean)
    .filter((s) => !s.startsWith("Heuristic fraud score"));

  return (
    <div className="glass-panel space-y-5 rounded-xl p-5">
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-mono text-base font-semibold tracking-tight text-foreground">
              {order.shopifyOrderId.split("/").pop()}
            </span>
            {order.requiresReview ? (
              <span className="rounded bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium text-amber-400">
                HITL Review Req
              </span>
            ) : (
              <span className="rounded bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                {order.reviewDecision ?? "Reviewed"}
              </span>
            )}
          </div>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            Placed {formatTime(order.createdAt)} via Online Store
          </p>
        </div>
        <button
          onClick={onClose}
          className="flex size-6 items-center justify-center rounded text-muted-foreground transition hover:bg-black/[0.04] hover:text-foreground dark:hover:bg-white/[0.06]"
        >
          <X className="size-3.5" />
        </button>
      </div>

      <div className="space-y-3 rounded-lg border border-border bg-black/[0.015] p-4 dark:bg-white/[0.02]">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
            AI Agent Fraud Score
          </span>
          <span className="font-mono text-sm font-semibold text-foreground">
            {order.fraudScore} / 100
          </span>
        </div>
        <div className="h-1 w-full rounded-full bg-black/[0.06] dark:bg-white/[0.06]">
          <div
            className={cn(
              "h-1 rounded-full",
              order.riskLevel === "low" ? "bg-[#059669]" : "bg-[#dc2626]"
            )}
            style={{ width: `${Math.min(100, order.fraudScore)}%` }}
          />
        </div>

        <div className="space-y-1.5 text-xs">
          {reasons.map((reason, i) => (
            <div
              key={i}
              className="flex items-start gap-2 rounded p-2 text-[#b91c1c] dark:text-[#fca5a5]"
              style={{
                background: "rgba(239, 68, 68, 0.06)",
                border: "1px solid rgba(239, 68, 68, 0.15)",
              }}
            >
              <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-[#dc2626]" />
              <span>{reason}.</span>
            </div>
          ))}
        </div>

        {order.requiresReview ? (
          <div className="flex gap-2 pt-2">
            <button
              onClick={() => onReview("approved")}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-[#059669] px-3 py-2 text-xs font-medium text-white transition duration-150 hover:bg-[#059669]/85"
            >
              <CheckCircle2 className="size-4" />
              Approve Order
            </button>
            <button
              onClick={() => onReview("cancelled")}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-[#dc2626]/40 px-3 py-2 text-xs font-medium text-[#dc2626] transition duration-150 hover:bg-[#dc2626]/10"
            >
              <X className="size-4" />
              Refund &amp; Cancel
            </button>
          </div>
        ) : null}
      </div>

      <div className="space-y-4 pt-1">
        <div className="border-t border-border pt-3">
          <h3 className="mb-2 text-[10px] tracking-wider text-muted-foreground uppercase">
            Customer Dossier
          </h3>
          <div className="space-y-1 text-xs">
            <p className="font-medium text-foreground">{order.customerName}</p>
            <p className="text-muted-foreground">
              Lifetime Orders: <span className="text-foreground">{order.customerOrderCount}</span> ·
              Total Spend:{" "}
              <span className="font-mono text-foreground">
                {formatCurrency(order.totalPrice, order.currency)}
              </span>
            </p>
          </div>
        </div>

        <div className="border-t border-border pt-3">
          <h3 className="mb-2 text-[10px] tracking-wider text-muted-foreground uppercase">
            Order Items ({order.items.length})
          </h3>
          <div className="space-y-2 text-xs">
            {order.items.map((item, i) => (
              <div
                key={i}
                className="flex items-center justify-between rounded border border-border bg-black/[0.015] p-2 dark:bg-white/[0.02]"
              >
                <div>
                  <div className="font-medium text-foreground">{item.title}</div>
                  <div className="text-[11px] text-muted-foreground">
                    Qty: {item.quantity}
                    {item.sku ? ` · SKU: ${item.sku}` : ""}
                  </div>
                </div>
                <span className="font-mono font-medium text-foreground">
                  {formatCurrency(item.price * item.quantity, order.currency)}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="border-t border-border pt-3 text-xs">
          <h3 className="mb-1 text-[10px] tracking-wider text-muted-foreground uppercase">
            Destination Address
          </h3>
          <p className="text-secondary-foreground">
            {order.shippingAddress.address1
              ? `${order.shippingAddress.address1}, ${order.shippingAddress.city ?? ""} ${order.shippingAddress.country ?? ""}`
              : "No shipping address on file — treat as unverified."}
          </p>
        </div>
      </div>
    </div>
  );
}
