"use client";

import { useEffect, useMemo, useState } from "react";
import type { StoredInquiry, StoredOrder } from "@helix/core";
import { RevenueTrendChart } from "@/components/revenue-trend-chart";
import { formatCurrency } from "@/lib/format";

export default function AnalyticsPage() {
  const [orders, setOrders] = useState<StoredOrder[]>([]);
  const [inquiries, setInquiries] = useState<StoredInquiry[]>([]);

  useEffect(() => {
    void (async () => {
      const [ordersRes, inquiriesRes] = await Promise.all([
        fetch("/api/orders"),
        fetch("/api/inquiries"),
      ]);
      const ordersData = (await ordersRes.json()) as { orders: StoredOrder[] };
      const inquiriesData = (await inquiriesRes.json()) as { inquiries: StoredInquiry[] };
      setOrders(ordersData.orders);
      setInquiries(inquiriesData.inquiries);
    })();
  }, []);

  const riskBreakdown = useMemo(() => {
    const levels = ["low", "medium", "high", "critical"] as const;
    return levels.map((level) => ({
      level,
      count: orders.filter((o) => o.riskLevel === level).length,
    }));
  }, [orders]);

  const avgOrderValue = orders.length
    ? orders.reduce((s, o) => s + o.totalPrice, 0) / orders.length
    : 0;

  const humanReviewRate = inquiries.length
    ? Math.round((inquiries.filter((i) => i.requiresHuman).length / inquiries.length) * 100)
    : 0;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Analytics</h1>
        <p className="mt-1 text-xs text-muted-foreground">
          Derived from live order and inquiry data — no historical warehouse yet.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="glass-panel glass-panel-glow rounded-xl p-4">
          <p className="text-xs text-primary/80">Avg. order value</p>
          <p className="mt-1 font-mono text-2xl font-bold text-foreground">
            {formatCurrency(avgOrderValue)}
          </p>
        </div>
        <div className="glass-panel glass-panel-glow rounded-xl p-4">
          <p className="text-xs text-primary/80">Inquiries requiring human</p>
          <p className="mt-1 font-mono text-2xl font-bold text-foreground">{humanReviewRate}%</p>
        </div>
        <div className="glass-panel glass-panel-glow rounded-xl p-4">
          <p className="text-xs text-primary/80">Orders scored</p>
          <p className="mt-1 font-mono text-2xl font-bold text-foreground">{orders.length}</p>
        </div>
      </div>

      <RevenueTrendChart orders={orders} />

      <div className="glass-panel glass-panel-glow space-y-3 rounded-xl p-5">
        <h3 className="text-sm font-semibold text-foreground">Fraud risk breakdown</h3>
        <div className="space-y-2">
          {riskBreakdown.map((r) => (
            <div key={r.level} className="flex items-center gap-3 text-xs">
              <span className="w-16 font-mono uppercase text-primary/70">{r.level}</span>
              <div className="h-2 flex-1 rounded-full bg-black/10 dark:bg-black/40">
                <div
                  className="h-2 rounded-full bg-primary"
                  style={{
                    width: `${orders.length ? (r.count / orders.length) * 100 : 0}%`,
                  }}
                />
              </div>
              <span className="w-6 text-right font-mono text-foreground">{r.count}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
