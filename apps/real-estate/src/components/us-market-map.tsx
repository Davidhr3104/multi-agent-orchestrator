"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { AreaChart, type AreaPoint } from "@/components/area-chart";
import type { StateMapValue } from "@/components/state-map";
import { monthLabel, type MarketMonth, type StateMarket } from "@/lib/us-market";
import { cn } from "@/lib/utils";

const StateMap = dynamic(() => import("@/components/state-map"), { ssr: false, loading: () => <div className="skeleton h-[40rem] rounded-xl" /> });

const compact = (n: number) => (n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M` : n >= 10_000 ? `${Math.round(n / 1000)}k` : n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(Math.round(n)));
const signedPct = (n: number) => `${n > 0 ? "+" : ""}${(n * 100).toFixed(1)}%`;
const usd = (n: number) => `$${n.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
const thousands = (n: number | null) => (n === null ? null : Math.round(n / 100) / 10);

type MetricKey = "active" | "activeYy" | "newListings" | "price" | "dom" | "pendingRatio";
type Metric = {
  label: string;
  hint: string;
  get: (s: StateMarket) => number | null;
  tile: (n: number) => string;
  full: (n: number) => string;
  /** Which monthly series to chart for this metric, scaled to readable whole numbers. */
  series: { unit: string; get: (m: MarketMonth) => number | null };
};

const METRICS: Record<MetricKey, Metric> = {
  active: {
    label: "Homes for sale",
    hint: "Active listings on Realtor.com at month end",
    get: (s) => s.latest.active,
    tile: compact,
    full: (n) => n.toLocaleString("en-US"),
    series: { unit: "thousand active listings", get: (m) => thousands(m.active) },
  },
  activeYy: {
    label: "Inventory vs last year",
    hint: "Change in active listings against the same month last year",
    get: (s) => s.latest.activeYy,
    tile: (n) => signedPct(n).replace(".0%", "%"),
    full: signedPct,
    series: { unit: "thousand active listings", get: (m) => thousands(m.active) },
  },
  newListings: {
    label: "New listings",
    hint: "Homes that came on the market during the month",
    get: (s) => s.latest.newListings,
    tile: compact,
    full: (n) => n.toLocaleString("en-US"),
    series: { unit: "thousand new listings", get: (m) => thousands(m.newListings) },
  },
  price: {
    label: "Median list price",
    hint: "Asking price, not sale price",
    get: (s) => s.latest.price,
    tile: (n) => `$${Math.round(n / 1000)}k`,
    full: usd,
    series: { unit: "k USD median list price", get: (m) => (m.price === null ? null : Math.round(m.price / 1000)) },
  },
  dom: {
    label: "Days on market",
    hint: "Median days a listing stays active",
    get: (s) => s.latest.dom,
    tile: (n) => `${Math.round(n)}d`,
    full: (n) => `${Math.round(n)} days`,
    series: { unit: "median days on market", get: (m) => m.dom },
  },
  pendingRatio: {
    label: "Buyer demand signal",
    hint: "Pending listings ÷ active listings. Higher means more homes going under contract — a signal, not closed sales",
    get: (s) => s.latest.pendingRatio,
    tile: (n) => `${Math.round(n * 100)}%`,
    full: (n) => `${(n * 100).toFixed(1)}% pending vs active`,
    series: { unit: "% pending ÷ active", get: (m) => (m.pendingRatio === null ? null : Math.round(m.pendingRatio * 100)) },
  },
};

const BUCKETS = [
  "bg-primary/10 text-foreground",
  "bg-primary/30 text-foreground",
  "bg-primary/45 text-foreground",
  "bg-primary/65 text-primary-foreground",
  "bg-primary/85 text-primary-foreground",
];

/** Quintile breaks so the colour shows rank among states; the number is always printed on the tile too. */
function quintiles(values: number[]) {
  const sorted = [...values].sort((a, b) => a - b);
  const q = (p: number) => sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))];
  return [q(0.2), q(0.4), q(0.6), q(0.8)];
}
const bucketOf = (v: number, breaks: number[]) => breaks.filter((b) => v >= b).length;

function Delta({ value, invert = false }: { value: number | null; invert?: boolean }) {
  if (value === null) return <span className="text-muted-foreground">no year-ago figure</span>;
  const up = value > 0;
  const Icon = up ? ArrowUpRight : ArrowDownRight;
  return (
    <span className={cn("inline-flex items-center gap-0.5", value === 0 ? "text-muted-foreground" : up !== invert ? "text-emerald-600 dark:text-emerald-300" : "text-rose-600 dark:text-rose-300")}>
      <Icon className="size-3" aria-hidden />
      {signedPct(value)} vs last year
    </span>
  );
}

export function UsMarketMap({ states }: { states: StateMarket[] }) {
  const [metricKey, setMetricKey] = useState<MetricKey>("active");
  const byId = new Map(states.map((s) => [s.id, s]));
  const [selectedId, setSelectedId] = useState(() => [...states].sort((a, b) => (b.latest.active ?? 0) - (a.latest.active ?? 0))[0]?.id ?? "");
  const metric = METRICS[metricKey];
  const values = states.map(metric.get).filter((v): v is number => v !== null);
  const breaks = quintiles(values);
  const ranked = states
    .map((s) => ({ s, v: metric.get(s) }))
    .filter((r): r is { s: StateMarket; v: number } => r.v !== null)
    .sort((a, b) => b.v - a.v);
  const top = ranked.slice(0, 10);
  const maxTop = Math.max(...top.map((r) => Math.abs(r.v)), 0) || 1;
  const sel = byId.get(selectedId);
  const mapValues: Record<string, StateMapValue> = Object.fromEntries(
    states.map((s) => {
      const v = metric.get(s);
      return [s.name, v === null ? { bucket: null, label: "No figure this month" } : { bucket: bucketOf(v, breaks), label: `${metric.label}: ${metric.full(v)}` }];
    })
  );
  const chart: AreaPoint[] = sel
    ? sel.history
        .map((m) => ({ m, v: metric.series.get(m) }))
        .filter((r): r is { m: MarketMonth; v: number } => r.v !== null)
        .map(({ m, v }) => ({ label: monthLabel(m.month), value: v }))
    : [];

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
      <section className="rounded-xl border border-border bg-card/80 p-5" aria-label="Map of US states">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-foreground">{metric.label} by state</h2>
            <p className="text-xs text-muted-foreground">{metric.hint}.</p>
          </div>
          <div role="radiogroup" aria-label="Map metric" className="flex flex-wrap gap-1.5">
            {(Object.keys(METRICS) as MetricKey[]).map((k) => (
              <button
                key={k}
                type="button"
                role="radio"
                aria-checked={k === metricKey}
                onClick={() => setMetricKey(k)}
                className={cn(
                  "cursor-pointer rounded-full border px-3 py-1 text-xs font-medium transition",
                  k === metricKey ? "border-primary/60 bg-primary/15 text-primary" : "border-border text-muted-foreground hover:border-primary/40 hover:text-foreground"
                )}
              >
                {METRICS[k].label}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-5">
          <StateMap values={mapValues} selected={sel?.name ?? ""} onSelect={(name) => setSelectedId(states.find((s) => s.name === name)?.id ?? selectedId)} />
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
          <span>Fewer</span>
          {BUCKETS.map((b, i) => (
            <span key={b} className={cn("inline-flex h-5 min-w-12 items-center justify-center rounded px-1.5 font-mono", b)}>
              {i === 0 ? `<${metric.tile(breaks[0])}` : i === 4 ? `≥${metric.tile(breaks[3])}` : `${metric.tile(breaks[i - 1])}+`}
            </span>
          ))}
          <span>More</span>
          <span className="ml-auto">Colour = rank among states (fifths). Scroll to zoom, drag to move, click a state for its trend.</span>
        </div>
      </section>

      <div className="flex flex-col gap-6">
        {sel ? (
          <section className="rounded-xl border border-border bg-card/80 p-5" aria-live="polite">
            <p className="text-[11px] font-semibold tracking-[0.14em] text-muted-foreground uppercase">{monthLabel(sel.latest.month)}</p>
            <h2 className="text-xl font-semibold text-foreground">{sel.name}</h2>
            <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
              {[
                { k: "For sale", v: sel.latest.active === null ? "—" : sel.latest.active.toLocaleString("en-US"), d: <Delta value={sel.latest.activeYy} /> },
                { k: "New listings", v: sel.latest.newListings === null ? "—" : sel.latest.newListings.toLocaleString("en-US"), d: <Delta value={sel.latest.newYy} /> },
                { k: "Median list price", v: sel.latest.price === null ? "—" : usd(sel.latest.price), d: <Delta value={sel.latest.priceYy} /> },
                { k: "Days on market", v: sel.latest.dom === null ? "—" : `${sel.latest.dom}`, d: <Delta value={sel.latest.domYy} invert /> },
                { k: "Pending", v: sel.latest.pending === null ? "—" : sel.latest.pending.toLocaleString("en-US"), d: <span className="text-muted-foreground">{sel.latest.pendingRatio === null ? "" : `${Math.round(sel.latest.pendingRatio * 100)}% of active`}</span> },
                { k: "Price cuts", v: sel.latest.reducedShare === null ? "—" : `${Math.round(sel.latest.reducedShare * 100)}%`, d: <span className="text-muted-foreground">of listings reduced</span> },
              ].map((r) => (
                <div key={r.k} className="rounded-lg bg-muted/40 px-3 py-2">
                  <dt className="text-[11px] text-muted-foreground">{r.k}</dt>
                  <dd className="tabular font-mono text-base font-semibold text-foreground">{r.v}</dd>
                  <dd className="text-[11px]">{r.d}</dd>
                </div>
              ))}
            </dl>
            <h3 className="mt-4 text-xs font-semibold text-muted-foreground">Last {chart.length} months · {metric.series.unit}</h3>
            <AreaChart points={chart} unit={metric.series.unit} className="mt-2" />
          </section>
        ) : null}

        <section className="rounded-xl border border-border bg-card/80 p-5">
          <h2 className="text-lg font-semibold text-foreground">Top 10 · {metric.label}</h2>
          <ol className="mt-3 space-y-1.5">
            {top.map(({ s, v }, i) => (
              <li key={s.id}>
                <button
                  type="button"
                  onClick={() => setSelectedId(s.id)}
                  className={cn("grid w-full cursor-pointer grid-cols-[1.25rem_6.5rem_1fr_auto] items-center gap-2 rounded-md px-1.5 py-1 text-left text-sm transition hover:bg-accent/50", s.id === selectedId && "bg-accent/60")}
                >
                  <span className="tabular font-mono text-[11px] text-muted-foreground">{i + 1}</span>
                  <span className="truncate text-foreground">{s.name}</span>
                  <span className="h-2 overflow-hidden rounded-full bg-muted" aria-hidden>
                    <span className="block h-full rounded-full bg-primary" style={{ width: `${Math.max(3, (Math.abs(v) / maxTop) * 100)}%` }} />
                  </span>
                  <span className="tabular font-mono text-xs text-foreground">{metric.tile(v)}</span>
                </button>
              </li>
            ))}
          </ol>
        </section>
      </div>
    </div>
  );
}
