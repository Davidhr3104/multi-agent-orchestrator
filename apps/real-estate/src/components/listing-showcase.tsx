"use client";

import { useState } from "react";
import Link from "next/link";
import { BadgeCheck, Users } from "lucide-react";
import { KIND_LABEL, money } from "@/components/bits";
import { PropertyCover } from "@/components/property-cover";
import { PropertyDrawer, type DrawerTab } from "@/components/property-drawer";
import type { Property } from "@/lib/types";
import { cn } from "@/lib/utils";

const CHIP = "absolute top-3 rounded bg-background/90 px-2 py-0.5 text-[10px] font-semibold tracking-wider uppercase backdrop-blur-md";

/** Featured-listing card: photo, price per m², and the desk's own matching and showing counts. */
export function ListingShowcaseCard({
  p,
  photo,
  strongFit,
  showings30,
  best,
}: {
  p: Property;
  photo?: string;
  strongFit: number;
  showings30: number;
  best?: { name: string; fit: number };
}) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<DrawerTab>("buyers");
  const status =
    p.status === "reserved"
      ? { label: "Reserved", tone: "text-sky-300" }
      : strongFit > 0
        ? { label: `${strongFit} strong-fit buyer${strongFit === 1 ? "" : "s"}`, tone: "text-[var(--gold-soft,var(--primary))]" }
        : { label: "Active · no strong fit yet", tone: "text-muted-foreground" };

  return (
    <article data-ai-id={p.id} className="group flex flex-col overflow-hidden rounded-xl bg-card/90 transition hover:shadow-[0_12px_36px_rgba(0,0,0,0.6)]">
      <div className="relative h-48 overflow-hidden">
        {photo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={photo} alt={`${p.title} — sample photo`} className="size-full object-cover transition-transform duration-500 group-hover:scale-105" />
        ) : (
          <PropertyCover kind={p.kind} cover={p.cover} className="size-full" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-card via-card/20 to-transparent" aria-hidden />
        <span className={cn(CHIP, "left-3", status.tone)}>{status.label}</span>
        <span className={cn(CHIP, "right-3 font-medium tracking-normal text-muted-foreground normal-case")}>Day {p.daysOnMarket} listed</span>
        <div className="absolute inset-x-3 bottom-2 flex items-baseline justify-between gap-2">
          <span className="tabular font-heading text-lg font-bold text-foreground">{money(p.price)}</span>
          <span className="tabular text-[10px] text-muted-foreground">
            {p.sqm} m² · {money(Math.round(p.price / p.sqm))}/m²
          </span>
        </div>
      </div>
      <div className="flex flex-1 flex-col justify-between gap-3 p-4">
        <div>
          <div className="flex items-center justify-between gap-2">
            <Link href={`/properties/${p.id}`} className="truncate font-heading text-base font-semibold text-foreground hover:text-primary">
              {p.title}
            </Link>
            {strongFit > 0 ? <BadgeCheck className="size-4 shrink-0 text-primary" aria-label="Has strong-fit buyers" /> : null}
          </div>
          <p className="truncate text-xs text-muted-foreground">
            {p.address} · {p.zone} · {KIND_LABEL[p.kind]}
          </p>
        </div>
        <dl className="grid grid-cols-2 gap-2 rounded-lg bg-background/60 p-2">
          <div>
            <dt className="text-[10px] text-muted-foreground uppercase">Strong-fit buyers</dt>
            <dd className="tabular font-heading text-xl font-semibold text-primary">{strongFit}</dd>
          </div>
          <div>
            <dt className="text-[10px] text-muted-foreground uppercase">Showings · 30d</dt>
            <dd className="tabular font-heading text-xl font-semibold text-[var(--tertiary,#38bdf8)]">{showings30}</dd>
          </div>
        </dl>
        <div className="space-y-1.5">
          <p className="flex items-center justify-between gap-2 text-[10px] text-muted-foreground">
            <span className="truncate">{best ? `Best match: ${best.name}` : "No open buyer fits yet"}</span>
            {best ? <span className="shrink-0 text-[var(--tertiary,#38bdf8)]">{best.fit}% fit</span> : null}
          </p>
          <button
            type="button"
            onClick={() => {
              setTab("buyers");
              setOpen(true);
            }}
            className="flex w-full cursor-pointer items-center justify-center gap-1.5 rounded-lg bg-accent px-4 py-2 text-xs font-semibold tracking-wide text-[var(--gold-soft,var(--primary))] transition hover:bg-muted"
          >
            <Users className="size-4" aria-hidden /> Matching buyers
          </button>
        </div>
      </div>
      <PropertyDrawer property={p} open={open} onOpenChange={setOpen} tab={tab} onTab={setTab} />
    </article>
  );
}
