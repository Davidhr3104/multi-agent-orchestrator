"use client";

import type { FormEvent, ReactNode } from "react";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { money } from "@/lib/format";

type Nav =
  | "engine"
  | "waste"
  | "unmatched"
  | "review"
  | "help"
  | "settings"
  | "attribution"
  | "scoring"
  | "automations"
  | "audit";

type NavItem = {
  id: Nav;
  href: string;
  label: string;
  icon: string;
  badge?: ReactNode;
};

type ConnectorStatus = "active" | "connected" | "offline";

type Connector = {
  id: "meta" | "google" | "tiktok";
  label: string;
  href: string;
  status: ConnectorStatus;
};

function Icon({ name, className }: { name: string; className?: string }) {
  return (
    <span className={cn("material-symbols-outlined text-[18px]", className)} aria-hidden>
      {name}
    </span>
  );
}

function MetaMark({ className }: { className?: string }) {
  /* Official Meta infinity asset (user-provided), tinted brand blue */
  // eslint-disable-next-line @next/next/no-img-element
  return (
    <img
      src="/meta-mark.png"
      alt=""
      className={cn("h-[14px] w-[20px] shrink-0 object-contain", className)}
    />
  );
}

/** Classic Google “G” — solid Marketing orange */
function GoogleAdsMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={cn("size-[16px] shrink-0", className)} aria-hidden>
      <path
        fill="#f97316"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09zM12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23zM5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62zM12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  );
}

function TikTokMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={cn("size-[16px] shrink-0", className)} aria-hidden>
      <path
        fill="#e3e1e9"
        d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z"
      />
    </svg>
  );
}

function crumbFor(active: Nav) {
  switch (active) {
    case "engine":
      return { section: "Helix", page: "Telemetry & Performance" };
    case "waste":
      return { section: "Overview", page: "$ on Spam & Ad Waste" };
    case "unmatched":
      return { section: "Overview", page: "Join Queue & UTM Mapper" };
    case "review":
      return { section: "Overview", page: "HITL Review" };
    case "help":
      return { section: "System", page: "How to Use" };
    case "settings":
      return { section: "System", page: "Settings & API Keys" };
    case "attribution":
      return { section: "Configuration", page: "Attribution Models" };
    case "automations":
      return { section: "Configuration", page: "Automations & Write Rules" };
    default:
      return { section: "Helix", page: "Marketing" };
  }
}

function statusLabel(s: ConnectorStatus) {
  if (s === "active") return "Live";
  if (s === "connected") return "Keys saved";
  return "Offline";
}

function statusDot(s: ConnectorStatus) {
  if (s === "active") return "bg-success-emerald";
  if (s === "connected") return "bg-tertiary";
  return "bg-outline";
}

export function EngineShell({
  active,
  children,
}: {
  active: Nav;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [wasteBadge, setWasteBadge] = useState<string | null>(null);
  const [reviewPending, setReviewPending] = useState(0);
  const [activeSyncs, setActiveSyncs] = useState(0);
  const [connectors, setConnectors] = useState<Connector[]>([
    { id: "meta", label: "Meta Ads", href: "/settings", status: "offline" },
    { id: "google", label: "Google Ads", href: "/settings", status: "offline" },
    { id: "tiktok", label: "TikTok Ads", href: "/settings", status: "offline" },
  ]);
  const [search, setSearch] = useState("");
  const [headerBusy, setHeaderBusy] = useState(false);
  const [headerToast, setHeaderToast] = useState<string | null>(null);
  const crumbs = crumbFor(active);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  useEffect(() => {
    let cancelled = false;
    void Promise.all([
      fetch("/api/status").then((r) => r.json()),
      fetch("/api/campaigns?window=30d").then((r) => r.json()),
    ])
      .then(([status, desk]) => {
        if (cancelled) return;
        // "Live" only after a real read succeeded; keys alone show as "Keys saved".
        const meta = Boolean(status.meta);
        const metaVerified = Boolean(status.metaVerified);
        const google = Boolean(status.google);
        const tiktok = Boolean(status.tiktok);
        setConnectors([
          { id: "meta", label: "Meta Ads", href: "/settings", status: metaVerified ? "active" : meta ? "connected" : "offline" },
          {
            id: "google",
            label: "Google Ads",
            href: "/settings",
            status: google ? "active" : "offline",
          },
          {
            id: "tiktok",
            label: "TikTok Ads",
            href: "/settings",
            status: tiktok ? "active" : "offline",
          },
        ]);
        setActiveSyncs([metaVerified, google, tiktok].filter(Boolean).length);

        const waste = desk.waste as { spendOnSpam?: number } | undefined;
        if (waste?.spendOnSpam && waste.spendOnSpam > 0) {
          setWasteBadge(`-${money(waste.spendOnSpam)}`);
        }
        const campaigns = (desk.campaigns ?? []) as { needsReview?: boolean }[];
        setReviewPending(campaigns.filter((c) => c.needsReview).length);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  async function runDeskSync() {
    setHeaderBusy(true);
    setHeaderToast(null);
    try {
      const res = await fetch("/api/ads/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ window: "30d" }),
      });
      const data = (await res.json()) as { error?: string; imported?: number; message?: string };
      if (!res.ok) throw new Error(data.error || "Sync failed");
      setHeaderToast(
        data.imported != null
          ? `Synced ${data.imported} Meta insight rows`
          : data.message || "Sync complete"
      );
      window.setTimeout(() => window.location.reload(), 900);
    } catch (err) {
      setHeaderToast(err instanceof Error ? err.message : "Sync failed");
    } finally {
      setHeaderBusy(false);
    }
  }

  function onSearchSubmit(e: FormEvent) {
    e.preventDefault();
    const q = search.trim().toLowerCase();
    if (!q) {
      window.location.href = "/";
      return;
    }
    void fetch("/api/campaigns?window=90d")
      .then((r) => r.json())
      .then((d: { campaigns?: { campaignId: string; name: string }[]; unmatched?: { campaignId: string; name?: string }[] }) => {
        const hit = (d.campaigns ?? []).find(
          (c) =>
            c.campaignId.toLowerCase().includes(q) || c.name.toLowerCase().includes(q)
        );
        if (hit) {
          window.location.href = `/campaigns/${encodeURIComponent(hit.campaignId)}`;
          return;
        }
        const orphan = (d.unmatched ?? []).find(
          (u) =>
            u.campaignId.toLowerCase().includes(q) ||
            (u.name ?? "").toLowerCase().includes(q)
        );
        if (orphan) {
          window.location.href = "/unmatched";
          return;
        }
        setHeaderToast(`No campaign matching “${search.trim()}”`);
        window.setTimeout(() => setHeaderToast(null), 2800);
      })
      .catch(() => {
        setHeaderToast("Search failed");
        window.setTimeout(() => setHeaderToast(null), 2800);
      });
  }

  const overview: NavItem[] = [
    { id: "engine", href: "/", label: "Performance Engine", icon: "speed" },
    {
      id: "waste",
      href: "/waste",
      label: "$ on Spam & Ad Waste",
      icon: "shield_with_heart",
      badge: wasteBadge ? (
        <span className="rounded-full bg-alert-rose/15 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-alert-rose">
          {wasteBadge}
        </span>
      ) : undefined,
    },
    { id: "unmatched", href: "/unmatched", label: "Join Queue & UTM Mapper", icon: "alt_route" },
    {
      id: "review",
      href: "/review",
      label: "HITL Review",
      icon: "fact_check",
      badge:
        reviewPending > 0 ? (
          <span className="rounded-full bg-marketing-amber/15 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-marketing-amber">
            {reviewPending} pending
          </span>
        ) : undefined,
    },
  ];

  const configuration: NavItem[] = [
    { id: "attribution", href: "/attribution", label: "Attribution Models", icon: "network_node" },
    { id: "automations", href: "/automations", label: "Automations & Rules", icon: "bolt" },
  ];

  const system: NavItem[] = [
    { id: "settings", href: "/settings", label: "Settings & API Keys", icon: "key" },
    { id: "help", href: "/help", label: "How to Use", icon: "menu_book" },
  ];

  function NavGroup({ title, items }: { title: string; items: NavItem[] }) {
    return (
      <div className="space-y-1">
        <div className="px-2 font-mono text-[10px] font-medium tracking-wider text-outline uppercase">
          {title}
        </div>
        <nav className="space-y-0.5">
          {items.map((item) => {
            const on = active === item.id;
            return (
              <a
                key={item.id}
                href={item.href}
                className={cn(
                  "flex items-center justify-between rounded-lg px-2 py-1.5 transition-colors",
                  on
                    ? "rounded-lg bg-primary-container font-semibold text-on-primary-container shadow-[0_0_12px_rgba(249,115,22,0.25)]"
                    : "rounded-lg text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface"
                )}
              >
                <div className="flex min-w-0 items-center gap-2">
                  <Icon name={item.icon} />
                  <span className="truncate text-[13px]">{item.label}</span>
                </div>
                {item.badge}
              </a>
            );
          })}
        </nav>
      </div>
    );
  }

  function ConnectorMark({ id }: { id: Connector["id"] }) {
    if (id === "meta") return <MetaMark />;
    if (id === "google") return <GoogleAdsMark />;
    return <TikTokMark />;
  }

  const liveConnectors = connectors.filter((c) => c.status === "active");
  const headerLive =
    liveConnectors.length === 0
      ? "No platforms live"
      : liveConnectors.map((c) => c.label.replace(" Ads", "")).join(" & ") + " Live";

  const sidebar = (
    <aside
      className={cn(
        "fixed inset-y-0 left-0 z-50 flex w-72 flex-col overflow-y-auto bg-surface-container-low transition-transform duration-300",
        mobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
      )}
    >
      {/* Logo — no chip / no white outline */}
      <div className="flex items-center justify-between px-5 py-5">
        <div className="flex items-center gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/helix-for-marketing.png"
            alt=""
            className="h-8 w-8 shrink-0 object-contain"
          />
          <div className="flex items-center gap-1.5">
            <span className="text-[16px] font-semibold tracking-tight text-on-surface">Helix</span>
            <span className="rounded-full bg-primary-container/15 px-1.5 py-0.5 font-mono text-[10px] font-semibold tracking-wider text-marketing-amber uppercase">
              Marketing
            </span>
          </div>
        </div>
        <span className="font-mono text-[10px] text-outline">v2.4</span>
      </div>

      <div className="px-5 pb-3">
        <div className="flex items-center justify-between rounded-lg bg-surface-container p-2">
          <div className="min-w-0">
            <span className="block truncate text-[11px] font-medium text-on-surface">
              Production Workspace
            </span>
            <span className="mt-0.5 flex items-center gap-1.5 font-mono text-[10px] text-success-emerald">
              <span className="size-1.5 rounded-full bg-success-emerald" />
              {activeSyncs} active sync{activeSyncs === 1 ? "" : "s"}
            </span>
          </div>
          <Icon name="unfold_more" className="text-on-surface-variant" />
        </div>
      </div>

      <div className="flex-1 space-y-5 px-3 py-1">
        <NavGroup title="Overview" items={overview} />

        <div className="space-y-1">
          <div className="px-2 font-mono text-[10px] font-medium tracking-wider text-outline uppercase">
            Connectors & Platforms
          </div>
          <nav className="space-y-0.5">
            {connectors.map((c) => (
              <a
                key={c.id}
                href={c.href}
                className="flex items-center justify-between rounded-lg px-2 py-1.5 text-on-surface-variant transition-colors hover:bg-surface-container-high hover:text-on-surface"
              >
                <div className="flex min-w-0 items-center gap-2">
                  <ConnectorMark id={c.id} />
                  <span className="truncate text-[13px]">{c.label}</span>
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  <span className={cn("size-1.5 rounded-full", statusDot(c.status))} />
                  <span className="font-mono text-[10px] text-on-surface-variant">
                    {statusLabel(c.status)}
                  </span>
                </div>
              </a>
            ))}
          </nav>
        </div>

        <NavGroup title="Configuration" items={configuration} />
        <NavGroup title="System" items={system} />
      </div>

      <div className="m-2 flex items-center justify-between rounded-lg bg-surface-container-lowest p-3">
        <div className="flex min-w-0 items-center gap-2">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-surface-container-high">
            <Icon name="person" className="text-primary" />
          </div>
          <div className="min-w-0">
            <div className="truncate text-[13px] font-medium text-on-surface">Operator</div>
            <div className="truncate text-[11px] text-outline">
              {activeSyncs > 0 ? `${activeSyncs} connector${activeSyncs === 1 ? "" : "s"}` : "CSV desk"}
            </div>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1 font-mono text-[10px] text-success-emerald">
          <span className="size-1.5 rounded-full bg-success-emerald" />
          ready
        </div>
      </div>
    </aside>
  );

  return (
    <div className="relative min-h-screen bg-background text-on-surface">
      {mobileOpen ? (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          aria-label="Close overlay"
          onClick={() => setMobileOpen(false)}
        />
      ) : null}
      {sidebar}

      <div className="pl-0 md:pl-72">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-4 bg-surface-container-low/80 px-4 backdrop-blur-xl sm:px-6">
          <div className="flex min-w-0 items-center gap-2">
            <button
              type="button"
              className="rounded-lg p-2 text-on-surface-variant hover:bg-surface-container-high md:hidden"
              onClick={() => setMobileOpen(true)}
              aria-label="Open menu"
            >
              <Icon name="menu" className="text-[20px]" />
            </button>
            <span className="hidden text-[13px] text-outline sm:inline">{crumbs.section}</span>
            <Icon name="chevron_right" className="hidden text-[16px] text-outline sm:inline" />
            <span className="truncate text-[13px] font-medium text-on-surface">{crumbs.page}</span>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <form onSubmit={onSearchSubmit} className="relative hidden items-center lg:flex">
              <Icon name="search" className="pointer-events-none absolute left-2.5 text-[18px] text-outline" />
              <input
                className="h-9 w-64 rounded-lg bg-surface-container pr-12 pl-9 text-[13px] text-on-surface placeholder:text-outline focus:ring-1 focus:ring-primary-container focus:outline-none"
                placeholder="Search campaigns / orphans…"
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <span className="absolute right-2 rounded bg-surface-container-high px-1.5 py-0.5 font-mono text-[10px] text-outline">
                ↵
              </span>
            </form>

            <div className="hidden items-center gap-2 rounded-full bg-surface-container px-2.5 py-1 sm:flex">
              <span
                className={cn(
                  "size-2 rounded-full",
                  liveConnectors.length ? "bg-success-emerald" : "bg-outline"
                )}
              />
              <span className="font-mono text-[10px] text-on-surface">{headerLive}</span>
            </div>

            <button
              type="button"
              disabled={headerBusy}
              onClick={() => void runDeskSync()}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-primary-container px-3 text-[13px] font-medium text-on-primary transition-colors hover:bg-marketing-amber disabled:opacity-60"
            >
              <Icon name="sync" />
              <span className="hidden sm:inline">{headerBusy ? "Syncing…" : "Sync Meta Insights"}</span>
              <span className="sm:hidden">Sync</span>
            </button>

            <a
              href="/settings"
              className="hidden size-9 items-center justify-center rounded-lg bg-surface-container text-on-surface-variant transition-colors hover:bg-surface-container-high hover:text-on-surface sm:inline-flex"
              aria-label="Desk settings"
            >
              <Icon name="tune" className="text-[20px]" />
            </a>
          </div>
        </header>

        {headerToast ? (
          <div className="mx-4 mt-2 rounded-lg border border-[var(--border-hairline)] bg-surface-container-high px-3 py-2 text-xs text-on-surface sm:mx-6">
            {headerToast}
          </div>
        ) : null}

        <main className="min-h-[calc(100vh-4rem)] bg-background px-4 py-5 sm:px-6">{children}</main>
      </div>
    </div>
  );
}
