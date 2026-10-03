"use client";

import { useEffect, useMemo, useState } from "react";
import type { StoredOrder } from "@helix/core";
import { AreaChart, KpiCard, StackedBar } from "@helix/ui";
import { DeskChartCard } from "@/components/desk-mode";
import { LiveOrdersTable } from "@/components/live-orders-table";
import { OrderInspector } from "@/components/order-inspector";
import { dailyBuckets, exposureUsd, pluralize, riskSegments } from "@/lib/commerce-charts";
import { formatCurrency } from "@/lib/format";

export default function OrdersPage() {
  const [orders, setOrders] = useState<StoredOrder[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      const res = await fetch("/api/orders");
      const data = (await res.json()) as { orders: StoredOrder[] };
      setOrders(data.orders);
      // A ?order=<id> link (e.g. from a product's recent orders) wins; otherwise preselect the order
      // that most needs a human so the inspector is never an empty slab.
      const linked = new URLSearchParams(window.location.search).get("order");
      const first = data.orders.find((o) => o.id === linked) ?? data.orders.find((o) => o.requiresReview) ?? data.orders[0];
      if (first) setSelectedId(first.id);
    })();
  }, []);

  const selected = orders.find((o) => o.id === selectedId) ?? null;
  const days = useMemo(() => dailyBuckets(orders, 7), [orders]);
  const revenue = orders.reduce((s, o) => s + o.totalPrice, 0);
  const review = orders.filter((o) => o.requiresReview).length;
  const exposed = orders.reduce((s, o) => s + (o.requiresReview ? exposureUsd(o) : 0), 0);

  async function decide(decision: "approved" | "flagged" | "cancelled") {
    if (!selected) return;
    const res = await fetch(`/api/orders/${selected.id}/review`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ decision }),
    });
    const data = (await res.json()) as { order?: StoredOrder };
    if (data.order) {
      setOrders((prev) => prev.map((o) => (o.id === data.order!.id ? data.order! : o)));
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Orders</h1>
        <p className="mt-1 text-xs text-muted-foreground">All ingested orders with real-time fraud scoring.</p>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard label="Orders" value={String(orders.length)} accent="#10b981" />
        <KpiCard label="Revenue" value={formatCurrency(revenue)} accent="#10b981" hint="Sum of loaded orders" />
        <KpiCard label="Need review" value={String(review)} accent="#fb923c" hint={review ? "Waiting on a human" : "Nothing waiting"} />
        <KpiCard label="Exposed $" value={formatCurrency(exposed)} accent="#f87171" hint="Total x fraud score, open reviews" />
      </div>

      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-12">
        <div className="min-w-0 space-y-6 lg:col-span-8">
          <LiveOrdersTable orders={orders} selectedId={selectedId} onSelect={(o) => setSelectedId(o.id)} />
          <div className="grid grid-cols-1 gap-6 md:grid-cols-5">
            <DeskChartCard
              title="Orders by risk level"
              subtitle={pluralize(orders.length, "order")}
              source="Source: risk level assigned to each order."
              className="h-full md:col-span-2"
            >
              <StackedBar segments={riskSegments(orders)} ariaLabel="Orders by risk level" />
            </DeskChartCard>
            <DeskChartCard
              title="Orders per day"
              subtitle="Last 7 days, by day placed"
              source="Source: orders on this desk."
              className="h-full md:col-span-3"
            >
              <AreaChart
                points={days.map((d) => ({ label: d.label, value: d.orders, detail: pluralize(d.orders, "order") }))}
                height={120}
                color="#10b981"
                ariaLabel="Orders placed per day, last 7 days"
              />
            </DeskChartCard>
          </div>
        </div>
        <div className="space-y-4 lg:sticky lg:top-4 lg:col-span-4">
          {selected ? (
            <OrderInspector order={selected} onClose={() => setSelectedId(null)} onReview={(d) => void decide(d)} />
          ) : (
            <div className="glass-panel rounded-xl p-5 text-sm text-muted-foreground">
              Select an order to inspect its fraud assessment.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
