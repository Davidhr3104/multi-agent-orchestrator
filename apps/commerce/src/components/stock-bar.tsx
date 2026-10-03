import type { StoredProduct } from "@helix/core";
import { STOCK_COLOR, daysOfCover, stockStatus } from "@/lib/commerce-charts";

const STATUS_TEXT = { out: "Out of stock", low: "Below reorder point", ok: "Healthy" } as const;

/**
 * Stock on hand against the reorder point (the tick) with days of cover at the trailing sales
 * velocity. The scale is 2x the reorder point (or the stock, if higher) so the tick is always visible.
 */
export function StockBar({ product, compact = false }: { product: Pick<StoredProduct, "currentInventory" | "reorderPoint" | "salesVelocity">; compact?: boolean }) {
  const status = stockStatus(product);
  const color = STOCK_COLOR[status];
  const scale = Math.max(product.reorderPoint * 2, product.currentInventory, 1);
  const pct = Math.min(100, (product.currentInventory / scale) * 100);
  const tick = Math.min(100, (product.reorderPoint / scale) * 100);
  const cover = daysOfCover(product);
  const coverText = status === "out" ? "0 days" : cover === null ? "not selling" : `${cover} ${cover === 1 ? "day" : "days"}`;
  return (
    <div className={compact ? "w-full" : "w-44 max-w-full"} role="img" aria-label={`${product.currentInventory} in stock, reorder at ${product.reorderPoint}, ${STATUS_TEXT[status]}, ${coverText} of cover`}>
      <div className="relative h-2 rounded-full bg-foreground/10">
        <div className="h-full rounded-full transition-[width] duration-500" style={{ width: `${pct}%`, background: color }} />
        <div className="absolute -top-0.5 -bottom-0.5 w-0.5 bg-foreground/70" style={{ left: `${tick}%` }} title={`Reorder at ${product.reorderPoint}`} />
      </div>
      <p className="mt-1 flex justify-between gap-2 text-[11px] text-muted-foreground">
        <span className="font-mono tabular-nums">
          {product.currentInventory} / {product.reorderPoint}
        </span>
        <span style={{ color: status === "ok" ? undefined : color }} className="font-medium">
          {coverText}
        </span>
      </p>
    </div>
  );
}
