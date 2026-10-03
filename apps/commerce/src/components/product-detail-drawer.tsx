"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { ReorderRequest, StoredOrder, StoredProduct } from "@helix/core";
import { MessageSquare, PackagePlus } from "lucide-react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useDeskMode } from "@/components/desk-mode";
import { ProductHero, StatusPill } from "@/components/inventory-catalog";
import { ApiErrorLine } from "@/components/operator-notice";
import { StockUnits, UnitTiles } from "@/components/stock-bar";
import { orderNumber } from "@/lib/commerce-charts";
import { formatCurrency } from "@/lib/format";
import {
  coverDays,
  estimatedStockoutDate,
  openReorderFor,
  ordersForProduct,
  reorderSuggestion,
  reordersForProduct,
  suggestReorderQuantity,
} from "@/lib/inventory-metrics";
import { cn } from "@/lib/utils";

const REORDER_TONE: Record<ReorderRequest["status"], string> = {
  draft: "border-amber-500/30 bg-amber-500/10 text-amber-400",
  ordered: "border-blue-500/30 bg-blue-500/10 text-blue-400",
  received: "border-emerald-500/30 bg-emerald-500/10 text-emerald-400",
  cancelled: "border-border text-muted-foreground",
};

function shortDate(iso: string | Date): string {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-md border border-border bg-black/[0.02] px-2.5 py-2 dark:bg-white/[0.03]" title={hint}>
      <p className="text-[10px] font-medium tracking-wider text-muted-foreground uppercase">{label}</p>
      <p className="mt-1 font-mono text-sm font-semibold text-foreground tabular-nums">{value}</p>
    </div>
  );
}

/**
 * Right-hand product detail panel. Every figure comes from the stored product, its orders and its
 * reorder requests; anything the store does not record (variants, supplier) is simply not shown.
 */
export function ProductDetailDrawer({
  product,
  onOpenChange,
  orders,
  reorders,
  busy,
  error,
  onCreateDraft,
  onAskAi,
}: {
  product: StoredProduct | null;
  onOpenChange: (open: boolean) => void;
  orders: readonly StoredOrder[];
  reorders: readonly ReorderRequest[];
  busy: boolean;
  error: string | null;
  onCreateDraft: (product: StoredProduct) => Promise<void>;
  onAskAi: (product: StoredProduct) => void;
}) {
  const mode = useDeskMode();
  const [confirming, setConfirming] = useState(false);

  useEffect(() => setConfirming(false), [product?.id]);

  return (
    <Sheet open={product !== null} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="gap-0 overflow-y-auto border-l border-border p-0 data-[side=right]:w-full data-[side=right]:sm:max-w-md">
        {product ? body(product) : null}
      </SheetContent>
    </Sheet>
  );

  function body(p: StoredProduct) {
    const cover = coverDays(p);
    const stockout = estimatedStockoutDate(p);
    const lines = ordersForProduct(orders, p);
    const history = reordersForProduct(reorders, p.id);
    const open = openReorderFor(reorders, p.id);
    const suggested = reorderSuggestion(p) || suggestReorderQuantity(p);
    return (
      <>
        <SheetHeader className="border-b border-border pr-12">
          <div className="flex flex-wrap items-center gap-2">
            <StatusPill product={p} />
            {mode === "demo" ? (
              <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">Demo data</span>
            ) : null}
          </div>
          <SheetTitle className="mt-1.5 text-lg font-semibold">{p.title}</SheetTitle>
          <SheetDescription className="font-mono text-xs">
            {p.sku} · {formatCurrency(p.price)} / unit
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-5 p-4">
          <ProductHero product={p} zoom={false} />

          <section className="space-y-2.5">
            <StockUnits product={p} />
            <UnitTiles product={p} />
          </section>

          <section className="grid grid-cols-2 gap-2">
            <Stat label="Velocity" value={p.salesVelocity > 0 ? `${p.salesVelocity} / day` : "Not selling"} hint="Trailing average units sold per day" />
            <Stat label="Days of cover" value={cover === null ? "—" : `${cover} days`} hint="Units on hand ÷ velocity" />
            <Stat
              label="Est. stock-out"
              value={stockout === null ? "No projection" : p.currentInventory <= 0 ? "Out now" : shortDate(stockout)}
              hint="Estimate: today + days of cover at the trailing velocity"
            />
            <Stat label="Inventory value" value={formatCurrency(Math.max(0, p.currentInventory) * p.price)} hint="Units on hand × unit price" />
          </section>
          {p.reasoning ? (
            <p className="rounded-md border border-border bg-black/[0.02] px-3 py-2 text-xs leading-relaxed text-secondary-foreground dark:bg-white/[0.02]">
              <span className="mr-1 font-mono text-[10px] text-muted-foreground uppercase">{p.engine === "claude" ? "Claude" : "Heuristic"}</span>
              {p.reasoning}
            </p>
          ) : null}

          <section>
            <h3 className="mb-2 text-xs font-semibold text-foreground">Recent orders with this SKU</h3>
            {lines.length === 0 ? (
              <p className="text-xs text-muted-foreground">No orders on the desk contain this SKU.</p>
            ) : (
              <ul className="divide-y divide-border rounded-md border border-border">
                {lines.map((l) => (
                  <li key={l.orderId}>
                    <Link href={`/orders?order=${encodeURIComponent(l.orderId)}`} className="flex items-center justify-between gap-3 px-3 py-2 text-xs transition hover:bg-primary/5">
                      <span className="min-w-0">
                        <span className="font-mono text-foreground">{orderNumber(l.shopifyOrderId)}</span>
                        <span className="ml-2 truncate text-muted-foreground">{l.customerName}</span>
                        <span className="block text-[11px] text-muted-foreground">
                          {shortDate(l.createdAt)} · {l.status}
                        </span>
                      </span>
                      <span className="shrink-0 font-mono font-semibold tabular-nums">×{l.quantity}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section>
            <h3 className="mb-2 text-xs font-semibold text-foreground">Reorder requests</h3>
            {history.length === 0 ? (
              <p className="text-xs text-muted-foreground">No reorder requests for this SKU yet.</p>
            ) : (
              <ul className="space-y-1.5">
                {history.map((r) => (
                  <li key={r.id} className="flex items-center justify-between gap-2 rounded-md border border-border px-3 py-2 text-xs">
                    <span className="text-muted-foreground">{shortDate(r.createdAt)}</span>
                    <span className="font-mono tabular-nums">{r.quantitySuggested} units</span>
                    <span className={cn("rounded border px-1.5 py-0.5 text-[10px] font-medium capitalize", REORDER_TONE[r.status])}>{r.status}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {error ? <ApiErrorLine error={error} className="text-xs" /> : null}

          {confirming && !open ? (
            <div className="space-y-2 rounded-md border border-primary/30 bg-primary/5 p-3 text-xs">
              <p className="text-secondary-foreground">
                Create a draft reorder for <span className="font-mono font-semibold text-foreground">{suggested} units</span>? Nothing is sent to a supplier or written to Shopify.
              </p>
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setConfirming(false)} disabled={busy} className="rounded-md border border-border px-2.5 py-1 font-medium text-secondary-foreground hover:text-foreground disabled:opacity-50">
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void onCreateDraft(p).finally(() => setConfirming(false))}
                  className="rounded-md bg-[#059669] px-2.5 py-1 font-semibold text-white hover:bg-[#059669]/85 disabled:opacity-50"
                >
                  {busy ? "Creating…" : "Create draft"}
                </button>
              </div>
            </div>
          ) : null}

          <div className="flex flex-wrap gap-2 border-t border-border pt-4">
            <button
              type="button"
              disabled={Boolean(open) || busy || confirming}
              onClick={() => setConfirming(true)}
              className={cn(
                "inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition disabled:cursor-not-allowed",
                open ? cn("border", REORDER_TONE[open.status]) : "bg-[#059669] text-white hover:bg-[#059669]/85 disabled:opacity-50"
              )}
            >
              <PackagePlus className="size-3.5" />
              {open ? `Open ${open.status} · ${open.quantitySuggested} u` : "Draft reorder"}
            </button>
            <button
              type="button"
              onClick={() => onAskAi(p)}
              className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs font-medium text-secondary-foreground transition hover:border-primary/30 hover:text-foreground"
            >
              <MessageSquare className="size-3.5" />
              Ask AI about this product
            </button>
          </div>
        </div>
      </>
    );
  }
}
