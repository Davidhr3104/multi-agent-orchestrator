"use client";

import { useEffect, useState } from "react";
import type { ReorderRequest, StoredProduct } from "@helix/core";
import { ReorderQueue } from "@/components/reorder-queue";
import { cn } from "@/lib/utils";
import { EmptyChart, HBarList } from "@helix/ui";
import { DeskChartCard } from "@/components/desk-mode";
import { StockBar } from "@/components/stock-bar";
import { STOCK_COLOR, stockStatus } from "@/lib/commerce-charts";

export default function InventoryPage() {
  const [products, setProducts] = useState<StoredProduct[]>([]);
  const [reorders, setReorders] = useState<ReorderRequest[]>([]);

  useEffect(() => {
    void (async () => {
      const res = await fetch("/api/products");
      const data = (await res.json()) as { products: StoredProduct[] };
      setProducts(data.products);
    })();
    void (async () => {
      const res = await fetch("/api/reorders");
      const data = (await res.json()) as { reorders: ReorderRequest[] };
      setReorders(data.reorders);
    })();
  }, []);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Inventory</h1>
        <p className="mt-1 text-xs text-muted-foreground">
          Stockout prediction from current inventory and sales velocity.
        </p>
      </div>

      <ReorderQueue
        products={products}
        reorders={reorders}
        onReorderCreated={(r) => setReorders((prev) => [r, ...prev])}
      />

      <DeskChartCard
        title="Days until stockout"
        subtitle="Marker at 14 days"
        source="Source: predictedStockoutDays from current inventory and trailing sales velocity."
      >
        {products.length === 0 ? (
          <EmptyChart label="No products yet" />
        ) : (
          <HBarList
            items={[...products]
              .filter((p) => p.predictedStockoutDays !== null && p.predictedStockoutDays !== undefined)
              .sort((a, b) => a.predictedStockoutDays - b.predictedStockoutDays)
              .map((p) => ({ label: p.title, value: p.predictedStockoutDays, color: STOCK_COLOR[stockStatus(p)], hint: `${p.currentInventory} on hand` }))}
            format={(n) => `${n}d`}
            marker={14}
            markerLabel="14d"
          />
        )}
      </DeskChartCard>

      <div className="glass-panel glass-panel-glow overflow-hidden rounded-xl shadow-2xl">
        <div className="overflow-x-auto">
          <table className="min-w-[640px] w-full text-left text-xs text-secondary-foreground">
            <thead className="border-b border-primary/20 bg-black/[0.02] font-mono text-[11px] tracking-wider text-primary/80 uppercase dark:bg-[#051913]/90">
              <tr>
                <th className="px-4 py-3">Product</th>
                <th className="px-4 py-3">SKU</th>
                <th className="px-4 py-3">Stock vs reorder</th>
                <th className="px-4 py-3">Velocity</th>
                <th className="px-4 py-3">Stockout</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-primary/20">
              {products.map((p) => (
                <tr
                  key={p.id}
                  className={cn("transition hover:bg-primary/10", p.restockRecommended && "bg-amber-500/5")}
                >
                  <td className="px-4 py-3 font-medium text-foreground">{p.title}</td>
                  <td className="px-4 py-3 font-mono text-primary/80">{p.sku}</td>
                  <td className="px-4 py-3"><StockBar product={p} /></td>
                  <td className="px-4 py-3 font-mono text-muted-foreground">
                    {p.salesVelocity}/day
                  </td>
                  <td className="px-4 py-3">
                    {p.restockRecommended ? (
                      <span className="rounded border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 font-mono text-[11px] text-amber-600 dark:text-amber-300">
                        {p.predictedStockoutDays}d — restock
                      </span>
                    ) : (
                      <span className="font-mono text-muted-foreground">
                        {p.predictedStockoutDays}d
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {products.length === 0 ? (
            <p className="px-4 py-8 text-sm text-muted-foreground">No products yet.</p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
