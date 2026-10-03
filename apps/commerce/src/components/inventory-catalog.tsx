"use client";

import type { ReactNode } from "react";
import type { ReorderRequest, StoredProduct } from "@helix/core";
import { CoverArt } from "@helix/ui";
import { StockUnits, UnitTiles } from "@/components/stock-bar";
import { formatCurrency } from "@/lib/format";
import {
  HEALTH_COLOR,
  RESTOCK_LEAD_DAYS,
  coverDays,
  healthTier,
  openReorderFor,
  reorderSuggestion,
  revenueAtRisk,
  targetPct,
  targetStock,
  type HealthTier,
} from "@/lib/inventory-metrics";
import { cn } from "@/lib/utils";

const PALETTE: [string, string][] = [["#065f46", "#0f766e"], ["#14532d", "#047857"], ["#134e4a", "#1e3a8a"], ["#064e3b", "#4d7c0f"]];

function palette(title: string): [string, string] {
  return PALETTE[[...title].reduce((n, c) => n + c.charCodeAt(0), 0) % PALETTE.length];
}

function initials(title: string): string {
  return title
    .split(/\s+/)
    .filter((w) => /^[a-z0-9]/i.test(w))
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join("");
}

export function statusBadge(p: StoredProduct): { text: string; tier: HealthTier } {
  const tier = healthTier(p);
  const cover = coverDays(p);
  if (p.currentInventory <= 0) return { tier, text: "Out of stock" };
  const days = cover === null ? null : `${cover}d`;
  switch (tier) {
    case "urgent":
      return { tier, text: `Critical · ${days} left` };
    case "watch":
      return { tier, text: days ? `Low stock · ${days} left` : "Below reorder point" };
    case "overstock":
      return { tier, text: days ? `Overstock · ${days} cover` : "Overstock · not selling" };
    default:
      return { tier, text: days ? `Healthy · ${days} cover` : "Healthy · not selling" };
  }
}

export function StatusPill({ product, className }: { product: StoredProduct; className?: string }) {
  const { text, tier } = statusBadge(product);
  const color = HEALTH_COLOR[tier];
  return (
    <span
      className={cn("inline-flex items-center gap-1.5 rounded-md border px-1.5 py-0.5 font-mono text-[10px] font-semibold tracking-wide whitespace-nowrap uppercase", className)}
      style={{ color, borderColor: `${color}55`, background: `color-mix(in srgb, ${color} 14%, rgb(10 16 14 / 0.88))` }}
    >
      <span className="size-1.5 rounded-full" style={{ background: color }} />
      {text}
    </span>
  );
}

/**
 * Small rounded product thumbnail for tables: the photo when there is one, else a generated monogram
 * tile. With `onOpen` it is a button that opens the product detail panel.
 */
export function ProductThumbnail({
  product,
  size = 36,
  className,
  onOpen,
}: {
  product: Pick<StoredProduct, "title" | "imageUrl" | "currentInventory">;
  size?: number;
  className?: string;
  onOpen?: () => void;
}) {
  const out = product.currentInventory <= 0;
  const Tag = onOpen ? "button" : "div";
  return (
    <Tag
      {...(onOpen ? { type: "button" as const, onClick: onOpen, "aria-label": `View details for ${product.title}` } : {})}
      className={cn(
        "relative block shrink-0 overflow-hidden rounded-md border border-border bg-black/20",
        onOpen && "cursor-zoom-in transition hover:border-primary/50 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary",
        className
      )}
      style={{ width: Math.round(size * (4 / 3)), height: size }}
      title={product.imageUrl ? undefined : "Generated cover, no product photo"}
    >
      {product.imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={product.imageUrl} alt="" loading="lazy" className={cn("size-full object-cover", out && "opacity-60 grayscale")} />
      ) : (
        <div className="flex size-full items-center justify-center" style={{ background: `linear-gradient(135deg, ${palette(product.title)[0]}, ${palette(product.title)[1]})` }}>
          <span className="font-mono text-[10px] font-semibold tracking-wider text-white/75">{initials(product.title)}</span>
        </div>
      )}
    </Tag>
  );
}

/**
 * Card hero: 4:3 framed photo with a slight hover zoom; out-of-stock photos are desaturated and dimmed.
 * With `onOpen` the image is a real button; overlays passed as children sit beside it, not inside it.
 */
export function ProductHero({ product, children, onOpen, zoom = true }: { product: StoredProduct; children?: ReactNode; onOpen?: () => void; zoom?: boolean }) {
  const out = product.currentInventory <= 0;
  const media = product.imageUrl ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={product.imageUrl}
      alt={onOpen ? "" : product.title}
      loading="lazy"
      className={cn(
        "size-full object-cover transition duration-500 ease-out",
        zoom && "group-hover/hero:scale-[1.04]",
        out && "opacity-55 grayscale-[0.85]"
      )}
    />
  ) : (
    <div className="absolute inset-0 [&>div]:h-full! [&>div]:rounded-none!">
      <CoverArt colors={palette(product.title)} label={onOpen ? undefined : "Generated cover, no product photo"}>
        <span className="font-mono text-3xl font-semibold tracking-widest text-white/70">{initials(product.title)}</span>
      </CoverArt>
    </div>
  );
  return (
    <div className="group/hero relative aspect-[4/3] overflow-hidden rounded-lg border border-border bg-[#0b1512]">
      {onOpen ? (
        <button
          type="button"
          onClick={onOpen}
          aria-label={`View details for ${product.title}`}
          className="absolute inset-0 size-full cursor-zoom-in focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary"
        >
          {media}
        </button>
      ) : (
        media
      )}
      <div aria-hidden className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/55 via-transparent via-35% to-black/30" />
      {out ? (
        <span className="pointer-events-none absolute inset-x-0 bottom-2 text-center font-mono text-[10px] font-semibold tracking-[0.2em] text-white/70 uppercase">
          No units on hand
        </span>
      ) : null}
      {children}
    </div>
  );
}

type ActionProps = {
  reorders: readonly ReorderRequest[];
  busy: boolean;
  onDraft: (product: StoredProduct) => void;
};

function ReorderAction({ product, reorders, busy, onDraft, compact = false }: ActionProps & { product: StoredProduct; compact?: boolean }) {
  const open = openReorderFor(reorders, product.id);
  const qty = reorderSuggestion(product);
  const base = compact ? "rounded-md px-2.5 py-1 text-[11px]" : "w-full rounded-lg py-1.5 text-xs";
  if (open) {
    return (
      <span
        className={cn(base, "inline-flex items-center justify-center border font-medium", open.status === "ordered" ? "border-blue-500/30 bg-blue-500/10 text-blue-400" : "border-amber-500/30 bg-amber-500/10 text-amber-400")}
        title="An open reorder request already exists for this SKU"
      >
        {open.status === "ordered" ? "Ordered" : "Draft PO"} · {open.quantitySuggested} u
      </span>
    );
  }
  if (qty === 0) {
    return (
      <span className={cn(base, "inline-flex items-center justify-center border border-border bg-black/[0.02] font-medium text-muted-foreground dark:bg-white/[0.02]")}>
        Stock balanced
      </span>
    );
  }
  return (
    <button
      type="button"
      disabled={busy}
      onClick={() => onDraft(product)}
      className={cn(base, "border border-primary/40 bg-primary/10 font-medium text-primary transition hover:bg-primary/20 disabled:cursor-not-allowed disabled:opacity-50 dark:text-emerald-300")}
    >
      {busy ? "…" : `Draft PO (+${qty})`}
    </button>
  );
}

export function ProductCard({
  product,
  selected,
  onToggle,
  onOpen,
  ...action
}: ActionProps & { product: StoredProduct; selected: boolean; onToggle: () => void; onOpen: () => void }) {
  const tier = healthTier(product);
  const color = HEALTH_COLOR[tier];
  const risk = revenueAtRisk(product);
  const qty = reorderSuggestion(product);
  const selling = product.salesVelocity > 0;
  return (
    <article
      data-ai-id={product.id}
      onClick={(e) => {
        // The card body toggles selection; its own controls (image, title, checkbox, PO button) keep their meaning.
        if ((e.target as HTMLElement).closest("button, a, input, label, select")) return;
        onToggle();
      }}
      className={cn(
        "group glass-panel flex cursor-pointer flex-col rounded-xl p-3 transition hover:border-primary/30",
        selected && "border-primary/50 ring-1 ring-primary/30"
      )}
    >
      <ProductHero product={product} onOpen={onOpen}>
        <StatusPill product={product} className="pointer-events-none absolute top-2 left-2 shadow-sm" />
        <label className="absolute top-2 right-2 flex size-6 cursor-pointer items-center justify-center rounded-md border border-white/15 bg-black/55 backdrop-blur">
          <input
            type="checkbox"
            checked={selected}
            onChange={onToggle}
            aria-label={`Select ${product.title} for a batch purchase order`}
            className="size-3.5 cursor-pointer accent-emerald-500"
          />
        </label>
      </ProductHero>

      <div className="mt-3 flex items-center justify-between gap-2">
        <span className="truncate font-mono text-[11px] text-muted-foreground">{product.sku}</span>
        <span
          className="shrink-0 rounded border border-border bg-black/[0.03] px-1.5 py-0.5 font-mono text-[10px] text-secondary-foreground tabular-nums dark:bg-white/[0.04]"
          title="Unit price"
        >
          {formatCurrency(product.price)} / unit
        </span>
      </div>
      <h3 className="mt-1 text-sm font-semibold text-foreground">
        <button type="button" onClick={onOpen} title={product.title} className="line-clamp-1 text-left hover:text-primary hover:underline hover:underline-offset-2 dark:hover:text-emerald-300">
          {product.title}
        </button>
      </h3>
      <div className="mt-0.5 flex items-center justify-between gap-2 text-[11px]">
        <span className="text-muted-foreground">
          Value <span className="font-mono text-secondary-foreground tabular-nums">{formatCurrency(Math.max(0, product.currentInventory) * product.price)}</span>
        </span>
        <span className="font-mono font-medium tabular-nums" style={{ color: selling ? color : undefined }}>
          {selling ? `${product.salesVelocity}/day` : "not selling"}
        </span>
      </div>

      <div className="mt-3 space-y-2.5">
        <StockUnits product={product} />
        <UnitTiles product={product} />
      </div>

      <div
        className="mt-2.5 flex items-center justify-between rounded-md border border-border bg-black/[0.02] px-2 py-1.5 text-[11px] dark:bg-white/[0.02]"
        title={`Unfilled demand over the ${RESTOCK_LEAD_DAYS}-day restock lead time × unit price`}
      >
        <span className="text-muted-foreground">Revenue at risk · {RESTOCK_LEAD_DAYS}d</span>
        <span className={cn("font-mono font-semibold tabular-nums", risk > 0 ? "text-rose-400" : "text-muted-foreground")}>
          {risk > 0 ? `−${formatCurrency(risk)}` : "None"}
        </span>
      </div>

      <div className="mt-auto pt-3">
        <div className="mb-1.5 flex items-center justify-between border-t border-border pt-2.5 text-[11px]">
          <span className="text-muted-foreground">Reorder rec.</span>
          <span className={cn("font-mono tabular-nums", qty > 0 ? "font-semibold text-primary dark:text-emerald-300" : "text-muted-foreground")}>
            {qty > 0 ? `+${qty} units` : "0 units · safe"}
          </span>
        </div>
        <ReorderAction product={product} {...action} />
      </div>
    </article>
  );
}

export function DenseTable({
  products,
  selected,
  onToggle,
  onToggleAll,
  onOpen,
  ...action
}: ActionProps & {
  products: readonly StoredProduct[];
  selected: ReadonlySet<string>;
  onToggle: (id: string) => void;
  onToggleAll: (checked: boolean) => void;
  onOpen: (product: StoredProduct) => void;
}) {
  const allChecked = products.length > 0 && products.every((p) => selected.has(p.id));
  return (
    <div className="glass-panel glass-panel-glow overflow-hidden rounded-xl">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[920px] text-left text-xs text-secondary-foreground">
          <thead className="border-b border-primary/20 bg-black/[0.02] font-mono text-[11px] tracking-wider text-primary/80 uppercase dark:bg-[#051913]/90">
            <tr>
              <th className="w-10 px-4 py-3">
                <input
                  type="checkbox"
                  checked={allChecked}
                  onChange={(e) => onToggleAll(e.target.checked)}
                  aria-label="Select all shown SKUs"
                  className="size-3.5 cursor-pointer accent-emerald-500"
                />
              </th>
              <th className="px-3 py-3">Product / SKU</th>
              <th className="px-3 py-3 text-right">Units on hand</th>
              <th className="px-3 py-3 text-right">Cover</th>
              <th className="px-3 py-3 text-center">Status</th>
              <th className="px-3 py-3 text-right">Velocity</th>
              <th className="px-3 py-3 text-right">Rev. at risk</th>
              <th className="px-3 py-3 text-right">Rec. reorder</th>
              <th className="px-4 py-3 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-primary/10">
            {products.map((p) => {
              const tier = healthTier(p);
              const color = HEALTH_COLOR[tier];
              const attention = tier === "urgent" || tier === "watch";
              const cover = coverDays(p);
              const risk = revenueAtRisk(p);
              const qty = reorderSuggestion(p);
              return (
                <tr key={p.id} data-ai-id={p.id} className={cn("transition hover:bg-primary/5", selected.has(p.id) && "bg-primary/[0.06]")}>
                  <td className="px-4 py-2.5">
                    <input
                      type="checkbox"
                      checked={selected.has(p.id)}
                      onChange={() => onToggle(p.id)}
                      aria-label={`Select ${p.title}`}
                      className="size-3.5 cursor-pointer accent-emerald-500"
                    />
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-2.5">
                      <ProductThumbnail product={p} size={32} onOpen={() => onOpen(p)} />
                      <div className="min-w-0">
                        <button type="button" onClick={() => onOpen(p)} className="block max-w-full truncate text-left font-medium text-foreground hover:text-primary dark:hover:text-emerald-300">
                          {p.title}
                        </button>
                        <p className="font-mono text-[11px] text-muted-foreground">{p.sku}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono tabular-nums">
                    <span className="font-semibold" style={{ color: attention ? color : undefined }}>
                      {Math.max(0, p.currentInventory)}
                    </span>
                    <span className="text-muted-foreground"> / {targetStock(p)}</span>
                    <span className="ml-1.5 text-[10px] text-muted-foreground">{targetPct(p)}%</span>
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono tabular-nums" style={{ color: attention ? color : undefined }}>
                    {cover === null ? <span className="text-muted-foreground">—</span> : `${cover}d`}
                  </td>
                  <td className="px-3 py-2.5 text-center">
                    <StatusPill product={p} />
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono text-muted-foreground tabular-nums">{p.salesVelocity}/day</td>
                  <td className={cn("px-3 py-2.5 text-right font-mono tabular-nums", risk > 0 ? "font-semibold text-rose-400" : "text-muted-foreground")}>
                    {risk > 0 ? formatCurrency(risk) : "—"}
                  </td>
                  <td className={cn("px-3 py-2.5 text-right font-mono tabular-nums", qty > 0 ? "font-semibold text-primary dark:text-emerald-300" : "text-muted-foreground")}>
                    {qty > 0 ? `+${qty}` : "0"}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <ReorderAction product={p} {...action} compact />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
