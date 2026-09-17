"use client";

import { useEffect, useState, type ReactNode } from "react";
import type { StoredOrder, StoredProduct } from "@helix/core";
import { Sidebar } from "@/components/sidebar";
import { AppHeader } from "@/components/app-header";
import { CommerceToastHost } from "@/components/demo-toast";

export function AppShell({
  children,
  initialOrdersNeedingReview = 0,
  initialInventoryAlerts = 0,
}: {
  children: ReactNode;
  initialOrdersNeedingReview?: number;
  initialInventoryAlerts?: number;
}) {
  const [ordersNeedingReview, setOrdersNeedingReview] = useState(initialOrdersNeedingReview);
  const [inventoryAlerts, setInventoryAlerts] = useState(initialInventoryAlerts);

  useEffect(() => {
    void (async () => {
      const [ordersRes, productsRes] = await Promise.all([
        fetch("/api/orders"),
        fetch("/api/products"),
      ]);
      const ordersData = (await ordersRes.json()) as { orders: StoredOrder[] };
      const productsData = (await productsRes.json()) as { products: StoredProduct[] };
      setOrdersNeedingReview(ordersData.orders.filter((o) => o.requiresReview).length);
      setInventoryAlerts(productsData.products.filter((p) => p.restockRecommended).length);
    })();
  }, []);

  return (
    <>
      <div className="flex h-screen w-full overflow-hidden bg-background">
        <Sidebar ordersNeedingReview={ordersNeedingReview} inventoryAlerts={inventoryAlerts} />
        <div className="relative flex min-w-0 flex-1 flex-col overflow-hidden bg-background">
          <AppHeader />
          <main className="relative z-10 flex-1 space-y-6 overflow-y-auto bg-background p-6 md:p-8">
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-x-0 top-0 z-[-1] h-[900px] overflow-hidden"
            >
              <div className="bg-tech-grid absolute inset-0 opacity-75 dark:opacity-75" />
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_60%_10%,rgba(16,185,129,0.08)_0%,transparent_60%)] dark:bg-[radial-gradient(circle_at_60%_10%,rgba(16,185,129,0.15)_0%,transparent_60%)]" />
              <div className="blob-animate-1 absolute -top-24 right-1/4 size-[600px] rounded-full bg-primary/5 blur-[130px] dark:bg-primary/10" />
              <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-b from-transparent to-background" />
            </div>
            {children}
          </main>
        </div>
      </div>
      <CommerceToastHost />
    </>
  );
}
