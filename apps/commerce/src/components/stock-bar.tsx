import type { StoredProduct } from "@helix/core";
import { STOCK_COLOR, daysOfCover, stockStatus } from "@/lib/commerce-charts";
import { HEALTH_COLOR, coverDays, healthTier, shortfallUnits, targetPct, targetStock, RESTOCK_LEAD_DAYS } from "@/lib/inventory-metrics";
import { cn } from "@/lib/utils";

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

type UnitFields = Pick<StoredProduct, "currentInventory" | "reorderPoint" | "salesVelocity" | "price">;

function units(n: number): string {
  return n.toLocaleString("en-US", { maximumFractionDigits: 1 });
}

/**
 * Card-sized stock readout: units on hand against the restock target (2x reorder point or 30 days of
 * sales), the reorder point as a tick, and colour only where the state needs attention.
 */
export function StockUnits({ product }: { product: UnitFields }) {
  const tier = healthTier(product);
  const color = HEALTH_COLOR[tier];
  const target = targetStock(product);
  const pct = targetPct(product);
  const tick = Math.min(100, (product.reorderPoint / target) * 100);
  const depleted = product.currentInventory <= 0;
  const attention = tier === "urgent" || tier === "watch";
  return (
    <div
      role="img"
      aria-label={`${product.currentInventory} units on hand of a ${target}-unit target (${pct}%), reorder point ${product.reorderPoint}`}
      className="space-y-2"
    >
      <div className="flex items-end justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[10px] font-medium tracking-wider text-muted-foreground uppercase">On hand</p>
          <p className="mt-0.5 flex items-baseline gap-1 font-mono tabular-nums">
            <span className="text-xl leading-none font-semibold" style={{ color: attention ? color : undefined }}>
              {units(Math.max(0, product.currentInventory))}
            </span>
            <span className="text-xs text-muted-foreground">/ {units(target)} units</span>
          </p>
        </div>
        <span
          className={cn(
            "shrink-0 rounded-md border px-1.5 py-0.5 font-mono text-[11px] font-medium tabular-nums",
            attention ? "" : "border-border bg-black/[0.03] text-secondary-foreground dark:bg-white/[0.04]"
          )}
          style={attention ? { color, borderColor: `${color}40`, background: `${color}14` } : undefined}
          title="Units on hand as a share of the restock target"
        >
          {depleted ? "Depleted" : `${pct}% of target`}
        </span>
      </div>
      <div className="relative h-1.5 rounded-full bg-black/[0.06] dark:bg-white/[0.07]">
        <div className="h-full rounded-full transition-[width] duration-500" style={{ width: `${Math.min(100, pct)}%`, background: color }} />
        <div
          className="absolute -top-1 -bottom-1 w-px bg-foreground/60"
          style={{ left: `${tick}%` }}
          title={`Reorder point: ${product.reorderPoint} units`}
        />
      </div>
    </div>
  );
}

/** Three readout tiles under the stock bar: reorder point, days of cover and uncovered lead-time demand. */
export function UnitTiles({ product }: { product: UnitFields }) {
  const tier = healthTier(product);
  const color = HEALTH_COLOR[tier];
  const cover = coverDays(product);
  const shortfall = shortfallUnits(product);
  const tiles: { label: string; value: string; unit: string; tone?: string; muted?: boolean; struck?: boolean; title: string }[] = [
    {
      label: "Reorder at",
      value: units(product.reorderPoint),
      unit: "u",
      tone: product.currentInventory <= product.reorderPoint ? color : undefined,
      title: `Reorder point: ${product.reorderPoint} units`,
    },
    {
      label: "Cover",
      value: cover === null ? "—" : units(cover),
      unit: cover === null ? "" : "d",
      tone: tier === "urgent" || tier === "watch" ? color : undefined,
      muted: cover === null,
      struck: cover === 0,
      title: cover === null ? "Not selling: no stockout projection" : `${cover} days of stock at the trailing sales velocity`,
    },
    {
      label: `Short ${RESTOCK_LEAD_DAYS}d`,
      value: shortfall > 0 ? units(shortfall) : "0",
      unit: "u",
      tone: shortfall > 0 ? HEALTH_COLOR.urgent : undefined,
      muted: shortfall === 0,
      title: `Demand over the ${RESTOCK_LEAD_DAYS}-day restock lead time that current stock cannot cover`,
    },
  ];
  return (
    <div className="grid grid-cols-3 gap-1.5">
      {tiles.map((t) => (
        <div
          key={t.label}
          title={t.title}
          className={cn(
            "rounded-md border border-border bg-black/[0.02] px-2 py-1.5 dark:bg-white/[0.03]",
            t.muted && "opacity-55"
          )}
        >
          <p className="truncate text-[10px] leading-none font-medium tracking-wide text-muted-foreground uppercase">{t.label}</p>
          <p className="mt-1 font-mono text-[13px] leading-none font-semibold tabular-nums" style={{ color: t.tone }}>
            <span className={cn(t.struck && "line-through decoration-2")}>{t.value}</span>
            {t.unit ? <span className="ml-0.5 text-[10px] font-normal text-muted-foreground">{t.unit}</span> : null}
          </p>
        </div>
      ))}
    </div>
  );
}
