"use client";

import type { ReactNode } from "react";
import { KpiCard } from "@helix/ui";

/** Desk palette for charts: silver for neutral, amber for emphasis, semantic colours for verdicts. */
export const INK = {
  hot: "#f59e0b",
  warm: "#cbd5e1",
  cold: "#475569",
  go: "#34d399",
  conditional: "#fbbf24",
  noGo: "#f87171",
  won: "#34d399",
  lost: "#f87171",
  pending: "#fbbf24",
  neutral: "#94a3b8",
  navy: "#3b5b8c",
  silver: "#e2e8f0",
} as const;

export const VERDICT_COLOR: Record<string, string> = { GO: INK.go, CONDITIONAL: INK.conditional, "NO-GO": INK.noGo };

/** @helix/ui charts inherit currentColor; this gives them a silver ink on the dark desk surface. */
export function Ink({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`text-slate-200 ${className}`}>{children}</div>;
}

export function KpiRow({ items }: { items: { label: string; value: ReactNode; hint?: string; accent?: string }[] }) {
  return (
    <Ink className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {items.map((k) => (
        <KpiCard key={k.label} label={k.label} value={k.value} hint={k.hint} accent={k.accent ?? INK.hot} />
      ))}
    </Ink>
  );
}

export function fmtUsd(n: number): string {
  return `$${Math.round(n).toLocaleString("en-US")}`;
}
