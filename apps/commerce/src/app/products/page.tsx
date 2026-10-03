"use client";

import { useEffect, useState } from "react";
import type { ReorderRequest, StoredOrder, StoredProduct } from "@helix/core";
import { formatCurrency } from "@/lib/format";
import { KpiCard } from "@helix/ui";
import { AiToast } from "@/components/ai-desk-events";
import { AskAiDrawer } from "@/components/ask-ai-drawer";
import { ProductThumbnail } from "@/components/inventory-catalog";
import { ProductDetailDrawer } from "@/components/product-detail-drawer";
import { StockBar } from "@/components/stock-bar";
import { inventoryValue, stockStatus } from "@/lib/commerce-charts";
import { createDraftReorders, draftResultMessage } from "@/lib/reorder-client";

export default function ProductsPage() {
  const [products, setProducts] = useState<StoredProduct[]>([]);
  const [orders, setOrders] = useState<StoredOrder[]>([]);
  const [reorders, setReorders] = useState<ReorderRequest[]>([]);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [askOpen, setAskOpen] = useState(false);
  const [askQuestion, setAskQuestion] = useState<string | undefined>(undefined);

  useEffect(() => {
    void (async () => {
      const res = await fetch("/api/products");
      const data = (await res.json()) as { products: StoredProduct[] };
      setProducts(data.products);
    })();
    void (async () => {
      const [o, r] = await Promise.all([fetch("/api/orders"), fetch("/api/reorders")]);
      setOrders(((await o.json()) as { orders: StoredOrder[] }).orders);
      setReorders(((await r.json()) as { reorders: ReorderRequest[] }).reorders);
    })();
  }, []);

  useEffect(() => {
    if (!notice) return;
    const t = window.setTimeout(() => setNotice(null), 5000);
    return () => window.clearTimeout(t);
  }, [notice]);

  async function draft(p: StoredProduct) {
    setBusy(true);
    setError(null);
    const result = await createDraftReorders([p]);
    setBusy(false);
    if (result.created.length) setReorders((prev) => [...result.created, ...prev]);
    setNotice(draftResultMessage(result, 1));
    setError(result.operatorError ?? (result.failures.length ? result.failures.join(" · ") : null));
  }

  const detail = products.find((p) => p.id === detailId) ?? null;
  const value = products.reduce((n, p) => n + inventoryValue(p), 0);
  const low = products.filter((p) => stockStatus(p) !== "ok").length;
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
                      <ProductThumbnail product={p} size={40} onOpen={() => setDetailId(p.id)} />
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

      <AiToast message={notice} />
      <ProductDetailDrawer
        product={detail}
        onOpenChange={(open) => {
          if (open) return;
          setDetailId(null);
          setError(null);
        }}
        orders={orders}
        reorders={reorders}
        busy={busy}
        error={error}
        onCreateDraft={draft}
        onAskAi={(p) => {
          setDetailId(null);
          setAskQuestion(`Tell me about ${p.title} (SKU ${p.sku}): current stock, sales velocity, recent orders, and whether I should reorder.`);
          setAskOpen(true);
        }}
      />
      <AskAiDrawer open={askOpen} onOpenChange={setAskOpen} initialQuestion={askQuestion} />
    </div>
  );
}
