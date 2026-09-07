"use client";

import { useMemo } from "react";
import type { StoredOrder } from "@helix/core";
import { formatCurrency } from "@/lib/format";

function buildDailySeries(orders: StoredOrder[], days: number): number[] {
  const buckets = new Array(days).fill(0);
  const now = Date.now();
  for (const order of orders) {
    const ageDays = Math.floor((now - new Date(order.createdAt).getTime()) / 86_400_000);
    const idx = days - 1 - ageDays;
    if (idx >= 0 && idx < days) buckets[idx] += order.totalPrice;
  }
  return buckets;
}

export function RevenueTrendChart({ orders }: { orders: StoredOrder[] }) {
  const series = useMemo(() => buildDailySeries(orders, 7), [orders]);
  const total = series.reduce((a, b) => a + b, 0);

  const w = 500;
  const h = 120;
  const max = Math.max(...series, 1);
  const step = w / (series.length - 1 || 1);
  const points = series.map((v, i) => {
    const x = i * step;
    const y = h - (v / max) * (h - 20) - 10;
    return { x, y };
  });
  const linePath = points.map((p, i) => `${i === 0 ? "M" : "L"}${p.x},${p.y}`).join(" ");
  const areaPath = `${linePath} L${w},${h} L0,${h} Z`;

  const lastPoint = points[points.length - 1];
  const projected = lastPoint
    ? [
        { x: lastPoint.x + step * 0.75, y: lastPoint.y - 8 },
        { x: lastPoint.x + step * 1.5, y: lastPoint.y - 12 },
      ]
    : [];
  const projectedPath = lastPoint
    ? `M${lastPoint.x},${lastPoint.y} L${projected.map((p) => `${p.x},${p.y}`).join(" L")}`
    : "";

  return (
    <div className="glass-panel glass-panel-glow space-y-4 rounded-xl p-5 shadow-xl">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold tracking-wide text-foreground">
            7-Day Revenue Velocity
          </h3>
          <p className="text-xs text-primary/70">Revenue from ingested orders, by day placed</p>
        </div>
        <div className="text-right">
          <span className="font-mono text-sm font-bold text-primary drop-shadow-[0_1px_2px_rgba(0,0,0,0.6)]">
            {formatCurrency(total)}
          </span>
          <p className="text-[10px] text-primary/60">Last 7 days</p>
        </div>
      </div>

      <div className="h-32 w-full pt-2">
        <svg className="h-full w-full" preserveAspectRatio="none" viewBox={`0 0 ${w + 60} ${h}`}>
          <defs>
            <linearGradient id="revenueGradient" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="#34D399" stopOpacity="0.45" />
              <stop offset="100%" stopColor="#10B981" stopOpacity="0" />
            </linearGradient>
          </defs>
          <line className="text-border" stroke="currentColor" strokeWidth="1" x1="0" x2={w + 60} y1="20" y2="20" />
          <line className="text-border" stroke="currentColor" strokeWidth="1" x1="0" x2={w + 60} y1="60" y2="60" />
          <line className="text-border" stroke="currentColor" strokeWidth="1" x1="0" x2={w + 60} y1="100" y2="100" />
          <path d={areaPath} fill="url(#revenueGradient)" />
          <path
            d={linePath}
            fill="none"
            stroke="#34D399"
            strokeLinecap="round"
            strokeWidth="2.5"
          />
          {lastPoint ? (
            <path d={projectedPath} fill="none" stroke="#6EE7B7" strokeDasharray="4,4" strokeWidth="2" />
          ) : null}
          {lastPoint ? (
            <>
              <circle
                className="origin-center animate-ping opacity-75"
                cx={lastPoint.x}
                cy={lastPoint.y}
                fill="#34D399"
                r="6"
              />
              <circle
                className="text-card"
                cx={lastPoint.x}
                cy={lastPoint.y}
                fill="#34D399"
                r="4"
                stroke="currentColor"
                strokeWidth="2"
              />
            </>
          ) : null}
        </svg>
      </div>

      <div className="flex items-center justify-between border-t border-primary/20 pt-2 font-mono text-[11px] text-primary/80">
        <span className="flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-primary shadow-[0_0_6px_rgba(52,211,153,0.8)]" />
          Actual revenue by day
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-2 border-t-2 border-dashed border-primary/60" />
          Linear projection
        </span>
        <span>Live</span>
      </div>
    </div>
  );
}
