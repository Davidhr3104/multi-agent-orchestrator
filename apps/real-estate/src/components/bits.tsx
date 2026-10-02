import Link from "next/link";
import { Bath, BedDouble, Maximize2, type LucideIcon } from "lucide-react";
import { PropertyCardActions } from "@/components/property-card-actions";
import { PropertyCover } from "@/components/property-cover";
import { DEMO_PHOTOS } from "@/lib/demo-photos";
import { cn } from "@/lib/utils";
import type { ContactRecency } from "@/lib/status";
import type { Property, PropertyKind, PropertyStatus, Tier } from "@/lib/types";

export const money = (n: number) => `$${n.toLocaleString("en-US")}`;

const TIER_STYLE: Record<Tier, string> = {
  hot: "bg-primary/10 text-primary border-primary/30",
  warm: "bg-sky-400/10 text-sky-300 border-sky-400/25",
  cold: "bg-slate-400/10 text-slate-300 border-slate-400/25",
};

/** Score colour: green 80+, amber 50–79, grey below 50. */
export function scoreTone(score: number) {
  if (score >= 80) return "bg-emerald-500/10 text-emerald-300 border-emerald-500/25";
  if (score >= 50) return "bg-amber-500/10 text-amber-300 border-amber-500/25";
  return "bg-slate-500/10 text-slate-300 border-slate-500/25";
}

/** Tier is always spelled out, never colour alone. With a score, the pill takes the score's colour. */
export function TierBadge({ tier, score }: { tier: Tier; score?: number }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border bg-gradient-to-b from-white/[0.04] to-transparent px-2.5 py-0.5 text-xs font-semibold capitalize",
        score !== undefined ? scoreTone(score) : TIER_STYLE[tier]
      )}
    >
      {tier}
      {score !== undefined ? <span className="tabular font-mono text-[11px]">{score}</span> : null}
    </span>
  );
}

/** 30px-tall line chart for a short series; the caller prints the actual figure next to it. */
export function Sparkline({ values, label, className }: { values: number[]; label: string; className?: string }) {
  if (values.length < 2) return null;
  const w = 88;
  const h = 30;
  const min = Math.min(...values);
  const span = Math.max(...values) - min || 1;
  const pts = values.map((v, i) => [(i / (values.length - 1)) * w, h - 3 - ((v - min) / span) * (h - 6)] as const);
  const line = pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const id = `spark-${label.replace(/[^a-z0-9]/gi, "")}`;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} width={w} height={h} className={cn("text-primary", className)} role="img" aria-label={label}>
      <defs>
        <linearGradient id={id} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="currentColor" stopOpacity="0.35" />
          <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={`0,${h} ${line} ${w},${h}`} fill={`url(#${id})`} />
      <polyline points={line} fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={pts[pts.length - 1][0]} cy={pts[pts.length - 1][1]} r={2.2} fill="currentColor" />
    </svg>
  );
}

const STATUS_STYLE: Record<PropertyStatus, string> = {
  active: "bg-emerald-500/15 text-emerald-300 ring-emerald-400/40",
  draft: "bg-slate-500/20 text-slate-200 ring-slate-400/40",
  reserved: "bg-amber-500/15 text-amber-300 ring-amber-400/40",
  sold: "bg-rose-500/15 text-rose-300 ring-rose-400/40",
};

/** Near-opaque variants for badges laid over a cover image. */
const STATUS_ON_COVER: Record<PropertyStatus, string> = {
  active: "bg-emerald-950/90 text-emerald-200 ring-emerald-400/60",
  draft: "bg-slate-900/90 text-slate-100 ring-slate-300/50",
  reserved: "bg-amber-950/90 text-amber-200 ring-amber-400/60",
  sold: "bg-rose-950/90 text-rose-200 ring-rose-400/60",
};

export function StatusBadge({ status, onCover = false }: { status: PropertyStatus; onCover?: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ring-1 backdrop-blur-sm", onCover ? STATUS_ON_COVER[status] : STATUS_STYLE[status])}>
      <span className="size-1.5 rounded-full bg-current" aria-hidden />
      {status}
    </span>
  );
}

export const KIND_LABEL: Record<PropertyKind, string> = { apartment: "Apartment", house: "House", penthouse: "Penthouse", townhouse: "Townhouse", loft: "Loft" };

/** `compact` is a quiet stat strip; `hero` is for the one row a page is about. */
export function Kpi({ label, value, hint, icon: Icon, size = "md" }: { label: string; value: string; hint: string; icon?: LucideIcon; size?: "compact" | "md" | "hero" }) {
  if (size === "compact") {
    return (
      <div className="flex items-center gap-3 rounded-lg border border-border/70 bg-card/50 px-3.5 py-2.5">
        {Icon ? <Icon className="size-4 shrink-0 text-primary/80" aria-hidden /> : null}
        <div className="min-w-0">
          <p className="flex items-baseline gap-2">
            <span className="tabular font-mono text-lg font-semibold text-foreground">{value}</span>
            <span className="truncate text-xs font-medium text-muted-foreground">{label}</span>
          </p>
          <p className="truncate text-[11px] text-muted-foreground/80">{hint}</p>
        </div>
      </div>
    );
  }
  return (
    <div className="group relative overflow-hidden rounded-xl border border-border bg-card/80 p-4 backdrop-blur transition hover:border-primary/40">
      <div className="pointer-events-none absolute -top-10 -right-10 size-28 rounded-full bg-primary/10 blur-2xl transition group-hover:bg-primary/20" aria-hidden />
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-semibold tracking-[0.14em] text-muted-foreground uppercase">{label}</p>
        {Icon ? (
          <span className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary ring-1 ring-primary/25">
            <Icon className="size-4" aria-hidden />
          </span>
        ) : null}
      </div>
      <p className={cn("tabular mt-2 font-mono text-foreground", size === "hero" ? "text-4xl font-bold" : "text-3xl font-semibold")}>{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
    </div>
  );
}

const AVATAR_TONES = ["from-amber-400/80 to-amber-700/80", "from-sky-400/80 to-indigo-600/80", "from-emerald-400/80 to-teal-700/80", "from-rose-400/80 to-fuchsia-700/80", "from-violet-400/80 to-purple-700/80", "from-slate-300/80 to-slate-600/80"];

/** Initials avatar with a stable colour per name (no photos on the demo desk). */
const RECENCY_DOT: Record<ContactRecency, string> = { recent: "bg-emerald-400", idle: "bg-amber-400", stale: "bg-slate-500" };

/** Initials avatar with a stable colour per name (no photos on the demo desk). The optional dot is contact recency, not presence. */
export function Avatar({ name, size = "md", recency }: { name: string; size?: "sm" | "md" | "lg"; recency?: { level: ContactRecency; label: string } }) {
  const initials = name
    .split(/\s+/)
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  const tone = AVATAR_TONES[[...name].reduce((s, c) => s + c.charCodeAt(0), 0) % AVATAR_TONES.length];
  return (
    <span className="relative inline-flex shrink-0">
      <span
        className={cn(
          "inline-flex items-center justify-center rounded-full bg-gradient-to-br font-semibold text-white shadow-inner ring-1 ring-white/15",
          tone,
          size === "sm" && "size-8 text-[11px]",
          size === "md" && "size-10 text-xs",
          size === "lg" && "size-14 text-base"
        )}
        aria-hidden
      >
        {initials}
      </span>
      {recency ? (
        <span
          title={recency.label}
          className={cn("absolute -right-0.5 -bottom-0.5 rounded-full ring-2 ring-card", RECENCY_DOT[recency.level], size === "lg" ? "size-3.5" : "size-2.5")}
        >
          <span className="sr-only">{recency.label}</span>
        </span>
      ) : null}
    </span>
  );
}

const RING_COLOR: Record<Tier, string> = { hot: "#c9a24b", warm: "#7dd3fc", cold: "#94a3b8" };

/** Circular 0-100 gauge; the number and tier are always printed beside the colour. */
export function ScoreRing({ score, tier, size = 64 }: { score: number; tier: Tier; size?: number }) {
  const r = (size - 8) / 2;
  const c = 2 * Math.PI * r;
  return (
    <span className="relative inline-flex shrink-0" style={{ width: size, height: size }} role="img" aria-label={`Score ${score} of 100, ${tier}`}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="currentColor" strokeWidth={6} className="text-muted" />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={RING_COLOR[tier]} strokeWidth={6} strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - score / 100)} />
      </svg>
      <span className="absolute inset-0 flex flex-col items-center justify-center leading-none">
        <span className="tabular font-mono text-lg font-semibold text-foreground">{score}</span>
        <span className="mt-0.5 text-[9px] font-semibold tracking-wider uppercase" style={{ color: RING_COLOR[tier] }}>
          {tier}
        </span>
      </span>
    </span>
  );
}

/** Dark chip for text laid over a property cover, readable on both the gradient and the line drawing. */
export function CoverChip({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span className={cn("inline-flex items-center rounded-full bg-black/75 px-2.5 py-0.5 text-[11px] font-semibold tracking-wider text-white uppercase ring-1 ring-white/20 backdrop-blur-sm", className)}>
      {children}
    </span>
  );
}

const QUICK_ACTION =
  "pointer-events-auto inline-flex min-h-9 items-center gap-1.5 rounded-lg bg-black/80 px-3 text-xs font-semibold text-white ring-1 ring-white/25 backdrop-blur-sm transition hover:bg-primary hover:text-primary-foreground hover:ring-primary focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none";

export function PropertyCard({ p }: { p: Property }) {
  return (
    <div
      data-ai-id={p.id}
      className="group relative overflow-hidden rounded-xl border border-border bg-card transition duration-300 focus-within:border-primary/50 hover:-translate-y-0.5 hover:border-primary/50 hover:shadow-xl hover:shadow-black/50"
    >
      <Link href={`/properties/${p.id}`} className="block focus-visible:outline-none" aria-label={`${p.title}, ${money(p.price)}`}>
        <PropertyCardBody p={p} />
      </Link>
      <div className="pointer-events-none absolute inset-x-0 top-0 flex h-40 items-center justify-center gap-2 bg-black/0 opacity-0 transition duration-200 group-focus-within:bg-black/55 group-focus-within:opacity-100 group-hover:bg-black/55 group-hover:opacity-100 [&>*]:pointer-events-auto">
        <PropertyCardActions p={p} className={QUICK_ACTION} />
      </div>
    </div>
  );
}

function PropertyCardBody({ p }: { p: Property }) {
  return (
    <>
      <PropertyCover kind={p.kind} cover={p.cover} photo={DEMO_PHOTOS[p.id]} photoAlt={`${p.title} — sample photo`} className="h-40">
        <div className="absolute inset-x-0 top-0 h-14 bg-gradient-to-b from-black/60 to-transparent" aria-hidden />
        <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/85 via-black/40 to-transparent" aria-hidden />
        <CoverChip className="absolute top-2.5 left-2.5">
          {KIND_LABEL[p.kind]} · {p.zone}
        </CoverChip>
        <div className="absolute top-2.5 right-2.5">
          <StatusBadge status={p.status} onCover />
        </div>
        <p className="tabular absolute bottom-2.5 left-3 font-mono text-xl font-semibold text-white drop-shadow">{money(p.price)}</p>
        {p.status === "active" ? <p className="absolute right-3 bottom-3 text-[11px] text-white/75">{p.daysOnMarket} days listed</p> : null}
      </PropertyCover>
      <div className="space-y-3 p-4">
        <div>
          <h3 className="text-[15px] font-semibold text-foreground transition group-hover:text-primary">{p.title}</h3>
          <p className="text-xs text-muted-foreground">{p.address}</p>
        </div>
        <PropertyFacts p={p} />
      </div>
    </>
  );
}

/** Beds · baths · m² with 14px icons and monospaced figures. */
export function PropertyFacts({ p, className }: { p: Pick<Property, "beds" | "baths" | "sqm">; className?: string }) {
  return (
    <p className={cn("grid grid-cols-3 divide-x divide-border rounded-lg border border-border bg-background/40 text-xs text-muted-foreground", className)}>
      <span className="inline-flex items-center justify-center gap-1.5 py-2">
        <BedDouble size={14} className="text-primary/80" aria-hidden /> <span className="tabular font-mono text-foreground">{p.beds}</span> bd
      </span>
      <span className="inline-flex items-center justify-center gap-1.5 py-2">
        <Bath size={14} className="text-primary/80" aria-hidden /> <span className="tabular font-mono text-foreground">{p.baths}</span> ba
      </span>
      <span className="inline-flex items-center justify-center gap-1.5 py-2">
        <Maximize2 size={14} className="text-primary/80" aria-hidden /> <span className="tabular font-mono text-foreground">{p.sqm}</span> m²
      </span>
    </p>
  );
}