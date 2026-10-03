"use client";

import { useEffect, useMemo, useState } from "react";
import type { StoredOrder } from "@helix/core";
import { formatCurrency, formatRelativeDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Avatar, HBarList } from "@helix/ui";
import { DeskChartCard } from "@/components/desk-mode";
import { aggregateCustomers } from "@/lib/commerce-charts";
import { InquiriesPanel } from "@/components/inquiries-panel";

type Tab = "directory" | "inquiries";

export default function CustomersPage() {
  const [tab, setTab] = useState<Tab>("directory");
  const [orders, setOrders] = useState<StoredOrder[]>([]);

  useEffect(() => {
    void (async () => {
      const res = await fetch("/api/orders");
      const data = (await res.json()) as { orders: StoredOrder[] };
      setOrders(data.orders);
    })();
  }, []);

  const customers = useMemo(() => aggregateCustomers(orders), [orders]);
  const returning = customers.filter((c) => c.segment === "returning").length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Customers</h1>
          <p className="mt-1 text-xs text-muted-foreground">
            Aggregated from order history — no separate CRM record yet.
          </p>
        </div>
        <div className="flex items-center gap-1.5 rounded-lg border border-primary/20 bg-secondary/60 p-1">
          <button
            onClick={() => setTab("directory")}
            className={cn(
              "min-h-9 rounded px-3 py-1 text-xs font-medium transition",
              tab === "directory" ? "bg-primary/30 text-primary" : "text-muted-foreground hover:text-foreground"
            )}
          >
            Directory
          </button>
          <button
            onClick={() => setTab("inquiries")}
            className={cn(
              "min-h-9 rounded px-3 py-1 text-xs font-medium transition",
              tab === "inquiries" ? "bg-primary/30 text-primary" : "text-muted-foreground hover:text-foreground"
            )}
          >
            Inquiries
          </button>
        </div>
      </div>

      {tab === "directory" && customers.length > 0 ? (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          <DeskChartCard title="Top customers by spend" subtitle={`Top ${Math.min(5, customers.length)} of ${customers.length}`} source="Source: sum of order totals per e-mail on loaded orders." className="lg:col-span-8">
            <HBarList items={customers.slice(0, 5).map((c) => ({ label: c.name, value: c.totalSpend, hint: c.email }))} format={(n) => formatCurrency(n)} colorAll="#10b981" />
          </DeskChartCard>
          <DeskChartCard title="Segments" subtitle="New vs returning" source="Returning = more than one order, counting the store's own order count." className="lg:col-span-4">
            <HBarList items={[{ label: "New", value: customers.length - returning, color: "#34d399" }, { label: "Returning", value: returning, color: "#10b981" }]} format={(n) => String(n)} />
          </DeskChartCard>
        </div>
      ) : null}

      {tab === "directory" ? (
        <div className="glass-panel glass-panel-glow overflow-hidden rounded-xl shadow-2xl">
          <div className="overflow-x-auto">
            <table className="min-w-[560px] w-full text-left text-xs text-secondary-foreground">
              <thead className="border-b border-primary/20 bg-black/[0.02] font-mono text-[11px] tracking-wider text-primary/80 uppercase dark:bg-[#051913]/90">
                <tr>
                  <th className="px-4 py-3">Customer</th>
                  <th className="px-4 py-3">Orders</th>
                  <th className="px-4 py-3">Total Spend</th>
                  <th className="px-4 py-3">Last Order</th>
                  <th className="px-4 py-3">Flags</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-primary/20">
                {customers.map((c) => (
                  <tr key={c.email} className="transition hover:bg-primary/10">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <Avatar name={c.name} size={32} />
                        <div className="min-w-0">
                          <div className="font-medium text-foreground">
                            {c.name}
                            <span className="ml-2 rounded-full bg-primary/10 px-1.5 py-0.5 text-[11px] font-medium text-primary">{c.segment === "returning" ? "Returning" : "New"}</span>
                          </div>
                          <div className="font-mono text-[11px] text-primary/70">{c.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 font-mono text-foreground">{c.lifetimeOrders}</td>
                    <td className="px-4 py-3 font-mono font-medium text-foreground">
                      {formatCurrency(c.totalSpend)}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {formatRelativeDate(c.lastOrderAt)}
                    </td>
                    <td className="px-4 py-3">
                      {c.hasCriticalRisk ? (
                        <span className="rounded border border-rose-500/40 bg-rose-500/10 px-2 py-0.5 font-mono text-[11px] text-rose-600 dark:text-rose-300">
                          Critical risk order
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {customers.length === 0 ? (
              <p className="px-4 py-8 text-sm text-muted-foreground">No customers yet.</p>
            ) : null}
          </div>
        </div>
      ) : (
        <InquiriesPanel />
      )}
    </div>
  );
}
