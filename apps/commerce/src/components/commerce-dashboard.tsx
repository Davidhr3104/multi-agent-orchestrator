"use client";

import { useEffect, useMemo, useState } from "react";
import type { StoredOrder, StoredProduct } from "@helix/core";
import { Boxes, ShoppingCart, TrendingUp, Truck } from "lucide-react";
import { MetricCard } from "@/components/metric-card";
import { Sparkline } from "@/components/sparkline";
import { LiveOrdersTable } from "@/components/live-orders-table";
import { OrderInspector } from "@/components/order-inspector";
import { ReorderQueue } from "@/components/reorder-queue";
import { RevenueTrendChart } from "@/components/revenue-trend-chart";
import { formatCurrency } from "@/lib/format";

export function CommerceDashboard() {
  const [orders, setOrders] = useState<StoredOrder[]>([]);
  const [products, setProducts] = useState<StoredProduct[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  async function refresh() {
    const [ordersRes, productsRes] = await Promise.all([
      fetch("/api/orders"),
      fetch("/api/products"),
    ]);
    const ordersData = (await ordersRes.json()) as { orders: StoredOrder[] };
    const productsData = (await productsRes.json()) as { products: StoredProduct[] };
    setOrders(ordersData.orders);
    setProducts(productsData.products);
  }

  useEffect(() => {
    void refresh();
  }, []);

  useEffect(() => {
    if (!selectedId) {
      const firstReview = orders.find((o) => o.requiresReview);
      if (firstReview) setSelectedId(firstReview.id);
    }
  }, [orders, selectedId]);

  const selected = orders.find((o) => o.id === selectedId) ?? null;

  async function review(decision: "approved" | "flagged" | "cancelled") {
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

  const metrics = useMemo(() => {
    const revenue = orders.reduce((sum, o) => sum + o.totalPrice, 0);
    const fulfilled = orders.filter((o) => o.fulfillmentStatus === "fulfilled").length;
    const pending = orders.length - fulfilled;
    const restockCount = products.filter((p) => p.restockRecommended).length;
    const restockTitles = products
      .filter((p) => p.restockRecommended)
      .slice(0, 2)
      .map((p) => p.title)
      .join(" · ");
    const inTransit = orders.filter(
      (o) => o.fulfillmentStatus !== "fulfilled" && !o.requiresReview
    ).length;
    return { revenue, fulfilled, pending, restockCount, restockTitles, inTransit };
  }, [orders, products]);

  const revenueSpark = useMemo(() => {
    const now = Date.now();
    const buckets = new Array(6).fill(0);
    for (const o of orders) {
      const ageDays = Math.floor((now - new Date(o.createdAt).getTime()) / 86_400_000);
      const idx = 5 - ageDays;
      if (idx >= 0 && idx < 6) buckets[idx] += o.totalPrice;
    }
    return buckets;
  }, [orders]);

  return (
    <>
      <div className="animate-enter delay-1 flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-[22px] font-semibold tracking-tight text-foreground">Commerce Operations</h1>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
              <span className="size-1 rounded-full bg-primary" />
              All Systems Operational
            </span>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Mock Shopify feed seeded on load · Agent pipeline automated
          </p>
        </div>
      </div>

      <section className="animate-enter delay-2 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          icon={<ShoppingCart className="size-4" />}
          label="Total Orders"
          value={String(orders.length)}
          hint={`${metrics.fulfilled} fulfilled · ${metrics.pending} pending`}
          right={<Sparkline points={revenueSpark.length ? revenueSpark : [0, 0]} className="h-8 w-16 text-[#059669] opacity-70" />}
        />
        <MetricCard
          icon={<TrendingUp className="size-4" />}
          label="Total Revenue"
          value={formatCurrency(metrics.revenue)}
          hint="From seeded mock orders"
          right={
            <Sparkline
              points={revenueSpark.length ? revenueSpark : [0, 0]}
              filled
              className="h-8 w-16 text-[#059669] opacity-70"
            />
          }
        />
        <MetricCard
          icon={<Boxes className="size-4" />}
          label="Inventory Alerts"
          tone="amber"
          statusBadge="Low Stock"
          attention
          value={`${metrics.restockCount} items`}
          hint={metrics.restockTitles || "None"}
        />
        <MetricCard
          icon={<Truck className="size-4" />}
          label="Fulfillment"
          tone="cyan"
          statusBadge="Action Required"
          attention
          value={`${metrics.inTransit} in transit`}
          hint="Awaiting carrier update"
        />
      </section>

      <div className="grid grid-cols-1 items-start gap-6 pt-2 lg:grid-cols-12">
        <div className="animate-enter delay-3 space-y-4 lg:col-span-8">
          <LiveOrdersTable orders={orders} selectedId={selectedId} onSelect={(o) => setSelectedId(o.id)} />
        </div>
        <div className="animate-enter delay-4 space-y-4 lg:col-span-4">
          {selected ? (
            <OrderInspector
              order={selected}
              onClose={() => setSelectedId(null)}
              onReview={(decision) => void review(decision)}
            />
          ) : (
            <div className="glass-panel rounded-xl p-5 text-sm text-muted-foreground">
              Select an order to inspect its fraud assessment.
            </div>
          )}
        </div>
      </div>

      <div className="animate-enter delay-5 grid grid-cols-1 gap-6 pt-2 lg:grid-cols-12">
        <div className="lg:col-span-6">
          <ReorderQueue products={products} />
        </div>
        <div className="lg:col-span-6">
          <RevenueTrendChart orders={orders} />
        </div>
      </div>
    </>
  );
}
