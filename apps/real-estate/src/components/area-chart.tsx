"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

export type AreaPoint = { label: string; value: number; detail?: string };

const W = 600;
const H = 180;
const PAD_TOP = 14;

/** Area chart with an opacity gradient and a floating tooltip. Each column is focusable so the values are reachable by keyboard. */
export function AreaChart({ points, unit, className }: { points: AreaPoint[]; unit: string; className?: string }) {
  const [hover, setHover] = useState<number | null>(null);
  if (points.length < 2) return <p className="text-sm text-muted-foreground">Not enough data yet.</p>;
  const max = Math.max(1, ...points.map((p) => p.value));
  const x = (i: number) => (i / (points.length - 1)) * W;
  const y = (v: number) => H - (v / max) * (H - PAD_TOP);
  const line = points.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join(" ");
  const ticks = [0, Math.round(max / 2), max].filter((t, i, a) => a.indexOf(t) === i);
  const h = hover === null ? null : points[hover];

  return (
    <div className={cn("relative", className)}>
      <div className="relative ml-8 h-48">
        {ticks.map((t) => (
          <div key={t} className="absolute inset-x-0 border-t border-dashed border-border/60" style={{ top: `${(y(t) / H) * 100}%` }}>
            <span className="tabular absolute -top-2 -left-8 w-6 text-right font-mono text-[10px] text-muted-foreground">{t}</span>
          </div>
        ))}
        <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="absolute inset-0 h-full w-full overflow-visible text-primary" aria-hidden>
          <defs>
            <linearGradient id="area-fill" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="currentColor" stopOpacity="0.45" />
              <stop offset="70%" stopColor="currentColor" stopOpacity="0.08" />
              <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d={`${line} L${W},${H} L0,${H} Z`} fill="url(#area-fill)" />
          <path d={line} fill="none" stroke="currentColor" strokeWidth={2.2} vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
        </svg>
        {hover !== null ? (
          <>
            <div className="pointer-events-none absolute inset-y-0 w-px bg-primary/40" style={{ left: `${(x(hover) / W) * 100}%` }} aria-hidden />
            <span
              className="pointer-events-none absolute size-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-background bg-primary shadow-[0_0_10px_rgba(201,162,75,0.7)]"
              style={{ left: `${(x(hover) / W) * 100}%`, top: `${(y(points[hover].value) / H) * 100}%` }}
              aria-hidden
            />
          </>
        ) : null}
        <div className="absolute inset-0 flex">
          {points.map((p, i) => (
            <button
              key={p.label}
              type="button"
              className="h-full flex-1 cursor-crosshair focus-visible:bg-primary/5 focus-visible:outline-none"
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
              onFocus={() => setHover(i)}
              onBlur={() => setHover(null)}
              aria-label={`${p.label}: ${p.value} ${unit}`}
            />
          ))}
        </div>
        {h && hover !== null ? (
          <div
            role="status"
            className={cn(
              "pointer-events-none absolute z-10 min-w-36 rounded-lg border border-slate-700 bg-slate-900/95 px-3 py-2 text-xs shadow-2xl backdrop-blur-md",
              hover > points.length / 2 ? "-translate-x-full -ml-3" : "ml-3"
            )}
            style={{ left: `${(x(hover) / W) * 100}%`, top: `${Math.min((y(h.value) / H) * 100, 55)}%` }}
          >
            <p className="text-muted-foreground">{h.label}</p>
            <p className="tabular font-mono text-base font-bold text-foreground">
              {h.value} <span className="text-xs font-normal text-muted-foreground">{unit}</span>
            </p>
            {h.detail ? <p className="mt-0.5 text-muted-foreground">{h.detail}</p> : null}
          </div>
        ) : null}
      </div>
      <div className="mt-2 ml-8 flex justify-between text-[10px] text-muted-foreground">
        <span>{points[0].label}</span>
        <span>{points[Math.floor(points.length / 2)].label}</span>
        <span>{points[points.length - 1].label}</span>
      </div>
    </div>
  );
}
