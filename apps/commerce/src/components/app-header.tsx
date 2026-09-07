"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, HelpCircle, RefreshCw, Search } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";

const LABELS: Record<string, string> = {
  "/": "Dashboard",
  "/orders": "Orders",
  "/products": "Products",
  "/inventory": "Inventory",
  "/customers": "Customers",
  "/analytics": "Analytics",
  "/settings": "Settings",
  "/help": "How to use",
};

export function AppHeader() {
  const pathname = usePathname();
  const label = LABELS[pathname] ?? "Dashboard";

  return (
    <header className="z-20 flex h-16 shrink-0 items-center justify-between border-b border-border bg-background/90 px-6 shadow-[0_4px_20px_rgba(0,0,0,0.5)] backdrop-blur-md">
      <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
        <span className="cursor-pointer transition hover:text-foreground">Workspaces</span>
        <span className="text-muted-foreground/50">/</span>
        <span className="text-secondary-foreground">Acme Apparel</span>
        <span className="text-muted-foreground/50">/</span>
        <span className="flex items-center gap-1.5 font-semibold text-primary">
          <span className="size-1.5 rounded-full bg-primary" />
          {label}
        </span>
      </div>

      <div className="relative hidden w-96 max-w-md md:block">
        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5">
          <Search className="size-4 text-muted-foreground" />
        </div>
        <input
          type="text"
          placeholder="Find something… or search orders, SKU"
          className="w-full rounded-full border border-border bg-black/[0.02] py-1.5 pr-12 pl-9 text-xs text-foreground placeholder-muted-foreground shadow-inner transition focus:border-primary focus:bg-black/[0.04] focus:ring-1 focus:ring-primary/50 focus:outline-none dark:bg-white/[0.04] dark:focus:bg-white/[0.07]"
        />
        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3">
          <kbd className="rounded border border-border bg-black/[0.04] px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground dark:bg-white/[0.06]">
            Ctrl K
          </kbd>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button className="flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary shadow-sm transition hover:bg-primary/20 active:scale-[0.98]">
          <RefreshCw className="size-3.5 text-primary" />
          Sync Shopify
        </button>
        <button
          className="relative rounded-lg p-2 text-foreground transition hover:bg-black/[0.04] active:scale-95 dark:hover:bg-white/[0.08]"
          aria-label="Notifications"
        >
          <Bell className="size-4" />
          <span className="absolute top-1.5 right-1.5 flex size-2">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-primary opacity-75" />
            <span className="relative inline-flex size-2 rounded-full bg-primary" />
          </span>
        </button>
        <Link
          href="/help"
          className="rounded-lg p-2 text-muted-foreground transition hover:bg-black/[0.04] hover:text-foreground active:scale-95 dark:hover:bg-white/[0.06]"
          aria-label="How to use"
          title="How to use"
        >
          <HelpCircle className="size-4" />
        </Link>
        <ThemeToggle />
      </div>
    </header>
  );
}
