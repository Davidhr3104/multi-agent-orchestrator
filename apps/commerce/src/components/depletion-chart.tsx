"use client";

import { useId, useState } from "react";
import { EmptyChart, compact, linePath, niceMax } from "@helix/ui";
import type { Trajectory } from "@/lib/inventory-metrics";

const MUTED = "color-mix(in srgb, currentColor 55%, transparent)";
const GRID = "color-mix(in srgb, currentColor 10%, transparent)";
const HISTORY = "#34d399";
const PROJECTION = "#f87171";

/**
 * Catalog units over time: reconstructed history up to today, then the per-SKU velocity projection.
 * The shaded floor is total safety stock (sum of reorder points).
 */
export function DepletionChart({ trajectory, height = 250 }: { trajectory: Trajectory; height?: number }) {
  const gid = useId();
  const [active, setActive] = useState<number | null>(null);
  const { history, projection, safetyUnits, firstStockoutDay } = trajectory;
  if (history.length === 0 || projection.length === 0) return <EmptyChart label="No products yet" height={height} />;

  const W = 720;
  const padL = 40;
  const padR = 14;
  const padT = 22;
  const padB = 24;
  const minDay = history[0].day;
  const maxDay = projection[projection.length - 1].day;
  const all = [...history, ...projection.slice(1)];
  const max = niceMax(Math.max(1, safetyUnits, ...all.map((p) => p.units)));
  const x = (day: number) => padL + ((day - minDay) / Math.max(1, maxDay - minDay)) * (W - padL - padR);
  const y = (v: number) => padT + (1 - v / max) * (height - padT - padB);
  const base = y(0);

  const histPts = history.map((p) => [x(p.day), y(p.units)] as const);
  const projPts = projection.map((p) => [x(p.day), y(p.units)] as const);
  const histLine = linePath(histPts);
  const projLine = linePath(projPts);
  const todayX = x(0);
  const safetyY = y(safetyUnits);
  const stockout = firstStockoutDay !== null && firstStockoutDay <= maxDay ? projection[firstStockoutDay] : null;
  const ticks = [0, max / 2, max];
  const xLabels = all.filter((p) => p.day % 7 === 0);
  const activePoint = active === null ? null : all[active];
  const end = projection[projection.length - 1];

  return (
    <div className="relative w-full text-foreground">
      <svg
        viewBox={`0 0 ${W} ${height}`}
        width="100%"
        role="img"
        aria-label={`Catalog units: ${history[0].units} ${history.length - 1} days ago, ${projection[0].units} today, ${end.units} projected in ${end.day} days. Safety stock ${safetyUnits} units.`}
        className="block"
      >
        <defs>
          <linearGradient id={gid} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor={HISTORY} stopOpacity="0.28" />
            <stop offset="100%" stopColor={HISTORY} stopOpacity="0" />
          </linearGradient>
        </defs>
        {ticks.map((v) => (
          <g key={v}>
            <line x1={padL} x2={W - padR} y1={y(v)} y2={y(v)} stroke={GRID} strokeDasharray="3 4" />
            <text x={padL - 6} y={y(v) + 3} textAnchor="end" fontSize="10" fill={MUTED} className="tabular-nums">
              {compact(v)}
            </text>
          </g>
        ))}

        {safetyUnits > 0 ? (
          <g>
            <rect x={padL} y={safetyY} width={W - padL - padR} height={Math.max(0, base - safetyY)} fill={HISTORY} fillOpacity="0.06" />
            <line x1={padL} x2={W - padR} y1={safetyY} y2={safetyY} stroke={HISTORY} strokeOpacity="0.45" strokeDasharray="4 4" />
            <text x={padL + 6} y={safetyY - 5} fontSize="10" fill={HISTORY} fillOpacity="0.85">
              Safety stock · {compact(safetyUnits)} units (sum of reorder points)
            </text>
          </g>
        ) : null}

        <path d={`${histLine} L${histPts[histPts.length - 1][0]},${base} L${histPts[0][0]},${base} Z`} fill={`url(#${gid})`} />
        <path d={histLine} fill="none" stroke={HISTORY} strokeWidth={2.25} strokeLinejoin="round" strokeLinecap="round" />
        <path d={projLine} fill="none" stroke={PROJECTION} strokeWidth={2} strokeDasharray="5 5" strokeLinejoin="round" strokeLinecap="round" />

        <line x1={todayX} x2={todayX} y1={padT - 8} y2={base} stroke="currentColor" strokeOpacity="0.35" strokeDasharray="2 3" />
        <text x={todayX} y={padT - 11} textAnchor="middle" fontSize="10" fontWeight="600" fill="currentColor" fillOpacity="0.8">
          Today · {projection[0].label}
        </text>
        <circle cx={todayX} cy={y(projection[0].units)} r={4} fill={HISTORY} stroke="#0008" />

        {stockout ? (
          <g>
            <line x1={x(stockout.day)} x2={x(stockout.day)} y1={y(stockout.units)} y2={base} stroke={PROJECTION} strokeOpacity="0.4" strokeDasharray="2 3" />
            <circle cx={x(stockout.day)} cy={y(stockout.units)} r={4} fill={PROJECTION} stroke="#0008" />
            <text
              x={x(stockout.day) + (stockout.day > maxDay * 0.7 ? -8 : 8)}
              y={y(stockout.units) - 8}
              textAnchor={stockout.day > maxDay * 0.7 ? "end" : "start"}
              fontSize="10"
              fontWeight="600"
              fill={PROJECTION}
            >
              First SKU stockout · {stockout.label}
            </text>
          </g>
        ) : null}

        {xLabels.map((p) => (
          <text
            key={p.day}
            x={x(p.day)}
            y={height - 6}
            textAnchor={p.day === minDay ? "start" : p.day === maxDay ? "end" : "middle"}
            fontSize="10"
            fill={p.day === 0 ? "currentColor" : MUTED}
            fontWeight={p.day === 0 ? 600 : 400}
          >
            {p.day === 0 ? "Today" : p.label}
          </text>
        ))}

        {all.map((p, i) => (
          <rect
            key={p.day}
            x={x(p.day) - (W - padL - padR) / Math.max(2, all.length) / 2}
            y={padT}
            width={(W - padL - padR) / Math.max(2, all.length)}
            height={base - padT}
            fill="transparent"
            tabIndex={0}
            aria-label={`${p.label}: ${compact(p.units)} units${p.day > 0 ? " projected" : ""}`}
            onMouseEnter={() => setActive(i)}
            onMouseLeave={() => setActive(null)}
            onFocus={() => setActive(i)}
            onBlur={() => setActive(null)}
            style={{ outline: "none" }}
          />
        ))}
        {activePoint ? (
          <g pointerEvents="none">
            <line x1={x(activePoint.day)} x2={x(activePoint.day)} y1={padT} y2={base} stroke="currentColor" strokeOpacity="0.3" />
            <circle cx={x(activePoint.day)} cy={y(activePoint.units)} r={4} fill={activePoint.day > 0 ? PROJECTION : HISTORY} stroke="#0008" />
          </g>
        ) : null}
      </svg>
      {activePoint ? (
        <div
          role="status"
          className="pointer-events-none absolute top-1 -translate-x-1/2 rounded-md border border-white/15 bg-black/85 px-2 py-1 text-[11px] whitespace-nowrap text-white"
          style={{ left: `${Math.min(88, Math.max(12, (x(activePoint.day) / W) * 100))}%` }}
        >
          <strong>{activePoint.label}</strong> · <span className="font-mono tabular-nums">{compact(activePoint.units)}</span> units
          <span className="opacity-70">{activePoint.day > 0 ? " · projected" : activePoint.day < 0 ? " · reconstructed" : " · on hand"}</span>
        </div>
      ) : null}
    </div>
  );
}
