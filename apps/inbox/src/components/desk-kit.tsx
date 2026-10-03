"use client";

import { useEffect, useState, useSyncExternalStore, type ReactNode } from "react";
import { Avatar, CoverArt, DemoChip, EmptyChart } from "@helix/ui";
import { cn } from "@/lib/utils";

export const VIOLET = "#8b5cf6";
export const SOURCE_DESK = "Counted from this desk";

export type DeskMode = "demo" | "live";

/** Demo vs live, from the same endpoint the demo banner uses. null until known (render as live: never claim demo early). */
export function useDeskMode(): DeskMode | null {
  const [mode, setMode] = useState<DeskMode | null>(null);
  useEffect(() => {
    let alive = true;
    const load = () =>
      void fetch("/api/settings/desk")
        .then((r) => r.json())
        .then((d: { mode?: DeskMode }) => alive && setMode(d.mode ?? null))
        .catch(() => alive && setMode(null));
    load();
    window.addEventListener("helix:desk-refresh", load);
    return () => {
      alive = false;
      window.removeEventListener("helix:desk-refresh", load);
    };
  }, []);
  return mode;
}

const noopSubscribe = () => () => {};

/** Minutes east of UTC for the viewer, so day/hour buckets match what the person sees on their clock. 0 on the server. */
export function useTzOffset(): number {
  return useSyncExternalStore(noopSubscribe, () => -new Date().getTimezoneOffset(), () => 0);
}

let nowStamp: number | null = null;
function subscribeNow(onChange: () => void) {
  nowStamp = Date.now();
  onChange();
  return () => {};
}

/** Wall-clock time captured when the component mounts. null on the server and during hydration, so markup never mismatches. */
export function useNow(): number | null {
  return useSyncExternalStore(subscribeNow, () => nowStamp, () => null);
}

export function PageFrame({
  title,
  subtitle,
  actions,
  chips,
  children,
}: {
  title: string;
  subtitle?: ReactNode;
  actions?: ReactNode;
  chips?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="mx-auto w-full max-w-[1400px] min-w-0 space-y-5 p-4 sm:p-6 lg:p-8">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">{title}</h1>
            {chips}
          </div>
          {subtitle ? <p className="mt-1 max-w-3xl text-sm text-muted-foreground">{subtitle}</p> : null}
        </div>
        {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
      </header>
      {children}
    </div>
  );
}

export function GhostButton({ className, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      {...props}
      className={cn("inline-flex min-h-10 items-center rounded-md border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-surface-muted md:min-h-8", className)}
    />
  );
}

export function Grid({ cols = 2, children, className }: { cols?: 1 | 2 | 3 | 4; children: ReactNode; className?: string }) {
  const map = {
    1: "grid-cols-1",
    2: "grid-cols-1 lg:grid-cols-2",
    3: "grid-cols-1 md:grid-cols-2 xl:grid-cols-3",
    4: "grid-cols-1 min-[480px]:grid-cols-2 xl:grid-cols-4",
  } as const;
  return <div className={cn("grid min-w-0 gap-4", map[cols], className)}>{children}</div>;
}

/**
 * Empty state with a picture: a generative cover, a short explanation, and one clearly labelled example so
 * the page shows what it will look like once there is data. The example is never counted as real.
 */
export function IllustratedEmpty({
  title,
  body,
  icon,
  example,
  exampleLabel = "Example",
  colors = ["#2e1065", "#4c1d95"],
}: {
  title: string;
  body: string;
  icon: ReactNode;
  example?: ReactNode;
  exampleLabel?: string;
  colors?: readonly [string, string];
}) {
  return (
    <div className="glass-panel grid min-w-0 gap-5 overflow-hidden rounded-xl p-4 sm:p-5 md:grid-cols-[minmax(0,240px)_1fr]">
      <CoverArt colors={colors} height={150} label={title}>
        <span className="flex size-14 items-center justify-center rounded-2xl border border-white/20 bg-white/10 text-white backdrop-blur">{icon}</span>
      </CoverArt>
      <div className="min-w-0">
        <h2 className="text-base font-semibold text-foreground">{title}</h2>
        <p className="mt-1 max-w-xl text-sm leading-relaxed text-muted-foreground">{body}</p>
        {example ? (
          <div className="mt-4 rounded-lg border border-dashed border-border p-3">
            <div className="mb-2 flex items-center gap-2">
              <DemoChip kind="illustrative" />
              <span className="text-[11px] text-muted-foreground">{exampleLabel}: not a real thread</span>
            </div>
            {example}
          </div>
        ) : (
          <div className="mt-4">
            <EmptyChart label="Nothing to chart yet" height={70} />
          </div>
        )}
      </div>
    </div>
  );
}

export function Stat({ label, value, hint }: { label: string; value: ReactNode; hint?: string }) {
  return (
    <div className="glass-panel min-w-0 rounded-xl p-4">
      <p className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-foreground tabular-nums">{value}</p>
      {hint ? <p className="mt-0.5 truncate text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

export type ColumnPart = { name: string; value: number; color: string };
export type ColumnItem = { label: string; parts: ColumnPart[] };

/** Vertical (stacked) columns. Plain SVG, inherits currentColor for text; every column is described for screen readers. */
export function ColumnChart({ items, ariaLabel, height = 170, showLegend = false }: { items: readonly ColumnItem[]; ariaLabel: string; height?: number; showLegend?: boolean }) {
  const W = 520;
  const padL = 28;
  const padB = 22;
  const padT = 14;
  const totals = items.map((i) => i.parts.reduce((s, p) => s + Math.max(0, p.value), 0));
  const top = Math.max(1, ...totals);
  const max = top <= 4 ? 4 : Math.ceil(top / 2) * 2;
  const innerH = height - padB - padT;
  const slot = (W - padL - 6) / Math.max(1, items.length);
  const bw = Math.min(44, slot * 0.62);
  const muted = "color-mix(in srgb, currentColor 55%, transparent)";
  const legend = [...new Map(items.flatMap((i) => i.parts).map((p) => [p.name, p.color])).entries()];
  const labelEvery = items.length > 10 ? 2 : 1;
  return (
    <div className="min-w-0">
      <svg viewBox={`0 0 ${W} ${height}`} width="100%" role="img" aria-label={ariaLabel} style={{ display: "block" }}>
        {[0, 0.5, 1].map((t) => (
          <g key={t}>
            <line x1={padL} x2={W - 4} y1={padT + innerH - t * innerH} y2={padT + innerH - t * innerH} stroke="color-mix(in srgb, currentColor 12%, transparent)" strokeDasharray="3 4" />
            <text x={padL - 5} y={padT + innerH - t * innerH + 3} textAnchor="end" fontSize="10" fill={muted}>
              {Math.round(max * t)}
            </text>
          </g>
        ))}
        {items.map((item, i) => {
          const x = padL + slot * i + (slot - bw) / 2;
          let y = padT + innerH;
          const total = totals[i];
          return (
            <g key={`${item.label}-${i}`}>
              <title>{`${item.label}: ${total}${item.parts.length > 1 ? ` (${item.parts.filter((p) => p.value > 0).map((p) => `${p.value} ${p.name.toLowerCase()}`).join(", ")})` : ""}`}</title>
              {item.parts.map((p) => {
                const h = (Math.max(0, p.value) / max) * innerH;
                y -= h;
                return h > 0 ? <rect key={p.name} x={x} y={y} width={bw} height={h} rx={h > 4 ? 3 : 1} fill={p.color} /> : null;
              })}
              {total > 0 && items.length <= 8 ? (
                <text x={x + bw / 2} y={y - 4} textAnchor="middle" fontSize="10" fill="currentColor" style={{ fontVariantNumeric: "tabular-nums" }}>
                  {total}
                </text>
              ) : null}
              {i % labelEvery === 0 ? (
                <text x={x + bw / 2} y={height - 6} textAnchor="middle" fontSize="10" fill={muted}>
                  {item.label}
                </text>
              ) : null}
            </g>
          );
        })}
      </svg>
      {showLegend ? (
        <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs">
          {legend.map(([name, color]) => (
            <li key={name} className="flex items-center gap-1.5">
              <span aria-hidden className="size-2 rounded-sm" style={{ background: color }} />
              {name}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

/** Ranked people: avatar, name and address, a count and a proportional bar. */
export function SenderBars({ senders, color = VIOLET }: { senders: readonly { name: string; email: string; count: number }[]; color?: string }) {
  const max = Math.max(1, ...senders.map((s) => s.count));
  return (
    <ul className="grid gap-3">
      {senders.map((s) => (
        <li key={s.email} className="flex min-w-0 items-center gap-3" aria-label={`${s.name}: ${s.count} threads`}>
          <Avatar name={s.name} size={34} />
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline justify-between gap-2 text-xs">
              <span className="truncate font-medium text-foreground">{s.name}</span>
              <span className="flex-none text-muted-foreground tabular-nums">{s.count}</span>
            </div>
            <p className="truncate text-[11px] text-muted-foreground">{s.email}</p>
            <div className="mt-1 h-1.5 rounded-full bg-foreground/10">
              <div className="h-full rounded-full" style={{ width: `${(s.count / max) * 100}%`, background: color }} />
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}

/**
 * Semicircle gauge (lower is better). Local on purpose: @helix/ui's Gauge draws a broken arc once the
 * value passes half of max (its large-arc flag is wrong for a semicircle). Swap back when the kit is fixed.
 */
export function BucketGauge({ value, max, label, caption, size = 132 }: { value: number; max: number; label: string; caption?: string; size?: number }) {
  const ratio = Math.max(0, Math.min(1, max > 0 ? value / max : 0));
  const color = ratio === 0 ? "#34d399" : ratio < 0.5 ? "#fbbf24" : "#f87171";
  const r = size / 2 - 10;
  const cx = size / 2;
  const cy = size / 2 + 6;
  const pt = (a: number) => [cx + r * Math.cos(Math.PI + a * Math.PI), cy + r * Math.sin(Math.PI + a * Math.PI)] as const;
  const arc = (to: number) => {
    const [x0, y0] = pt(0);
    const [x1, y1] = pt(to);
    return `M${x0},${y0} A${r},${r} 0 0 1 ${x1},${y1}`;
  };
  return (
    <figure style={{ margin: 0, textAlign: "center", width: size }}>
      <svg viewBox={`0 0 ${size} ${size / 2 + 22}`} width={size} height={size / 2 + 22} role="img" aria-label={`${label}: ${value} of ${max} past target`}>
        <path d={arc(1)} fill="none" stroke="color-mix(in srgb, currentColor 14%, transparent)" strokeWidth={12} strokeLinecap="round" />
        {ratio > 0 ? <path d={arc(Math.max(0.03, ratio))} fill="none" stroke={color} strokeWidth={12} strokeLinecap="round" /> : null}
        <text x={cx} y={cy - 4} textAnchor="middle" fontSize={size / 6} fontWeight="700" fill="currentColor">
          {value}
        </text>
      </svg>
      <figcaption className="text-xs" style={{ marginTop: -4 }}>
        {label}
        {caption ? <span className="block text-[10px] text-muted-foreground">{caption}</span> : null}
      </figcaption>
    </figure>
  );
}
