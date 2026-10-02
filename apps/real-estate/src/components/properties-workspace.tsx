"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Bath, BedDouble, LayoutGrid, Map as MapIcon, MapPin, Maximize2, Rows3, X } from "lucide-react";
import { KIND_LABEL, PropertyCard, StatusBadge, money } from "@/components/bits";
import { cn } from "@/lib/utils";
import type { Property, PropertyKind, PropertyStatus } from "@/lib/types";

const STATUSES: PropertyStatus[] = ["active", "reserved", "draft", "sold"];
const SORTS = { price_desc: "Price: high to low", price_asc: "Price: low to high", dom_desc: "Longest on market", sqm_desc: "Largest first" } as const;
type Sort = keyof typeof SORTS;

const VIEWS = [
  { value: "grid", label: "Grid", icon: LayoutGrid },
  { value: "table", label: "Table", icon: Rows3 },
  { value: "zones", label: "Zones", icon: MapIcon },
] as const;
type View = (typeof VIEWS)[number]["value"];

type Filters = { zone: string; kind: PropertyKind | ""; status: PropertyStatus | ""; min: string; max: string; beds: string; sort: Sort; view: View };
const DEFAULTS: Filters = { zone: "", kind: "", status: "", min: "", max: "", beds: "", sort: "price_desc", view: "grid" };

function fromParams(sp: Record<string, string | undefined>): Filters {
  return {
    view: VIEWS.some((v) => v.value === sp.view) ? (sp.view as View) : "grid",
    zone: sp.zone ?? "",
    kind: (sp.kind && sp.kind in KIND_LABEL ? sp.kind : "") as Filters["kind"],
    status: (STATUSES.includes(sp.status as PropertyStatus) ? sp.status : "") as Filters["status"],
    min: sp.min ?? "",
    max: sp.max ?? "",
    beds: sp.beds ?? "",
    sort: (sp.sort && sp.sort in SORTS ? sp.sort : "price_desc") as Sort,
  };
}

const field = "h-10 rounded-lg border border-input bg-background/60 px-3 text-sm text-foreground focus:border-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-ring";

export function PropertiesWorkspace({ props, initial }: { props: Property[]; initial: Record<string, string | undefined> }) {
  const [f, setF] = useState<Filters>(() => fromParams(initial));
  const zones = useMemo(() => [...new Set(props.map((p) => p.zone))].sort(), [props]);
  const set = <K extends keyof Filters>(k: K, v: Filters[K]) => setF((prev) => ({ ...prev, [k]: v }));

  useEffect(() => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries(f)) if (v && v !== DEFAULTS[k as keyof Filters]) p.set(k, v);
    const s = p.toString();
    window.history.replaceState(null, "", `${window.location.pathname}${s ? `?${s}` : ""}`);
  }, [f]);

  const shown = useMemo(() => {
    const min = Number(f.min) || 0;
    const max = Number(f.max) || Infinity;
    const beds = Number(f.beds) || 0;
    const list = props.filter(
      (p) => (!f.zone || p.zone === f.zone) && (!f.kind || p.kind === f.kind) && (!f.status || p.status === f.status) && p.price >= min && p.price <= max && p.beds >= beds
    );
    const by: Record<Sort, (a: Property, b: Property) => number> = {
      price_desc: (a, b) => b.price - a.price,
      price_asc: (a, b) => a.price - b.price,
      dom_desc: (a, b) => b.daysOnMarket - a.daysOnMarket,
      sqm_desc: (a, b) => b.sqm - a.sqm,
    };
    return list.sort(by[f.sort]);
  }, [props, f]);

  const active = (Object.keys(DEFAULTS) as (keyof Filters)[]).filter((k) => k !== "sort" && k !== "view" && f[k] !== DEFAULTS[k]).length;

  return (
    <div className="space-y-4">
      <div className="space-y-3 rounded-xl border border-border bg-card/80 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <select aria-label="Zone" value={f.zone} onChange={(e) => set("zone", e.target.value)} className={field}>
            <option value="">Any zone</option>
            {zones.map((z) => (
              <option key={z} value={z}>
                {z}
              </option>
            ))}
          </select>
          <select aria-label="Type" value={f.kind} onChange={(e) => set("kind", e.target.value as Filters["kind"])} className={field}>
            <option value="">Any type</option>
            {(Object.keys(KIND_LABEL) as PropertyKind[]).map((k) => (
              <option key={k} value={k}>
                {KIND_LABEL[k]}
              </option>
            ))}
          </select>
          <select aria-label="Status" value={f.status} onChange={(e) => set("status", e.target.value as Filters["status"])} className={field}>
            <option value="">Any status</option>
            {STATUSES.map((s) => (
              <option key={s} value={s} className="capitalize">
                {s[0].toUpperCase() + s.slice(1)}
              </option>
            ))}
          </select>
          <input aria-label="Minimum price" inputMode="numeric" value={f.min} onChange={(e) => set("min", e.target.value.replace(/\D/g, ""))} placeholder="Min price" className={cn(field, "w-32")} />
          <input aria-label="Maximum price" inputMode="numeric" value={f.max} onChange={(e) => set("max", e.target.value.replace(/\D/g, ""))} placeholder="Max price" className={cn(field, "w-32")} />
          <select aria-label="Bedrooms" value={f.beds} onChange={(e) => set("beds", e.target.value)} className={field}>
            <option value="">Any beds</option>
            {[1, 2, 3, 4, 5].map((n) => (
              <option key={n} value={String(n)}>
                {n}+ beds
              </option>
            ))}
          </select>
          <select aria-label="Sort" value={f.sort} onChange={(e) => set("sort", e.target.value as Sort)} className={cn(field, "ml-auto")}>
            {(Object.keys(SORTS) as Sort[]).map((s) => (
              <option key={s} value={s}>
                {SORTS[s]}
              </option>
            ))}
          </select>
          {active ? (
            <button type="button" onClick={() => setF({ ...DEFAULTS, sort: f.sort, view: f.view })} className="inline-flex h-10 cursor-pointer items-center gap-1 px-2 text-xs text-muted-foreground hover:text-foreground">
              <X className="size-3.5" aria-hidden /> Clear {active} filter{active === 1 ? "" : "s"}
            </button>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-muted-foreground" aria-live="polite">
            Showing {shown.length} of {props.length} properties
          </p>
          <div role="radiogroup" aria-label="View" className="inline-flex rounded-lg border border-border bg-background/60 p-0.5">
            {VIEWS.map(({ value, label, icon: Icon }) => {
              const on = f.view === value;
              return (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => set("view", value)}
                  className={cn(
                    "inline-flex min-h-8 items-center gap-1.5 rounded-md px-3 text-xs font-semibold transition focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                    on ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <Icon size={14} aria-hidden /> {label}
                </button>
              );
            })}
          </div>
        </div>
      </div>
      {shown.length === 0 ? (
        <p className="rounded-xl border border-border bg-card/80 px-5 py-10 text-center text-sm text-muted-foreground">No properties match these filters.</p>
      ) : f.view === "table" ? (
        <PropertyTable rows={shown} />
      ) : f.view === "zones" ? (
        <ZoneBoard rows={shown} />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {shown.map((p) => (
              <PropertyCard key={p.id} p={p} />
            ))}
          </div>
          <p className="text-center text-[11px] text-muted-foreground">Photos are samples for the demo desk, not the real listings. Listings without one show a drawing by property type.</p>
        </>
      )}
    </div>
  );
}

function PropertyTable({ rows }: { rows: Property[] }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-border bg-card/80">
      <table className="w-full min-w-[720px] text-sm">
        <thead>
          <tr className="border-b border-border text-left text-[11px] tracking-wider text-muted-foreground uppercase">
            <th className="px-4 py-3 font-semibold">Property</th>
            <th className="px-4 py-3 font-semibold">Status</th>
            <th className="px-4 py-3 text-right font-semibold">Price</th>
            <th className="px-4 py-3 text-right font-semibold">Per m²</th>
            <th className="px-4 py-3 font-semibold">Beds · baths · m²</th>
            <th className="px-4 py-3 text-right font-semibold">Days listed</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {rows.map((p) => (
            <tr key={p.id} data-ai-id={p.id} className="transition hover:bg-accent/40">
              <td className="px-4 py-3">
                <Link href={`/properties/${p.id}`} className="font-semibold text-foreground hover:text-primary focus-visible:underline focus-visible:outline-none">
                  {p.title}
                </Link>
                <p className="text-xs text-muted-foreground">
                  {KIND_LABEL[p.kind]} · {p.zone}
                </p>
              </td>
              <td className="px-4 py-3">
                <StatusBadge status={p.status} />
              </td>
              <td className="tabular px-4 py-3 text-right font-mono font-semibold text-foreground">{money(p.price)}</td>
              <td className="tabular px-4 py-3 text-right font-mono text-muted-foreground">{money(Math.round(p.price / p.sqm))}</td>
              <td className="px-4 py-3">
                <span className="inline-flex items-center gap-3 text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-1">
                    <BedDouble size={14} className="text-primary/80" aria-hidden /> <span className="tabular font-mono text-foreground">{p.beds}</span>
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <Bath size={14} className="text-primary/80" aria-hidden /> <span className="tabular font-mono text-foreground">{p.baths}</span>
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <Maximize2 size={14} className="text-primary/80" aria-hidden /> <span className="tabular font-mono text-foreground">{p.sqm}</span> m²
                  </span>
                </span>
              </td>
              <td className="tabular px-4 py-3 text-right font-mono text-muted-foreground">{p.status === "active" ? p.daysOnMarket : "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const DOT: Record<PropertyStatus, string> = { active: "bg-emerald-400", reserved: "bg-amber-400", draft: "bg-slate-400", sold: "bg-rose-400" };

/** Listings grouped by zone. There are no coordinates on the desk, so this is a schematic, not a map. */
function ZoneBoard({ rows }: { rows: Property[] }) {
  const groups = new Map<string, Property[]>();
  for (const p of rows) groups.set(p.zone, [...(groups.get(p.zone) ?? []), p]);
  const byZone = [...groups].sort((a, b) => b[1].length - a[1].length);
  return (
    <div className="space-y-2">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {byZone.map(([zone, list]) => {
          const prices = list.map((p) => p.price);
          return (
            <section key={zone} aria-label={zone} className="relative overflow-hidden rounded-xl border border-border bg-card/80 p-4">
              <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,rgba(148,163,184,0.06)_1px,transparent_1px),linear-gradient(to_bottom,rgba(148,163,184,0.06)_1px,transparent_1px)] bg-[size:22px_22px]" aria-hidden />
              <div className="relative flex items-start justify-between gap-2">
                <div>
                  <h3 className="inline-flex items-center gap-1.5 text-base font-semibold text-foreground">
                    <MapPin size={14} className="text-primary" aria-hidden /> {zone}
                  </h3>
                  <p className="tabular font-mono text-xs text-muted-foreground">
                    {money(Math.min(...prices))} – {money(Math.max(...prices))}
                  </p>
                </div>
                <span className="tabular rounded-full bg-primary/10 px-2.5 py-0.5 font-mono text-xs font-semibold text-primary ring-1 ring-primary/25">{list.length}</span>
              </div>
              <ul className="relative mt-3 space-y-1.5">
                {list.map((p) => (
                  <li key={p.id}>
                    <Link
                      href={`/properties/${p.id}`}
                      className="flex items-center gap-2 rounded-lg bg-background/60 px-2.5 py-2 text-xs ring-1 ring-border transition hover:ring-primary/40 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                    >
                      <span className={cn("size-2 shrink-0 rounded-full", DOT[p.status])} aria-hidden />
                      <span className="min-w-0 flex-1 truncate font-medium text-foreground">{p.title}</span>
                      <span className="sr-only">{p.status}</span>
                      <span className="tabular shrink-0 font-mono text-muted-foreground">{money(p.price)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>
      <p className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
        <span>Schematic by zone — listings have no map coordinates yet, so this isn&apos;t a real map.</span>
        {(Object.keys(DOT) as PropertyStatus[]).map((s) => (
          <span key={s} className="inline-flex items-center gap-1 capitalize">
            <span className={cn("size-2 rounded-full", DOT[s])} aria-hidden /> {s}
          </span>
        ))}
      </p>
    </div>
  );
}
