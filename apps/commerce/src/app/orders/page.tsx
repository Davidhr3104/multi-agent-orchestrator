"use client";

import { useEffect, useState } from "react";
import type { StoredOrder } from "@helix/core";
import { LiveOrdersTable } from "@/components/live-orders-table";
import { OrderInspector } from "@/components/order-inspector";

export default function OrdersPage() {
  const [orders, setOrders] = useState<StoredOrder[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      const res = await fetch("/api/orders");
      const data = (await res.json()) as { orders: StoredOrder[] };
      setOrders(data.orders);
    })();
  }, []);

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

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Orders</h1>
        <p className="mt-1 text-xs text-muted-foreground">
          All ingested orders with real-time fraud scoring.
        </p>
      </div>
      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-12">
        <div className="space-y-4 lg:col-span-8">
          <LiveOrdersTable orders={orders} selectedId={selectedId} onSelect={(o) => setSelectedId(o.id)} />
        </div>
        <div className="space-y-4 lg:col-span-4">
          {selected ? (
            <OrderInspector
              order={selected}
              onClose={() => setSelectedId(null)}
              onReview={(decision) => void review(decision)}
            />
          ) : (
            <div className="glass-panel glass-panel-glow rounded-xl p-5 text-sm text-muted-foreground shadow-2xl">
              Select an order to inspect its fraud assessment.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
