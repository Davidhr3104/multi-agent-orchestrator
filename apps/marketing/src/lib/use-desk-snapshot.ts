"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import type { MarketingWindow } from "@helix/core";
import type { DeskSnapshot } from "@/lib/store";
import { deskWindow, saveJson } from "@/lib/desk-prefs";

/**
 * One client-side source for every page: GET /api/campaigns?window= returns getSnapshot(), and the chosen
 * window is shared between pages (localStorage), so "$ spent" is the same number on /, /review and /attribution.
 */
export const WINDOWS: readonly MarketingWindow[] = ["7d", "30d", "90d"];

const WINDOW_EVENT = "helix:desk-window";

function subscribeWindow(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener(WINDOW_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(WINDOW_EVENT, onChange);
  };
}

/** The shared analysis window. Renders "7d" on the server and adopts the saved window after hydration. */
export function useDeskWindow(): [MarketingWindow, (w: MarketingWindow) => void] {
  const win = useSyncExternalStore(subscribeWindow, deskWindow, () => "7d" as const);
  const setWin = useCallback((w: MarketingWindow) => {
    saveJson("window", w);
    window.dispatchEvent(new Event(WINDOW_EVENT));
  }, []);
  return [win, setWin];
}

async function fetchSnapshot(w: MarketingWindow): Promise<DeskSnapshot> {
  const res = await fetch(`/api/campaigns?window=${w}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return (await res.json()) as DeskSnapshot;
}

const errorText = (e: unknown) => (e instanceof Error ? e.message : "Could not load the desk snapshot");

export function useDeskSnapshot() {
  const [win, setWin] = useDeskWindow();
  const [snap, setSnap] = useState<DeskSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    fetchSnapshot(win).then(
      (s) => {
        if (!live) return;
        setSnap(s);
        setError(null);
      },
      // never fail silently: the page shows this message instead of stale or empty charts
      (e: unknown) => {
        if (live) setError(errorText(e));
      }
    );
    return () => {
      live = false;
    };
  }, [win]);

  const reload = useCallback(async () => {
    try {
      setSnap(await fetchSnapshot(win));
      setError(null);
    } catch (e) {
      setError(errorText(e));
    }
  }, [win]);

  return { snap, win, setWin, error, reload, loading: snap === null && error === null };
}
