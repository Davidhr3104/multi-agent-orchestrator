"use client";

import { useId, useState } from "react";
import { DEFAULT_COLORS, compact, linePath, niceMax, seriesPoints, smoothPath } from "./chart-math";
import { EmptyChart } from "./charts";

const MUTED = "color-mix(in srgb, currentColor 55%, transparent)";
const GRID = "color-mix(in srgb, currentColor 12%, transparent)";

export type AreaPoint = { label: string; value: number; detail?: string };

/** The only interactive chart (hover/focus tooltip), so it is the only one behind the client boundary. */
export function AreaChart({ points, color = DEFAULT_COLORS[0], unit = "", height = 180, ariaLabel, smooth = true }: { points: readonly AreaPoint[]; color?: string; unit?: string; height?: number; ariaLabel: string; smooth?: boolean }) {
  const gid = useId();
  const [active, setActive] = useState<number | null>(null);
  if (points.length === 0) return <EmptyChart label="No data yet" height={height} />;
  const W = 520;
  const padL = 34;
  const padB = 22;
  const padT = 10;
  const inner = { w: W - padL - 8, h: height - padB - padT };
  const values = points.map((p) => (Number.isFinite(p.value) ? p.value : 0));
  const max = niceMax(Math.max(0, ...values));
  const lowest = Math.min(0, ...values);
  const min = lowest < 0 ? -niceMax(-lowest) : 0;
  const pts = seriesPoints(values, inner.w, inner.h, 0, max, min).map(([x, y]) => [x + padL, y + padT] as const);
  const yOf = (v: number) => padT + inner.h - ((v - min) / (max - min)) * inner.h;
  const base = yOf(0);
  const ticks = (min < 0 ? [min, 0, max] : [0, max / 2, max]).map((v) => ({ y: yOf(v), v }));
  const line = smooth ? smoothPath(pts) : linePath(pts);
  return (
    <div style={{ position: "relative", width: "100%" }}>
      <svg viewBox={`0 0 ${W} ${height}`} width="100%" role="img" aria-label={ariaLabel} style={{ color, display: "block" }}>
        <defs>
          <linearGradient id={gid} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="currentColor" stopOpacity="0.32" />
            <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
          </linearGradient>
        </defs>
        {ticks.map((t) => (
          <g key={t.v}>
            <line x1={padL} x2={W - 8} y1={t.y} y2={t.y} stroke={GRID} strokeDasharray="3 4" />
            <text x={padL - 6} y={t.y + 3} textAnchor="end" fontSize="10" fill={MUTED}>
              {compact(t.v)}
              {unit}
            </text>
          </g>
        ))}
        {pts.length > 1 ? <path d={`${line} L${pts[pts.length - 1][0]},${base} L${pts[0][0]},${base} Z`} fill={`url(#${gid})`} /> : null}
        {pts.length > 1 ? <path d={line} fill="none" stroke="currentColor" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" /> : <circle cx={pts[0][0]} cy={pts[0][1]} r={3.5} fill="currentColor" />}
        {points.map((p, i) => (
          <g key={`${p.label}-${i}`}>
            {(i === 0 || i === points.length - 1 || points.length <= 8 || i % Math.ceil(points.length / 6) === 0) && (
              <text x={pts[i][0]} y={height - 6} textAnchor={points.length === 1 ? "middle" : i === 0 ? "start" : i === points.length - 1 ? "end" : "middle"} fontSize="10" fill={MUTED}>
                {p.label}
              </text>
            )}
            <rect
              x={pts[i][0] - inner.w / Math.max(2, points.length) / 2}
              y={padT}
              width={inner.w / Math.max(2, points.length)}
              height={inner.h}
              fill="transparent"
              tabIndex={0}
              aria-label={`${p.label}: ${compact(p.value)}${unit}${p.detail ? `, ${p.detail}` : ""}`}
              onMouseEnter={() => setActive(i)}
              onMouseLeave={() => setActive(null)}
              onFocus={() => setActive(i)}
              onBlur={() => setActive(null)}
              style={{ outline: "none" }}
            />
          </g>
        ))}
        {active !== null ? (
          <g pointerEvents="none">
            <line x1={pts[active][0]} x2={pts[active][0]} y1={padT} y2={padT + inner.h} stroke="currentColor" strokeOpacity="0.35" />
            <circle cx={pts[active][0]} cy={pts[active][1]} r={4} fill="currentColor" stroke="#0008" />
          </g>
        ) : null}
      </svg>
      {active !== null ? (
        <div
          role="status"
          style={{
            position: "absolute",
            top: 4,
            left: `${Math.min(80, Math.max(2, (pts[active][0] / W) * 100))}%`,
            transform: "translateX(-50%)",
            background: "rgba(8,12,22,.94)",
            color: "#eef0f6",
            border: "1px solid rgba(255,255,255,.14)",
            borderRadius: 8,
            padding: "4px 8px",
            fontSize: 11,
            whiteSpace: "nowrap",
            pointerEvents: "none",
          }}
        >
          <strong>{points[active].label}</strong> · {compact(points[active].value)}
          {unit}
          {points[active].detail ? <span style={{ opacity: 0.7 }}> · {points[active].detail}</span> : null}
        </div>
      ) : null}
    </div>
  );
}
