"use client";

import { useEffect, useState } from "react";
import type { StoredProduct } from "@helix/core";
import { formatCurrency } from "@/lib/format";
import { cn } from "@/lib/utils";

export default function ProductsPage() {
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
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Products</h1>
        <p className="mt-1 text-xs text-muted-foreground">Catalog synced from the store feed.</p>
      </div>

      <div className="glass-panel glass-panel-glow overflow-hidden rounded-xl shadow-2xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-secondary-foreground">
            <thead className="border-b border-primary/20 bg-black/[0.02] font-mono text-[11px] tracking-wider text-primary/80 uppercase dark:bg-[#051913]/90">
              <tr>
                <th className="px-4 py-3">Product</th>
                <th className="px-4 py-3">SKU</th>
                <th className="px-4 py-3">Inventory</th>
                <th className="px-4 py-3">Velocity</th>
                <th className="px-4 py-3">Price</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-primary/20">
              {products.map((p) => (
                <tr key={p.id} className="transition hover:bg-primary/10">
                  <td className="px-4 py-3 font-medium text-foreground">{p.title}</td>
                  <td className="px-4 py-3 font-mono text-primary/80">{p.sku}</td>
                  <td className="px-4 py-3">
                    <span
                      className={cn(
                        "font-mono",
                        p.currentInventory <= p.reorderPoint
                          ? "text-amber-600 dark:text-amber-300"
                          : "text-foreground"
                      )}
                    >
                      {p.currentInventory}
                    </span>
                    <span className="text-muted-foreground"> / reorder at {p.reorderPoint}</span>
                  </td>
                  <td className="px-4 py-3 font-mono text-muted-foreground">
                    {p.salesVelocity}/day
                  </td>
                  <td className="px-4 py-3 font-mono font-medium text-foreground">
                    {formatCurrency(p.price)}
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
