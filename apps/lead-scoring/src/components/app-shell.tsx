"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { StoredLead } from "@helix/core";
import { CommandPalette, ShortcutsHelp } from "@/components/command-palette";
import { listWorkspaces, readCurrentWorkspace, writeCurrentWorkspace } from "@/lib/workspace";
import { cn } from "@/lib/utils";

type NavItem = {
  href: string;
  label: string;
  icon: string;
  badge?: number;
  badgeTone?: "primary" | "error";
};

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  if (href === "/settings") return pathname === "/settings" || pathname.startsWith("/settings/brand");
  return pathname === href || pathname.startsWith(`${href}/`);
}

function Icon({ name, className, fill }: { name: string; className?: string; fill?: boolean }) {
  return (
    <span className={cn("material-symbols-outlined text-[20px]", fill && "fill", className)} aria-hidden>
      {name}
    </span>
  );
}

function breadcrumbFor(pathname: string) {
  if (pathname === "/") return { section: "Overview", page: "Dashboard" };
  if (pathname.startsWith("/leads")) return { section: "Overview", page: "Lead Roster" };
  if (pathname.startsWith("/inbox")) return { section: "Overview", page: "Triage Inbox" };
  if (pathname.startsWith("/analytics")) return { section: "Overview", page: "Analytics" };
  if (pathname.startsWith("/settings/scoring")) return { section: "Configuration", page: "Scoring Rules" };
  if (pathname.startsWith("/settings/prompts")) return { section: "Configuration", page: "Prompts" };
  if (pathname.startsWith("/settings/integrations")) return { section: "Configuration", page: "Integrations" };
  if (pathname.startsWith("/settings/automations")) return { section: "Configuration", page: "Automations" };
  if (pathname.startsWith("/settings/usage")) return { section: "System", page: "API & Webhooks" };
  if (pathname.startsWith("/audit")) return { section: "System", page: "Audit Log" };
  if (pathname === "/settings" || pathname.startsWith("/settings/brand"))
    return { section: "System", page: "Desk Settings" };
  if (pathname.startsWith("/settings")) return { section: "Configuration", page: "Settings" };
  return { section: "Helix", page: "Leads" };
}

const PRODUCTS = [
  { name: "Helix for Commerce", href: "https://helix-for-commerce.vercel.app", className: "text-emerald-300" },
  { name: "Helix for Legal", href: "https://helix-for-legal.vercel.app", className: "text-violet-300" },
  { name: "Helix for Marketing", href: "https://helix-for-marketing.vercel.app", className: "text-fuchsia-300" },
  { name: "Helix for Leads", href: "/", className: "text-primary" },
];

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [productsOpen, setProductsOpen] = useState(false);
  const [ingestBusy, setIngestBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [ghlConnected, setGhlConnected] = useState(false);
  const [hotCount, setHotCount] = useState(0);
  const [reviewCount, setReviewCount] = useState(0);
  const [slaPct, setSlaPct] = useState<number | null>(null);
  const [workspaceId, setWorkspaceId] = useState("default");
  const [brandName, setBrandName] = useState("Helix for Leads");
  const searchRef = useRef<HTMLInputElement>(null);
  const workspaces = useMemo(() => listWorkspaces(), []);
  const crumbs = breadcrumbFor(pathname);

  useEffect(() => {
    setWorkspaceId(readCurrentWorkspace());
    try {
      const raw = window.localStorage.getItem("helix-leads-brand");
      if (raw) {
        const parsed = JSON.parse(raw) as { productName?: string };
        if (parsed.productName?.trim()) setBrandName(parsed.productName.trim());
      }
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    function loadBadgeState() {
      void Promise.all([
        fetch("/api/status").then((r) => r.json()).catch(() => ({})),
        fetch("/api/leads").then((r) => r.json()).catch(() => ({ leads: [] })),
      ]).then(([status, leadsRes]) => {
        setGhlConnected(Boolean((status as { ghl?: boolean }).ghl));
        const leads = ((leadsRes as { leads?: StoredLead[] }).leads ?? []) as StoredLead[];
        setHotCount(leads.filter((l) => l.tier === "hot" && l.classification === "lead").length);
        setReviewCount(leads.filter((l) => l.needsReview).length);
        if (leads.length === 0) {
          setSlaPct(null);
        } else {
          const clear = leads.filter((l) => !l.needsReview).length;
          setSlaPct(Math.round((clear / leads.length) * 1000) / 10);
        }
      });
    }
    loadBadgeState();
    window.addEventListener("helix:leads-refresh", loadBadgeState);
    return () => window.removeEventListener("helix:leads-refresh", loadBadgeState);
  }, [pathname]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const meta = e.metaKey || e.ctrlKey;
      if (meta && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen(true);
        return;
      }
      if (e.key === "?" && !(e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement)) {
        e.preventDefault();
        setHelpOpen(true);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  function showToast(msg: string) {
    setToast(msg);
    window.setTimeout(() => setToast(null), 2800);
  }

  async function ingestTestLead() {
    setIngestBusy(true);
    try {
      const stamp = Date.now().toString(36).slice(-4);
      const res = await fetch("/api/leads/ingest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: `Test Lead ${stamp}`,
          email: `test.${stamp}@example.com`,
          source: "dashboard_cta",
          message: "Looking to evaluate Helix for inbound triage this quarter. Budget flexible, timeline 2 weeks.",
          budget: "$25k",
          timeline: "2 weeks",
          company: "Acme Ops",
        }),
      });
      if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let leadId: string | null = null;
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const chunks = buffer.split("\n\n");
        buffer = chunks.pop() ?? "";
        for (const chunk of chunks) {
          const line = chunk
            .split("\n")
            .filter((l) => l.startsWith("data:"))
            .map((l) => l.slice(5).trim())
            .join("");
          if (!line) continue;
          const event = JSON.parse(line) as { type: string; lead?: StoredLead; message?: string };
          if (event.type === "result" && event.lead) leadId = event.lead.id;
          if (event.type === "error") throw new Error(event.message ?? "Ingest failed");
        }
      }
      showToast(leadId ? "Test lead ingested" : "Ingest finished");
      window.dispatchEvent(new CustomEvent("helix:leads-refresh"));
      if (leadId) router.push(`/leads?focus=${leadId}`);
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Ingest failed");
    } finally {
      setIngestBusy(false);
    }
  }

  const overview: NavItem[] = [
    { href: "/", label: "Dashboard", icon: "grid_view" },
    { href: "/leads", label: "Leads", icon: "group", badge: hotCount > 0 ? hotCount : undefined, badgeTone: "primary" },
    { href: "/inbox", label: "Triage Inbox", icon: "move_to_inbox", badge: reviewCount > 0 ? reviewCount : undefined, badgeTone: "error" },
    { href: "/analytics", label: "Analytics & Telemetry", icon: "insights" },
  ];

  const configuration: NavItem[] = [
    { href: "/settings/scoring", label: "Scoring Rules", icon: "tune" },
    { href: "/settings/prompts", label: "Prompt Studio", icon: "terminal" },
    { href: "/settings/integrations", label: "Integrations & Sync", icon: "hub" },
    { href: "/settings/automations", label: "Automations & Workflows", icon: "alt_route" },
  ];

  const system: NavItem[] = [
    { href: "/settings", label: "Desk Settings", icon: "settings" },
    { href: "/audit", label: "Audit Log & Security", icon: "security" },
    { href: "/settings/usage", label: "API & Webhooks", icon: "webhook" },
  ];

  function NavGroup({ title, items }: { title: string; items: NavItem[] }) {
    return (
      <div className="mb-6">
        <p className="mb-2 px-4 text-[10px] font-bold tracking-[0.2em] text-outline uppercase">{title}</p>
        <div className="space-y-1">
          {items.map((item) => {
            const active = isActive(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors",
                  active
                    ? "bg-primary-container text-on-primary-container"
                    : "text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface"
                )}
              >
                <Icon name={item.icon} fill={active} className={active ? "text-on-primary-container" : ""} />
                <span className="flex-1 truncate">{item.label}</span>
                {item.badge != null && item.badge > 0 ? (
                  <span
                    className={cn(
                      "rounded-full px-2 py-0.5 text-[10px] font-bold",
                      item.badgeTone === "error"
                        ? "bg-error-container text-error"
                        : "bg-surface-container-highest text-primary"
                    )}
                  >
                    {item.badge} {item.badgeTone === "error" ? "pending" : "new"}
                  </span>
                ) : null}
              </Link>
            );
          })}
        </div>
      </div>
    );
  }

  const sidebar = (
    <aside
      className={cn(
        "fixed inset-y-0 left-0 z-40 flex w-72 flex-col border-r border-outline-variant/20 bg-surface-container-low transition-transform duration-300",
        mobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
      )}
    >
      <div className="flex h-16 items-center gap-3 border-b border-outline-variant/20 px-5">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/helix-leads-icon.png?v=legal1"
          alt=""
          className="h-10 w-10 shrink-0 object-contain object-center drop-shadow-[0_0_12px_rgba(6,182,212,0.35)]"
        />
        <div className="min-w-0 flex-1" aria-label={brandName}>
          <div className="flex items-center gap-1.5 leading-none">
            <span className="text-[14px] font-semibold tracking-tight text-on-surface">HELIX</span>
            <span className="text-[9px] font-medium tracking-widest text-primary uppercase">FOR LEADS</span>
          </div>
          <p className="mt-1 truncate text-[10px] leading-none text-outline">Intelligent Engine</p>
        </div>
        <button
          type="button"
          className="rounded-md p-1 text-outline hover:bg-surface-container-high md:hidden"
          onClick={() => setMobileOpen(false)}
          aria-label="Close menu"
        >
          <Icon name="close" />
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4">
        <NavGroup title="Overview" items={overview} />
        <NavGroup title="Configuration" items={configuration} />
        <NavGroup title="System" items={system} />
      </nav>

      <div className="border-t border-outline-variant/20 p-4">
        <div className="mb-3 rounded-xl bg-surface-container-lowest p-3">
          <div className="flex items-center justify-between text-[10px] font-bold tracking-wider text-outline uppercase">
            <span>Clear of HITL</span>
            <span className="text-tertiary">{slaPct == null ? "—" : `${slaPct}%`}</span>
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-container-high">
            <div
              className="h-full rounded-full bg-tertiary transition-all"
              style={{ width: `${slaPct == null ? 0 : Math.min(100, slaPct)}%` }}
            />
          </div>
        </div>

        <button
          type="button"
          className="mb-3 flex w-full items-center gap-2 rounded-lg px-2 py-2 text-sm text-on-surface-variant hover:bg-surface-container-high"
          onClick={() => setProductsOpen((v) => !v)}
        >
          <Icon name="swap_horiz" className="text-[18px]" />
          <span className="flex-1 text-left text-xs font-medium">Switch Product</span>
          <Icon name={productsOpen ? "expand_less" : "expand_more"} className="text-[18px]" />
        </button>
        {productsOpen ? (
          <div className="mb-3 space-y-1 rounded-xl border border-outline-variant/30 bg-surface-container p-2">
            {PRODUCTS.map((p) => (
              <a
                key={p.name}
                href={p.href}
                className={cn("block rounded-lg px-3 py-2 text-xs font-medium hover:bg-surface-container-high", p.className)}
              >
                {p.name}
              </a>
            ))}
          </div>
        ) : null}

        <a
          href="/settings"
          className="flex items-center gap-3 rounded-xl bg-surface-container px-3 py-2.5 transition-colors hover:bg-surface-container-high"
        >
          <div className="flex size-9 items-center justify-center rounded-full bg-primary-container text-xs font-bold text-on-primary-container">
            AV
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-on-surface">Alex Vance</p>
            <p className="truncate text-[11px] text-outline">Ops · Desk settings</p>
          </div>
        </a>
      </div>
    </aside>
  );

  return (
    <div className="min-h-full bg-surface text-on-surface">
      {mobileOpen ? (
        <button
          type="button"
          className="fixed inset-0 z-30 bg-black/60 md:hidden"
          aria-label="Close sidebar"
          onClick={() => setMobileOpen(false)}
        />
      ) : null}
      {sidebar}

      <div className="flex min-h-full flex-col md:ml-72">
        <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-outline-variant/20 bg-surface/90 px-4 backdrop-blur-md sm:px-6">
          <button
            type="button"
            className="rounded-md p-1.5 text-on-surface-variant hover:bg-surface-container-high md:hidden"
            onClick={() => setMobileOpen(true)}
            aria-label="Open menu"
          >
            <Icon name="menu" />
          </button>

          <div className="hidden min-w-0 items-center gap-2 text-sm sm:flex">
            <span className="text-outline">{crumbs.section}</span>
            <Icon name="chevron_right" className="text-[16px] text-outline" />
            <span className="font-semibold text-on-surface">{crumbs.page}</span>
          </div>

          <div className="relative ml-auto min-w-0 max-w-md flex-1">
            <Icon name="search" className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-[18px] text-outline" />
            <input
              ref={searchRef}
              className="h-9 w-full rounded-lg border border-outline-variant/40 bg-surface-container-lowest pr-14 pl-10 text-sm text-on-surface placeholder:text-outline outline-none focus:border-primary"
              placeholder="Search leads, logs, settings…"
              onFocus={() => setPaletteOpen(true)}
              readOnly
            />
            <kbd className="pointer-events-none absolute top-1/2 right-2 -translate-y-1/2 rounded border border-outline-variant/40 px-1.5 py-0.5 font-mono text-[10px] text-outline">
              ⌘K
            </kbd>
          </div>

          <select
            className="hidden h-9 max-w-[9rem] rounded-lg border border-outline-variant/40 bg-surface-container-lowest px-2 text-xs text-on-surface-variant lg:block"
            value={workspaceId}
            onChange={(e) => {
              setWorkspaceId(e.target.value);
              writeCurrentWorkspace(e.target.value);
            }}
            aria-label="Workspace"
          >
            {workspaces.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name}
              </option>
            ))}
          </select>

          <div
            className={cn(
              "hidden items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold sm:flex",
              ghlConnected
                ? "border-tertiary/40 bg-tertiary-container/40 text-tertiary"
                : "border-outline-variant/40 bg-surface-container text-outline"
            )}
            title={ghlConnected ? "GoHighLevel connected" : "CRM not configured"}
          >
            <span className={cn("size-1.5 rounded-full", ghlConnected ? "bg-tertiary" : "bg-outline")} />
            {ghlConnected ? "GHL Connected" : "CRM Offline"}
          </div>

          <OrgSessionBadge />

          <button
            type="button"
            disabled={ingestBusy}
            onClick={() => void ingestTestLead()}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-primary-container px-3 text-xs font-bold text-on-primary-container transition hover:brightness-110 disabled:opacity-60"
          >
            <Icon name="add" className="text-[18px]" />
            <span className="hidden sm:inline">{ingestBusy ? "Ingesting…" : "Ingest Test Lead"}</span>
          </button>
        </header>

        <div className="flex-1">{children}</div>
      </div>

      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
      <ShortcutsHelp open={helpOpen} onClose={() => setHelpOpen(false)} />

      {toast ? (
        <div className="fixed right-4 bottom-4 z-50 rounded-lg border border-outline-variant/40 bg-surface-container-high px-4 py-2 text-sm text-on-surface shadow-lg">
          {toast}
        </div>
      ) : null}
    </div>
  );
}

function OrgSessionBadge() {
  const [state, setState] = useState<{
    configured: boolean;
    signedIn: boolean;
    user?: { email: string | null };
    org?: { orgName: string } | null;
  } | null>(null);

  useEffect(() => {
    fetch("/api/org")
      .then((r) => r.json())
      .then(setState)
      .catch(() => setState({ configured: false, signedIn: false }));
  }, []);

  if (!state || !state.configured) return null;
  if (!state.signedIn) {
    return (
      <Link
        href="/login"
        className="hidden shrink-0 rounded-lg border border-outline-variant/40 bg-surface-container-lowest px-2.5 py-1.5 text-xs text-on-surface-variant hover:bg-surface-container-high sm:block"
      >
        Sign in
      </Link>
    );
  }
  return (
    <span
      className="hidden max-w-[8rem] shrink-0 truncate rounded-lg border border-tertiary/30 bg-tertiary-container/30 px-2.5 py-1.5 text-xs text-tertiary sm:block"
      title={state.user?.email ?? undefined}
    >
      {state.org?.orgName ?? "No workspace"}
    </span>
  );
}
