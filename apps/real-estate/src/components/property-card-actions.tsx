"use client";

import { useState } from "react";
import { Images, Users } from "lucide-react";
import { PromoMenu } from "@/components/promo-menu";
import { PropertyDrawer, type DrawerTab } from "@/components/property-drawer";
import type { Property } from "@/lib/types";

/** Hover actions over a property card. They open panels in place instead of leaving the list. */
export function PropertyCardActions({ p, className }: { p: Property; className: string }) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<DrawerTab>("buyers");
  const show = (t: DrawerTab) => {
    setTab(t);
    setOpen(true);
  };
  const promotable = p.status === "active" || p.status === "draft";
  return (
    <>
      <button type="button" onClick={() => show("buyers")} className={className}>
        <Users className="size-3.5" aria-hidden /> Matching buyers
      </button>
      <button type="button" onClick={() => show("media")} className={className} aria-label={`Media for ${p.title}`}>
        <Images className="size-3.5" aria-hidden />
      </button>
      {promotable ? <PromoMenu property={p} className={className} /> : null}
      <PropertyDrawer property={p} open={open} onOpenChange={setOpen} tab={tab} onTab={setTab} />
    </>
  );
}
