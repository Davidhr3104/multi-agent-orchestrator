"use client";

import { useEffect, useRef, useState } from "react";
import { Camera, Globe, Megaphone, MessageCircle, type LucideIcon } from "lucide-react";
import { notify } from "@/components/ai-desk-events";
import { listingCopy, type ListingCopy } from "@/lib/listing-copy";
import type { Property } from "@/lib/types";
import { cn } from "@/lib/utils";

const CHANNEL: Record<ListingCopy["key"], { label: string; icon: LucideIcon; tone: string }> = {
  social: { label: "Instagram post", icon: Camera, tone: "text-pink-400" },
  portal: { label: "Real-estate portal", icon: Globe, tone: "text-sky-400" },
  message: { label: "WhatsApp message", icon: MessageCircle, tone: "text-emerald-400" },
};

/** Pick the channel first, then copy. The text is built from the listing's own fields; nothing is published. */
export function PromoMenu({ property, className }: { property: Property; className?: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  async function copy(c: ListingCopy) {
    setOpen(false);
    try {
      await navigator.clipboard.writeText(c.text);
      notify(`${CHANNEL[c.key].label} for ${property.title} copied. Paste it where you publish — Helix doesn't post anything.`);
    } catch {
      notify("Couldn't copy — your browser blocked clipboard access.");
    }
  }

  const order: ListingCopy["key"][] = ["social", "portal", "message"];
  const copies = listingCopy(property);
  return (
    <div ref={ref} className="relative">
      <button type="button" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((o) => !o)} className={className}>
        <Megaphone className="size-3.5" aria-hidden /> Promo copy
      </button>
      {open ? (
        <div role="menu" aria-label="Copy promotion text for" className="glass-panel absolute top-full left-1/2 z-30 mt-2 w-56 -translate-x-1/2 overflow-hidden rounded-xl p-1 text-left animate-in fade-in-0 zoom-in-95 duration-150">
          <p className="px-2.5 pt-1.5 pb-1 text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">Copy for…</p>
          {order.map((k) => {
            const c = copies.find((x) => x.key === k)!;
            const { label, icon: Icon, tone } = CHANNEL[k];
            return (
              <button
                key={k}
                type="button"
                role="menuitem"
                onClick={() => void copy(c)}
                className="flex w-full cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm text-foreground transition hover:bg-accent focus-visible:bg-accent focus-visible:outline-none"
              >
                <Icon className={cn("size-4", tone)} aria-hidden /> {label}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
