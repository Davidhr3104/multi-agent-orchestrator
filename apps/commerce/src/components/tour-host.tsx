"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { TOUR_COMMERCE } from "@helix/help";
import { startHelixTour } from "@/lib/product-tour";

/** First visit to the dashboard shows the tour once; Help links to /?tour=1 to replay it. */
export function TourHost() {
  const pathname = usePathname();
  useEffect(() => {
    if (pathname !== "/") return;
    const force = new URLSearchParams(window.location.search).get("tour") === "1";
    if (force) window.history.replaceState(null, "", window.location.pathname);
    return startHelixTour("commerce", TOUR_COMMERCE, { force });
  }, [pathname]);
  return null;
}
