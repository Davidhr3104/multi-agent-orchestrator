"use client";

import { driver } from "driver.js";
import "driver.js/dist/driver.css";
import type { TourStepDef } from "@helix/help";
import { tourDoneKey } from "@helix/help";

export function startHelixTour(
  product: "inbox" | "legal" | "leads",
  steps: TourStepDef[],
  opts?: { force?: boolean }
) {
  if (typeof window === "undefined") return;
  const key = tourDoneKey(product);
  if (!opts?.force) {
    try {
      if (localStorage.getItem(key) === "1") return;
    } catch {
      /* ignore */
    }
  }

  const available = steps.filter((s) => document.querySelector(s.element));
  if (available.length === 0) return;

  const d = driver({
    showProgress: true,
    animate: true,
    overlayOpacity: 0.55,
    stagePadding: 8,
    popoverClass: "helix-driver-popover",
    nextBtnText: "Next",
    prevBtnText: "Back",
    doneBtnText: "Done",
    steps: available.map((s) => ({
      element: s.element,
      popover: {
        title: s.title,
        description: s.description,
        side: "bottom" as const,
        align: "start" as const,
      },
    })),
    onDestroyStarted: () => {
      try {
        localStorage.setItem(key, "1");
      } catch {
        /* ignore */
      }
      d.destroy();
    },
  });
  d.drive();
}
