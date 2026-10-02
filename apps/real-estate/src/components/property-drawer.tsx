"use client";

import { useEffect, useState, type ChangeEvent } from "react";
import Link from "next/link";
import { CalendarPlus, ChevronLeft, ChevronRight, ImagePlus, MessageCircle, Ruler } from "lucide-react";
import { Avatar, TierBadge, money } from "@/components/bits";
import { PropertyCover } from "@/components/property-cover";
import { DEMO_PHOTOS } from "@/lib/demo-photos";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import type { FitPart } from "@/lib/scoring";
import { phoneDigits } from "@/lib/status";
import type { Property, Tier } from "@/lib/types";
import { cn } from "@/lib/utils";

export type DrawerTab = "buyers" | "media";

type Buyer = {
  id: string;
  name: string;
  phone: string | null;
  stage: string;
  score: number;
  tier: Tier;
  intent: string;
  fit: number;
  parts: FitPart[];
};

function FitRing({ fit }: { fit: number }) {
  const r = 17;
  const c = 2 * Math.PI * r;
  const tone = fit >= 70 ? "#34d399" : fit >= 50 ? "#fbbf24" : "#94a3b8";
  return (
    <span className="relative inline-flex size-11 shrink-0" role="img" aria-label={`Fit ${fit} of 100`}>
      <svg width={44} height={44} className="-rotate-90">
        <circle cx={22} cy={22} r={r} fill="none" stroke="currentColor" strokeWidth={4} className="text-muted" />
        <circle cx={22} cy={22} r={r} fill="none" stroke={tone} strokeWidth={4} strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - fit / 100)} />
      </svg>
      <span className="tabular absolute inset-0 flex items-center justify-center font-mono text-xs font-semibold text-foreground">{fit}</span>
    </span>
  );
}

function BuyersTab({ property, open }: { property: Property; open: boolean }) {
  const [state, setState] = useState<{ buyers: Buyer[] | null; error: string | null }>({ buyers: null, error: null });

  useEffect(() => {
    if (!open) return;
    let alive = true;
    fetch(`/api/properties/${encodeURIComponent(property.id)}/buyers`)
      .then(async (r) => {
        const body = (await r.json()) as { buyers?: Buyer[]; error?: string };
        if (!alive) return;
        setState(r.ok ? { buyers: body.buyers ?? [], error: null } : { buyers: null, error: body.error ?? `Request failed (${r.status})` });
      })
      .catch(() => alive && setState({ buyers: null, error: "Couldn't load buyers." }));
    return () => {
      alive = false;
    };
  }, [open, property.id]);

  if (state.error) return <p className="px-4 text-sm text-rose-400">{state.error}</p>;
  if (!state.buyers)
    return (
      <div className="space-y-3 px-4" aria-busy="true">
        <span className="sr-only">Loading matching buyers…</span>
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="skeleton h-28" />
        ))}
      </div>
    );
  if (state.buyers.length === 0) return <p className="px-4 text-sm text-muted-foreground">No open buyers on the desk yet.</p>;

  return (
    <ul className="space-y-3 px-4 pb-4">
      {state.buyers.map((b) => (
        <li key={b.id} className="surface rounded-xl p-3">
          <div className="flex items-center gap-3">
            <Avatar name={b.name} size="sm" />
            <div className="min-w-0 flex-1">
              <Link href={`/leads/${b.id}`} className="block truncate text-sm font-semibold text-foreground hover:text-primary">
                {b.name}
              </Link>
              <p className="truncate text-[11px] text-muted-foreground">
                {b.intent} · {b.stage}
              </p>
            </div>
            <TierBadge tier={b.tier} score={b.score} />
            <FitRing fit={b.fit} />
          </div>
          <ul className="mt-3 space-y-1.5" aria-label={`Fit breakdown for ${b.name}`}>
            {b.parts.map((p) => (
              <li key={p.label} className="grid grid-cols-[5.5rem_1fr_auto] items-center gap-2 text-[11px]">
                <span className="text-muted-foreground">{p.label}</span>
                <span className="h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden>
                  <span className={cn("block h-full rounded-full", p.ok ? "bg-emerald-400" : p.points > 0 ? "bg-amber-400" : "bg-rose-400")} style={{ width: `${(p.points / p.max) * 100}%` }} />
                </span>
                <span className="tabular font-mono text-foreground">
                  {p.points}/{p.max}
                </span>
                <span className={cn("col-span-3 -mt-1 truncate", p.ok ? "text-muted-foreground" : "text-amber-300")} title={p.detail}>
                  {p.ok ? "✓" : "!"} {p.detail}
                </span>
              </li>
            ))}
          </ul>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {b.phone ? (
              <a
                href={`https://wa.me/${phoneDigits(b.phone)}?text=${encodeURIComponent(`Hi ${b.name.split(" ")[0]}, ${property.title} in ${property.zone} (${money(property.price)}) fits what you asked for. Want to see it?`)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-8 items-center gap-1.5 rounded-lg bg-emerald-500/10 px-2.5 text-xs font-semibold text-emerald-300 ring-1 ring-emerald-500/30 hover:bg-emerald-500/20"
              >
                <MessageCircle className="size-3.5" aria-hidden /> WhatsApp
              </a>
            ) : null}
            {property.status === "active" ? (
              <Link href={`/calendar?lead=${b.id}#schedule`} className="inline-flex min-h-8 items-center gap-1.5 rounded-lg px-2.5 text-xs font-semibold text-primary ring-1 ring-primary/30 hover:bg-primary/10">
                <CalendarPlus className="size-3.5" aria-hidden /> Book showing
              </Link>
            ) : null}
          </div>
        </li>
      ))}
    </ul>
  );
}

function MediaTab({ property }: { property: Property }) {
  const [local, setLocal] = useState<{ url: string; name: string }[]>([]);
  const [i, setI] = useState(0);
  const slides = local.length + 1;

  useEffect(() => () => local.forEach((x) => URL.revokeObjectURL(x.url)), [local]);

  function pick(e: ChangeEvent<HTMLInputElement>) {
    const files = [...(e.target.files ?? [])].filter((f) => f.type.startsWith("image/")).slice(0, 12);
    setLocal((prev) => [...prev, ...files.map((f) => ({ url: URL.createObjectURL(f), name: f.name }))]);
    e.target.value = "";
  }

  const at = i % slides;
  return (
    <div className="space-y-3 px-4 pb-4">
      <div className="relative overflow-hidden rounded-xl">
        {at === 0 ? (
          <PropertyCover kind={property.kind} cover={property.cover} photo={DEMO_PHOTOS[property.id]} photoAlt={`${property.title} — sample photo`} className="h-60" />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={local[at - 1].url} alt={local[at - 1].name} className="h-60 w-full object-cover" />
        )}
        {slides > 1 ? (
          <>
            <button type="button" aria-label="Previous image" onClick={() => setI((n) => (n - 1 + slides) % slides)} className="absolute top-1/2 left-2 inline-flex size-8 -translate-y-1/2 items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/80">
              <ChevronLeft className="size-4" aria-hidden />
            </button>
            <button type="button" aria-label="Next image" onClick={() => setI((n) => (n + 1) % slides)} className="absolute top-1/2 right-2 inline-flex size-8 -translate-y-1/2 items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/80">
              <ChevronRight className="size-4" aria-hidden />
            </button>
          </>
        ) : null}
        <span className="tabular absolute right-2 bottom-2 rounded-full bg-black/70 px-2 py-0.5 font-mono text-[10px] text-white">
          {at + 1}/{slides}
        </span>
      </div>
      <p className="text-[11px] text-muted-foreground">{at === 0 ? "Illustration by property type — no listing photos are uploaded on this desk yet." : "Local preview from your device — not uploaded or saved to the desk."}</p>
      <div className="grid grid-cols-2 gap-2">
        <label className="flex min-h-20 cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-border text-xs text-muted-foreground transition hover:border-primary/50 hover:text-foreground">
          <ImagePlus className="size-5" aria-hidden />
          Preview photos
          <input type="file" accept="image/*" multiple onChange={pick} className="sr-only" />
        </label>
        <div className="flex min-h-20 flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-border text-center text-xs text-muted-foreground">
          <Ruler className="size-5" aria-hidden />
          No floor plan uploaded
        </div>
      </div>
    </div>
  );
}

export function PropertyDrawer({ property, open, onOpenChange, tab, onTab }: { property: Property; open: boolean; onOpenChange: (o: boolean) => void; tab: DrawerTab; onTab: (t: DrawerTab) => void }) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="glass-panel w-full gap-0 overflow-y-auto sm:max-w-md">
        <SheetHeader className="border-b border-border/60">
          <SheetTitle className="pr-8 text-lg">{property.title}</SheetTitle>
          <SheetDescription>
            {property.zone} · {money(property.price)} · {property.beds} bd · {property.sqm} m²
          </SheetDescription>
          <div role="tablist" aria-label="Listing panel" className="mt-3 inline-flex w-fit gap-1 rounded-lg bg-muted/60 p-0.5">
            {(
              [
                ["buyers", "Matching buyers"],
                ["media", "Media"],
              ] as const
            ).map(([v, label]) => (
              <button
                key={v}
                type="button"
                role="tab"
                aria-selected={tab === v}
                onClick={() => onTab(v)}
                className={cn("min-h-8 cursor-pointer rounded-md px-3 text-xs font-semibold transition", tab === v ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}
              >
                {label}
              </button>
            ))}
          </div>
        </SheetHeader>
        <div className="pt-4">
          {tab === "buyers" ? (
            <>
              <p className="px-4 pb-3 text-[11px] text-muted-foreground">Fit = budget 40 + location 30 + bedrooms 20 + availability 10, from each buyer&apos;s own brief.</p>
              <BuyersTab property={property} open={open} />
            </>
          ) : (
            <MediaTab property={property} />
          )}
        </div>
        <div className="mt-auto border-t border-border/60 p-4">
          <Link href={`/properties/${property.id}`} className="text-xs font-semibold text-primary hover:underline">
            Open the full listing →
          </Link>
        </div>
      </SheetContent>
    </Sheet>
  );
}
