"use client";

import { useMemo } from "react";
import type { StoredOrder } from "@helix/core";
import { AreaChart } from "@helix/ui";
import { DeskChartCard } from "@/components/desk-mode";
import { dailyBuckets } from "@/lib/commerce-charts";
import { formatCurrency } from "@/lib/format";

/**
 * Revenue by day placed, from the orders on the desk. Only what the orders say: there is no
 * projection line, because a straight-line extrapolation of seven points is not a forecast.
 */
export function RevenueTrendChart({ orders, days = 7 }: { orders: StoredOrder[]; days?: number }) {
  const buckets = useMemo(() => dailyBuckets(orders, days), [orders, days]);
  const total = buckets.reduce((s, b) => s + b.revenue, 0);
  const placed = buckets.reduce((s, b) => s + b.orders, 0);
  return (
    <DeskChartCard
      data-tour="commerce-revenue"
      title={`${days}-day revenue`}
      subtitle={`${formatCurrency(total)} from ${placed} ${placed === 1 ? "order" : "orders"} placed`}
      source="Source: orders on this desk, summed by day placed. Orders older than the window are not counted."
    >
      <AreaChart
        points={buckets.map((b) => ({ label: b.label, value: Math.round(b.revenue * 100) / 100, detail: `${b.orders} ${b.orders === 1 ? "order" : "orders"}` }))}
        unit=""
        height={200}
        color="#10b981"
        ariaLabel={`Revenue per day for the last ${days} days, total ${formatCurrency(total)}`}
      />
    </DeskChartCard>
  );
}
