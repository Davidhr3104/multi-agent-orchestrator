"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, HelpCircle, Menu, RefreshCw, Search } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";

const LABELS: Record<string, string> = {
  "/": "Dashboard",
  "/orders": "Orders",
  "/risk": "$ at risk",
  "/returns": "Returns / RMA",
  "/products": "Products",
  "/inventory": "Inventory",
  "/customers": "Customers",
  "/analytics": "Analytics",
  "/settings": "Settings",
  "/help": "How to use",
};

export function AppHeader({ onOpenMenu }: { onOpenMenu?: () => void }) {
  const pathname = usePathname();
  const label = LABELS[pathname] ?? "Dashboard";
  const [syncing, setSyncing] = useState(false);
  const [syncNote, setSyncNote] = useState<string | null>(null);

  async function syncShopify() {
    setSyncing(true);
    setSyncNote(null);
    try {
      const res = await fetch("/api/shopify/sync", { method: "POST" });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setSyncNote(data.error || `Sync failed (${res.status})`);
        return;
      }
    } catch {
      setSyncNote("Sync failed: the server did not answer.");
      return;
    } finally {
      setSyncing(false);
    }
    window.location.reload();
  }

  return (
    <header className="z-20 flex h-16 shrink-0 items-center justify-between gap-2 border-b border-border bg-background/90 px-3 shadow-[0_4px_20px_rgba(0,0,0,0.5)] backdrop-blur-md sm:px-6">
      <div className="flex min-w-0 items-center gap-2 text-xs font-medium text-muted-foreground">
        <button
          type="button"
          onClick={onOpenMenu}
          aria-label="Open navigation menu"
          className="flex size-10 shrink-0 items-center justify-center rounded-lg text-foreground transition hover:bg-black/[0.04] active:scale-95 md:hidden dark:hover:bg-white/[0.08]"
        >
          <Menu className="size-5" />
        </button>
        <span className="hidden cursor-pointer transition hover:text-foreground sm:inline">Workspaces</span>
        <span className="hidden text-muted-foreground/50 sm:inline">/</span>
        <span className="hidden text-secondary-foreground sm:inline">Acme Apparel</span>
        <span className="hidden text-muted-foreground/50 sm:inline">/</span>
        <span className="flex items-center gap-1.5 truncate font-semibold text-primary">
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
          <kbd className="rounded border border-border bg-black/[0.04] px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground dark:bg-white/[0.06]">
            Ctrl K
          </kbd>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-1 sm:gap-3">
        {syncNote ? (
          <span role="alert" title={syncNote} className="max-w-32 truncate text-[11px] text-rose-600 sm:max-w-56 dark:text-rose-300">
            {syncNote}
          </span>
        ) : null}
        <button
          type="button"
          disabled={syncing}
          onClick={() => void syncShopify()}
          aria-label="Sync Shopify"
          className="flex min-h-10 items-center gap-2 rounded-lg border border-primary/30 bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary shadow-sm transition hover:bg-primary/20 active:scale-[0.98] disabled:opacity-50"
        >
          <RefreshCw className={`size-3.5 text-primary ${syncing ? "animate-spin" : ""}`} />
          <span className="hidden sm:inline">{syncing ? "Syncing…" : "Sync Shopify"}</span>
        </button>
        <button
          className="relative flex size-10 items-center justify-center rounded-lg text-foreground transition hover:bg-black/[0.04] active:scale-95 dark:hover:bg-white/[0.08]"
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
          className="hidden size-10 items-center justify-center rounded-lg text-muted-foreground transition hover:bg-black/[0.04] hover:text-foreground active:scale-95 sm:flex dark:hover:bg-white/[0.06]"
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
