"use client";

import { useEffect, useState } from "react";
import type { StoredProduct } from "@helix/core";
import { formatCurrency } from "@/lib/format";
import { KpiCard, CoverArt } from "@helix/ui";
import { StockBar } from "@/components/stock-bar";
import { inventoryValue, stockStatus } from "@/lib/commerce-charts";

export default function ProductsPage() {
  const [products, setProducts] = useState<StoredProduct[]>([]);

  useEffect(() => {
    void (async () => {
      const res = await fetch("/api/products");
      const data = (await res.json()) as { products: StoredProduct[] };
      setProducts(data.products);
    })();
  }, []);

  const value = products.reduce((n, p) => n + inventoryValue(p), 0);
  const low = products.filter((p) => stockStatus(p) !== "ok").length;
  const PALETTE: [string, string][] = [["#065f46", "#0f766e"], ["#14532d", "#047857"], ["#134e4a", "#1e3a8a"], ["#064e3b", "#4d7c0f"]];

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Products</h1>
        <p className="mt-1 text-xs text-muted-foreground">Catalog synced from the store feed.</p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <KpiCard label="Products" value={String(products.length)} accent="#10b981" />
        <KpiCard label="Inventory value" value={formatCurrency(value)} accent="#10b981" hint="Units on hand x price" />
        <KpiCard label="At or below reorder" value={String(low)} accent="#f59e0b" hint={low ? "Needs restock" : "All healthy"} />
      </div>

      <div className="glass-panel glass-panel-glow overflow-hidden rounded-xl shadow-2xl">
        <div className="overflow-x-auto">
          <table className="min-w-[640px] w-full text-left text-xs text-secondary-foreground">
            <thead className="border-b border-primary/20 bg-black/[0.02] font-mono text-[11px] tracking-wider text-primary/80 uppercase dark:bg-[#051913]/90">
              <tr>
                <th className="px-4 py-3">Product</th>
                <th className="px-4 py-3">SKU</th>
                <th className="px-4 py-3">Stock vs reorder</th>
                <th className="px-4 py-3">Velocity</th>
                <th className="px-4 py-3">Price</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-primary/20">
              {products.map((p) => (
                <tr key={p.id} className="transition hover:bg-primary/10">
                  <td className="px-4 py-3 font-medium text-foreground">
                    <div className="flex items-center gap-3">
                      <div className="w-12 shrink-0" title={p.imageUrl ? undefined : "Generated cover, not a product photo"}>
                        {p.imageUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={p.imageUrl} alt="" className="h-10 w-12 rounded-lg object-cover" />
                        ) : (
                          <CoverArt colors={PALETTE[[...p.title].reduce((n, c) => n + c.charCodeAt(0), 0) % PALETTE.length]} height={40} label="Generated cover, no product photo" />
                        )}
                      </div>
                      <span>{p.title}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 font-mono text-primary/80">{p.sku}</td>
                  <td className="px-4 py-3">
                    <StockBar product={p} />
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
