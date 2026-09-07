"use client";

import type { StoredProduct } from "@helix/core";
import { cn } from "@/lib/utils";

export function ReorderQueue({ products }: { products: StoredProduct[] }) {
  const urgent = products
    .filter((p) => p.restockRecommended)
    .sort((a, b) => a.predictedStockoutDays - b.predictedStockoutDays)
    .slice(0, 4);

  return (
    <div className="glass-panel space-y-4 rounded-xl p-5">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-medium text-foreground">Critical Low Stock Reorder Queue</h3>
          <p className="text-xs text-muted-foreground">
            Products projected to stock out within 14 days
          </p>
        </div>
        <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium text-amber-400">
          {urgent.length} Urgent
        </span>
      </div>

      <div className="space-y-3">
        {urgent.map((product) => {
          const pct = Math.min(
            100,
            Math.round((product.currentInventory / Math.max(product.reorderPoint * 2, 1)) * 100)
          );
          const critical = product.currentInventory <= product.reorderPoint / 2;
          return (
            <div
              key={product.id}
              className="flex items-center justify-between rounded-lg border border-border bg-black/[0.015] p-3 transition hover:border-black/10 dark:bg-white/[0.02] dark:hover:border-white/10"
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-foreground">{product.title}</span>
                  <span className="rounded bg-black/[0.04] px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground dark:bg-white/[0.04]">
                    SKU: {product.sku}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="h-1 w-36 rounded-full bg-black/[0.06] dark:bg-white/[0.06]">
                    <div
                      className={cn("h-1 rounded-full", critical ? "bg-[#dc2626]" : "bg-amber-500")}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span
                    className={cn(
                      "font-mono text-xs font-medium",
                      critical ? "text-[#dc2626]" : "text-amber-400"
                    )}
                  >
                    {product.currentInventory} / {product.reorderPoint * 2} left
                  </span>
                </div>
              </div>
              <button className="rounded bg-[#059669] px-3 py-1.5 text-xs font-medium text-white transition hover:bg-[#059669]/85">
                Quick Restock PO
              </button>
            </div>
          );
        })}
        {urgent.length === 0 ? (
          <p className="py-4 text-sm text-muted-foreground">No urgent restocks right now.</p>
        ) : null}
      </div>
    </div>
  );
}
