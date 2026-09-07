"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  Boxes,
  CircleHelp,
  LayoutDashboard,
  Package,
  Settings,
  ShoppingCart,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";

type NavItem = {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  badge?: number;
};

export function Sidebar({
  ordersNeedingReview,
  inventoryAlerts,
}: {
  ordersNeedingReview: number;
  inventoryAlerts: number;
}) {
  const pathname = usePathname();

  const nav: NavItem[] = [
    { href: "/", label: "Dashboard", icon: LayoutDashboard },
    { href: "/orders", label: "Orders", icon: ShoppingCart, badge: ordersNeedingReview },
    { href: "/products", label: "Products", icon: Boxes },
    { href: "/inventory", label: "Inventory", icon: Package, badge: inventoryAlerts },
    { href: "/customers", label: "Customers", icon: Users },
    { href: "/analytics", label: "Analytics", icon: BarChart3 },
    { href: "/settings", label: "Settings", icon: Settings },
    { href: "/help", label: "How to use", icon: CircleHelp },
  ];

  return (
    <aside
      className="flex w-64 shrink-0 flex-col justify-between border-r border-sidebar-border p-4 text-sm"
      style={{
        background:
          "linear-gradient(180deg, #072019 0%, #061512 35%, #04100d 100%)",
      }}
    >
      <div className="space-y-6">
        <div className="flex items-center gap-2.5 px-2 py-1.5">
          <Image src="/logo-icon.png" alt="" width={175} height={383} className="h-8 w-auto shrink-0" priority />
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-sm font-extrabold tracking-tight text-white">HELIX</span>
              <span className="text-sm font-medium text-white">for Commerce</span>
            </div>
            <p className="text-[11px] leading-tight text-muted-foreground">Commerce OS</p>
          </div>
        </div>

        <nav className="space-y-1">
          {nav.map((item) => {
            const active = pathname === item.href;
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center justify-between rounded-lg border-l-2 px-3 py-2 transition-all duration-150",
                  active
                    ? "border-primary font-medium text-white"
                    : "border-transparent text-[#c7ccd3] hover:bg-white/[0.03] hover:text-white"
                )}
                style={active ? { background: "rgba(16, 185, 129, 0.08)" } : undefined}
              >
                <div className="flex items-center gap-3">
                  <Icon className={cn("size-4", active ? "text-primary" : "text-[#c7ccd3]")} />
                  <span>{item.label}</span>
                </div>
                {active ? (
                  <span className="size-1 rounded-full bg-primary" />
                ) : item.badge ? (
                  <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-medium text-[#c7ccd3]">
                    {item.badge}
                  </span>
                ) : null}
              </Link>
            );
          })}
        </nav>
      </div>

      <div className="border-t border-sidebar-border pt-4">
        <div className="flex cursor-pointer items-center justify-between rounded-lg p-2 transition hover:bg-white/[0.03]">
          <div className="flex items-center gap-3">
            <div className="flex size-8 items-center justify-center rounded-full bg-white/[0.06] text-xs font-medium text-white">
              AR
            </div>
            <div className="overflow-hidden text-left">
              <p className="truncate text-xs font-medium text-white">Alex Rivera</p>
              <p className="truncate text-[11px] text-muted-foreground">Acme Global</p>
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}
