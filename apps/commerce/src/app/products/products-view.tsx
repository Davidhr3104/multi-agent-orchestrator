"use client";

import { useRef, useState, type DragEvent } from "react";
import type { StoredProduct } from "@helix/core";
import { formatCurrency } from "@/lib/format";
import { cn } from "@/lib/utils";

export function ProductsView({ initialProducts }: { initialProducts: StoredProduct[] }) {
  const [products, setProducts] = useState<StoredProduct[]>(initialProducts);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [replace, setReplace] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function importFile(file: File) {
    setBusy(true);
    setError(null);
    setNote(null);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("mode", replace ? "replace" : "merge");
      const res = await fetch("/api/products/import", { method: "POST", body: form });
      const data = (await res.json()) as {
        products?: StoredProduct[];
        imported?: number;
        mode?: string;
        engine?: string;
        error?: string;
      };
      if (!res.ok || data.error) throw new Error(data.error || `HTTP ${res.status}`);
      setProducts(data.products ?? []);
      setNote(
        `${data.mode === "replace" ? "Replaced" : "Merged"} ${data.imported ?? 0} SKUs · ${data.engine ?? "heuristic"}`
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  function onDrop(e: DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) void importFile(file);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Products</h1>
          <p className="mt-1 text-xs text-muted-foreground">
            Catalog synced from the store feed. Import CSV to merge or replace the demo SKUs (no Shopify).
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            <input
              type="checkbox"
              checked={replace}
              onChange={(e) => setReplace(e.target.checked)}
              className="accent-emerald-500"
            />
            Replace catalog
          </label>
          <button
            type="button"
            disabled={busy}
            onClick={() => fileRef.current?.click()}
            className="rounded-lg border border-primary/30 bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary transition hover:bg-primary/20 disabled:opacity-50"
          >
            {busy ? "Importing…" : "Import CSV"}
          </button>
          <input
            ref={fileRef}
            type="file"
            accept=".csv,text/csv"
            className="sr-only"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void importFile(file);
              e.target.value = "";
            }}
          />
        </div>
      </div>

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        className={cn(
          "rounded-lg border border-dashed px-4 py-3 text-xs text-muted-foreground",
          dragOver ? "border-primary bg-primary/10 text-primary" : "border-border"
        )}
      >
        Drop a catalog CSV (sku, title, category, price_usd, on_hand, reorder_point, supplier, status) to{" "}
        {replace ? "replace" : "merge by SKU"}.
      </div>
      {note ? <p className="text-xs text-primary">{note}</p> : null}
      {error ? <p className="text-xs text-rose-400">{error}</p> : null}

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
                  <td className="px-4 py-3 font-mono text-muted-foreground">{p.salesVelocity}/day</td>
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
