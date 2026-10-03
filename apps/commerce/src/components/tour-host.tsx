"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { TOUR_COMMERCE } from "@helix/help";
import { startHelixTour } from "@/lib/product-tour";

/**
 * Help links to /?tour=1 to replay the tour. It only starts by itself on a desktop-width first visit:
 * on a phone the spotlight would sit on top of a 130px-wide layout and the navigation drawer.
 */
export function TourHost() {
  const pathname = usePathname();
  useEffect(() => {
    if (pathname !== "/") return;
    const force = new URLSearchParams(window.location.search).get("tour") === "1";
    if (force) window.history.replaceState(null, "", window.location.pathname);
    const desktop = window.matchMedia("(min-width: 768px)").matches;
    if (!force && !desktop) return;
    return startHelixTour("commerce", TOUR_COMMERCE, { force });
  }, [pathname]);
  return null;
}
