"use client";

import { driver } from "driver.js";
import "driver.js/dist/driver.css";
import { tourDoneKey, type TourProduct, type TourStepDef } from "@helix/help";
import { OVERLAY_OPEN_EVENT } from "@/lib/overlay-events";

const WAIT_MS = 6000;
const POLL_MS = 250;

/** Runs the first-visit tour once per browser; `force` replays it. Steps whose element isn't on the page are skipped. */
export function startHelixTour(product: TourProduct, steps: TourStepDef[], opts?: { force?: boolean }): () => void {
  if (typeof window === "undefined") return () => {};
  const key = tourDoneKey(product);
  if (!opts?.force) {
    try {
      if (localStorage.getItem(key) === "1") return () => {};
    } catch {
      /* storage blocked: show the tour */
    }
  }

  let cancelled = false;
  let timer: number | undefined;
  let active: ReturnType<typeof driver> | undefined;
  const started = Date.now();
  const present = () => steps.filter((s) => document.querySelector(s.element));

  const tick = () => {
    if (cancelled) return;
    const available = present();
    const waitedEnough = Date.now() - started >= WAIT_MS;
    if (available.length < steps.length && !waitedEnough) {
      timer = window.setTimeout(tick, POLL_MS);
      return;
    }
    if (available.length === 0) return;

    const d = driver({
      showProgress: true,
      progressText: "{{current}} of {{total}}",
      animate: !window.matchMedia("(prefers-reduced-motion: reduce)").matches,
      overlayOpacity: 0.6,
      stagePadding: 8,
      stageRadius: 12,
      popoverClass: "helix-driver-popover",
      nextBtnText: "Next",
      prevBtnText: "Back",
      doneBtnText: "Done",
      steps: available.map((s) => ({
        element: s.element,
        popover: { title: s.title, description: s.description, side: s.side ?? "bottom", align: "start" as const },
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
    active = d;
    d.drive();
  };

  /** Another overlay (the navigation drawer) opened: close the tour and count it as seen. */
  const onOverlayOpen = () => {
    cancelled = true;
    window.clearTimeout(timer);
    try {
      localStorage.setItem(key, "1");
    } catch {
      /* ignore */
    }
    active?.destroy();
  };
  window.addEventListener(OVERLAY_OPEN_EVENT, onOverlayOpen);

  timer = window.setTimeout(tick, POLL_MS);
  return () => {
    cancelled = true;
    window.clearTimeout(timer);
    window.removeEventListener(OVERLAY_OPEN_EVENT, onOverlayOpen);
    active?.destroy();
  };
}
