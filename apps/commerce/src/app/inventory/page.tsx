"use client";

import { useEffect, useState } from "react";
import type { StoredProduct } from "@helix/core";
import { ReorderQueue } from "@/components/reorder-queue";
import { cn } from "@/lib/utils";

export default function InventoryPage() {
  const [products, setProducts] = useState<StoredProduct[]>([]);

  useEffect(() => {
    void (async () => {
      const res = await fetch("/api/products");
      const data = (await res.json()) as { products: StoredProduct[] };
      setProducts(data.products);
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

      <ReorderQueue products={products} />

      <div className="glass-panel glass-panel-glow overflow-hidden rounded-xl shadow-2xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-secondary-foreground">
            <thead className="border-b border-primary/20 bg-black/[0.02] font-mono text-[11px] tracking-wider text-primary/80 uppercase dark:bg-[#051913]/90">
              <tr>
                <th className="px-4 py-3">Product</th>
                <th className="px-4 py-3">SKU</th>
                <th className="px-4 py-3">Inventory</th>
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
                  <td className="px-4 py-3 font-mono text-foreground">{p.currentInventory}</td>
                  <td className="px-4 py-3 font-mono text-muted-foreground">
                    {p.salesVelocity}/day
                  </td>
                  <td className="px-4 py-3">
                    {p.restockRecommended ? (
                      <span className="rounded border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 font-mono text-[10px] text-amber-600 dark:text-amber-300">
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
