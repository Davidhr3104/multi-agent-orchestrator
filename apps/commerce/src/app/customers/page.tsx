"use client";

import { useEffect, useMemo, useState } from "react";
import type { StoredOrder } from "@helix/core";
import { formatCurrency, formatRelativeDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { InquiriesPanel } from "@/components/inquiries-panel";

type CustomerRow = {
  email: string;
  name: string;
  orderCount: number;
  totalSpend: number;
  lastOrderAt: string;
  hasCriticalRisk: boolean;
};

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

  const customers = useMemo<CustomerRow[]>(() => {
    const byEmail = new Map<string, CustomerRow>();
    for (const order of orders) {
      const existing = byEmail.get(order.customerEmail);
      if (existing) {
        existing.orderCount += 1;
        existing.totalSpend += order.totalPrice;
        if (order.createdAt > existing.lastOrderAt) existing.lastOrderAt = order.createdAt;
        existing.hasCriticalRisk = existing.hasCriticalRisk || order.riskLevel === "critical";
      } else {
        byEmail.set(order.customerEmail, {
          email: order.customerEmail,
          name: order.customerName,
          orderCount: 1,
          totalSpend: order.totalPrice,
          lastOrderAt: order.createdAt,
          hasCriticalRisk: order.riskLevel === "critical",
        });
      }
    }
    return [...byEmail.values()].sort((a, b) => b.totalSpend - a.totalSpend);
  }, [orders]);

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
              "rounded px-3 py-1 text-xs font-medium transition",
              tab === "directory" ? "bg-primary/30 text-primary" : "text-muted-foreground hover:text-foreground"
            )}
          >
            Directory
          </button>
          <button
            onClick={() => setTab("inquiries")}
            className={cn(
              "rounded px-3 py-1 text-xs font-medium transition",
              tab === "inquiries" ? "bg-primary/30 text-primary" : "text-muted-foreground hover:text-foreground"
            )}
          >
            Inquiries
          </button>
        </div>
      </div>

      {tab === "directory" ? (
        <div className="glass-panel glass-panel-glow overflow-hidden rounded-xl shadow-2xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-secondary-foreground">
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
                      <div className="font-medium text-foreground">{c.name}</div>
                      <div className="font-mono text-[11px] text-primary/70">{c.email}</div>
                    </td>
                    <td className="px-4 py-3 font-mono text-foreground">{c.orderCount}</td>
                    <td className="px-4 py-3 font-mono font-medium text-foreground">
                      {formatCurrency(c.totalSpend)}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {formatRelativeDate(c.lastOrderAt)}
                    </td>
                    <td className="px-4 py-3">
                      {c.hasCriticalRisk ? (
                        <span className="rounded border border-rose-500/40 bg-rose-500/10 px-2 py-0.5 font-mono text-[10px] text-rose-600 dark:text-rose-300">
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
