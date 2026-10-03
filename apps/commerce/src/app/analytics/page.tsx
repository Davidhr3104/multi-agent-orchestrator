"use client";

import { useEffect, useMemo, useState } from "react";
import type { StoredInquiry, StoredOrder } from "@helix/core";
import { RevenueTrendChart } from "@/components/revenue-trend-chart";
import { formatCurrency } from "@/lib/format";
import { AreaChart, Donut, EmptyChart, HBarList, StackedBar } from "@helix/ui";
import { DeskChartCard } from "@/components/desk-mode";
import { countBy, dailyBuckets, humanize, pluralize, revenueByProduct, riskSlices } from "@/lib/commerce-charts";

const SENTIMENT_COLOR: Record<string, string> = { positive: "#34d399", neutral: "#94a3b8", negative: "#f87171", angry: "#f87171", frustrated: "#fb923c" };

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

  const byProduct = useMemo(() => revenueByProduct(orders).slice(0, 8), [orders]);
  const days = useMemo(() => dailyBuckets(orders, 7), [orders]);
  const byType = useMemo(() => countBy(inquiries, (i) => i.inquiryType), [inquiries]);
  const bySentiment = useMemo(() => countBy(inquiries, (i) => i.sentiment), [inquiries]);

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


      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <RevenueTrendChart orders={orders} />
        <DeskChartCard title="Fraud risk breakdown" subtitle="Orders by risk level" source="Source: risk level assigned to each order.">
          {orders.length === 0 ? (
            <EmptyChart label="No orders yet" />
          ) : (
            <div className="flex flex-wrap items-center justify-center gap-5">
              <Donut slices={riskSlices(orders)} size={150} centerValue={orders.length} centerLabel="orders" ariaLabel="Orders by risk level" />
            </div>
          )}
        </DeskChartCard>
        <DeskChartCard title="Revenue by product" subtitle="Line items on loaded orders" source="Source: price x quantity of each order line item.">
          {byProduct.length === 0 ? <EmptyChart label="No line items yet" /> : <HBarList items={byProduct.map((p) => ({ label: p.label, value: p.value, hint: pluralize(p.units, "unit") }))} format={(n) => formatCurrency(n)} colorAll="#10b981" />}
        </DeskChartCard>
        <DeskChartCard title="Orders per day" subtitle="Last 7 days, by day placed" source="Source: orders on this desk.">
          <AreaChart points={days.map((d) => ({ label: d.label, value: d.orders, detail: pluralize(d.orders, "order") }))} height={140} color="#10b981" ariaLabel="Orders placed per day, last 7 days" />
        </DeskChartCard>
        <DeskChartCard title="Inquiries" subtitle={`${pluralize(inquiries.length, "inquiry", "inquiries")} by type and sentiment`} source="Source: AI classification of each inquiry.">
          {inquiries.length === 0 ? (
            <EmptyChart label="No inquiries yet" />
          ) : (
            <div className="space-y-4">
              <HBarList items={byType.map((t) => ({ label: humanize(t.key), value: t.count }))} format={(n) => String(n)} colorAll="#10b981" />
              <p className="pt-2 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">Sentiment</p>
              <StackedBar segments={bySentiment.map((t) => ({ label: humanize(t.key), value: t.count, color: SENTIMENT_COLOR[t.key] ?? "#94a3b8" }))} ariaLabel="Inquiries by sentiment" />
            </div>
          )}
        </DeskChartCard>
      </div>
    </div>
  );
}
