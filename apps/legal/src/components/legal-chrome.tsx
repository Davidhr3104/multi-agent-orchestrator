"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { KeyRound, Menu, Repeat2, X } from "lucide-react";
import { cn } from "@/lib/utils";

export type LegalNavId =
  | "dashboard"
  | "opportunities"
  | "documents"
  | "deadlines"
  | "outcomes"
  | "analytics"
  | "settings"
  | "audit"
  | "pricing"
  | "help";

export const LEGAL_HREF: Record<LegalNavId, string> = {
  dashboard: "/",
  opportunities: "/#legal-opportunities",
  documents: "/documents",
  deadlines: "/deadlines",
  outcomes: "/outcomes",
  analytics: "/analytics",
  settings: "/settings",
  audit: "/audit",
  pricing: "/pricing",
  help: "/help",
};

type ProductLink = { name: string; href: string; className: string };

const NAV_GROUPS: { label: string; items: { id: LegalNavId; label: string; icon: string }[] }[] = [
  {
    label: "Core Operations",
    items: [
      { id: "dashboard", label: "Dashboard", icon: "dash" },
      { id: "opportunities", label: "Opportunities", icon: "target" },
      { id: "documents", label: "Documents", icon: "doc" },
      { id: "deadlines", label: "Deadlines", icon: "cal" },
    ],
  },
  {
    label: "Intelligence & ROI",
    items: [
      { id: "outcomes", label: "Outcomes", icon: "trophy" },
      { id: "analytics", label: "Analytics", icon: "chart" },
    ],
  },
  {
    label: "Enterprise Controls",
    items: [
      { id: "settings", label: "Settings", icon: "gear" },
      { id: "audit", label: "Audit Log", icon: "clip" },
      { id: "pricing", label: "Pricing", icon: "coin" },
      { id: "help", label: "How to use", icon: "help" },
    ],
  },
];

const MORE_LINKS: { href: string; label: string }[] = [
  { href: "/workspaces", label: "Workspaces" },
  { href: "/intelligence", label: "Intelligence" },
  { href: "/firm-book", label: "Firm Book" },
  { href: "/notifications", label: "Notifications" },
  { href: "/profile", label: "Profile" },
];

function NavIcon({ name, className }: { name: string; className?: string }) {
  const c = cn("size-3.5 shrink-0", className);
  if (name === "dash") {
    return (
      <svg className={c} fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
        <rect height="7" width="7" x="3" y="3" />
        <rect height="7" width="7" x="14" y="3" />
        <rect height="7" width="7" x="14" y="14" />
        <rect height="7" width="7" x="3" y="14" />
      </svg>
    );
  }
  if (name === "target") {
    return (
      <svg className={c} fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
        <circle cx="12" cy="12" r="9" />
        <circle cx="12" cy="12" r="3" />
        <path d="M12 3v3m0 12v3M3 12h3m12 0h3" />
      </svg>
    );
  }
  if (name === "doc") {
    return (
      <svg className={c} fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
        <path d="M7 21h10a2 2 0 002-2V9l-6-6H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
        <path d="M13 3v6h6" />
      </svg>
    );
  }
  if (name === "cal") {
    return (
      <svg className={c} fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
        <rect height="18" width="18" x="3" y="4" />
        <line x1="16" x2="16" y1="2" y2="6" />
        <line x1="8" x2="8" y1="2" y2="6" />
        <line x1="3" x2="21" y1="10" y2="10" />
      </svg>
    );
  }
  if (name === "trophy") {
    return (
      <svg className={c} fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
        <path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 01-10 0V4z" />
        <path d="M7 6H4a2 2 0 002 4h1M17 6h3a2 2 0 01-2 4h-1" />
      </svg>
    );
  }
  if (name === "coin") {
    return (
      <svg className={c} fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v10M15 9.5a2.5 2.5 0 00-5 0c0 2.5 5 2.5 5 5a2.5 2.5 0 01-5 0" />
      </svg>
    );
  }
  if (name === "chart") {
    return (
      <svg className={c} fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
        <line x1="18" x2="18" y1="20" y2="10" />
        <line x1="12" x2="12" y1="20" y2="4" />
        <line x1="6" x2="6" y1="20" y2="14" />
      </svg>
    );
  }
  if (name === "gear") {
    return (
      <svg className={c} fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 01-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" />
      </svg>
    );
  }
  if (name === "help") {
    return (
      <svg className={c} fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
        <circle cx="12" cy="12" r="9" />
        <path d="M9.1 9a3 3 0 015.8 1c0 2-3 2-3 4" />
        <line x1="12" x2="12.01" y1="17" y2="17" />
      </svg>
    );
  }
  return (
    <svg className={c} fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" x2="8" y1="13" y2="13" />
      <line x1="16" x2="8" y1="17" y2="17" />
    </svg>
  );
}

function OperatorProductSwitch() {
  const [open, setOpen] = useState(false);
  const [operator, setOperator] = useState(false);
  const [configured, setConfigured] = useState(false);
  const [links, setLinks] = useState<ProductLink[]>([]);

  useEffect(() => {
    void fetch("/api/operator")
      .then((r) => r.json())
      .then((d: { operator?: boolean; configured?: boolean; products?: ProductLink[] }) => {
        setOperator(Boolean(d.operator));
        setConfigured(Boolean(d.configured));
        setLinks(Array.isArray(d.products) ? d.products : []);
      })
      .catch(() => setOperator(false));
  }, []);

  if (!operator) {
    if (!configured) return null;
    return (
      <Link
        href="/operator"
        className="btn-tactile flex w-full items-center gap-1.5 rounded-[4px] px-2 py-1 text-[10px] text-[#4B5563] hover:text-[#9CA3AF]"
      >
        <KeyRound className="size-3.5" />
        Operator unlock
      </Link>
    );
  }

  return (
    <div className="relative">
      <button
        type="button"
        className="btn-tactile flex w-full items-center gap-1.5 rounded-[4px] px-2 py-1 text-[10px] text-[#4B5563] hover:text-[#9CA3AF]"
        onClick={() => setOpen((v) => !v)}
      >
        <Repeat2 className="size-3.5" />
        Switch product
      </button>
      {open ? (
        <div className="absolute bottom-8 left-0 z-50 w-56 rounded-[4px] border border-[#1b2a45] bg-[#0f1b30] p-1.5 shadow-subtle">
          {links.map((p) => (
            <a key={p.name} href={p.href} className={cn("block rounded-[4px] px-2.5 py-1.5 text-xs hover:bg-[#1b2a45]", p.className)}>
              {p.name}
            </a>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function LegalChrome({
  active,
  onNav,
  collapsed,
  onToggle,
  opportunityCount,
  deadlineCount,
  reviewCount,
  onSearch,
  children,
}: {
  active: LegalNavId;
  onNav: (id: LegalNavId) => void;
  collapsed: boolean;
  onToggle: () => void;
  opportunityCount: number;
  deadlineCount: number;
  reviewCount: number;
  onSearch: () => void;
  children: ReactNode;
}) {
  const pathname = usePathname();
  // Remembers the route the menu was opened on, so any navigation closes it.
  const [mobileOpenAt, setMobileOpenAt] = useState<string | null>(null);
  const mobileOpen = mobileOpenAt === pathname;
  const setMobileOpen = (open: boolean) => setMobileOpenAt(open ? pathname : null);
  useEffect(() => {
    if (!mobileOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMobileOpenAt(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mobileOpen]);
  const routeActive: LegalNavId | null = pathname.startsWith("/analytics")
    ? "analytics"
    : pathname.startsWith("/outcomes")
      ? "outcomes"
      : pathname.startsWith("/settings")
      ? "settings"
      : pathname.startsWith("/audit")
        ? "audit"
        : pathname.startsWith("/pricing")
          ? "pricing"
          : pathname.startsWith("/documents")
            ? "documents"
            : pathname.startsWith("/deadlines")
              ? "deadlines"
              : pathname.startsWith("/help")
                ? "help"
                : pathname === "/"
                  ? null
                  : "dashboard";
  const current = routeActive ?? active;
  const width = collapsed ? "w-[72px]" : "w-[220px]";
  const offset = collapsed ? "md:ml-[72px]" : "md:ml-[220px]";

  const breadcrumbCurrent =
    pathname.startsWith("/workspaces")
      ? "Workspaces"
      : pathname.startsWith("/intelligence")
        ? "Intelligence"
        : pathname.startsWith("/documents")
          ? "Documents"
          : pathname.startsWith("/deadlines")
            ? "Deadlines"
            : pathname.startsWith("/pricing")
              ? "Pricing"
              : pathname.startsWith("/analytics")
                ? "Analytics"
                : pathname.startsWith("/outcomes")
                  ? "Outcomes"
                : pathname.startsWith("/settings")
                  ? "Settings"
                  : pathname.startsWith("/audit")
                    ? "Audit Log"
                    : pathname.startsWith("/help")
                      ? "How to use"
                      : pathname.startsWith("/notifications")
                        ? "Notifications"
                        : pathname.startsWith("/profile")
                          ? "Profile"
                          : "RFP Intelligence & Document Analysis";

  const onWorkspaces = pathname.startsWith("/workspaces");
  const onIntelligence = pathname.startsWith("/intelligence") || pathname === "/";

  return (
    <div className="flex min-h-screen bg-[#0a1322] text-xs text-[#9CA3AF]">
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 hidden flex-col justify-between border-r border-[#1b2a45] bg-[#0a1322] select-none transition-[width] md:flex",
          width
        )}
      >
        <div>
          <div className={cn("flex h-12 items-center gap-2.5 border-b border-[#1b2a45]", collapsed ? "justify-center px-2" : "px-3.5")}>
            <div className="flex size-9 shrink-0 items-center justify-center overflow-hidden transition-transform duration-150 hover:scale-105">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/helix-legal-icon.png" alt="" className="h-full w-full object-contain" />
            </div>
            {collapsed ? null : (
              <div className="min-w-0 overflow-hidden" aria-label="Helix for Legal">
                <div className="flex items-center gap-1.5 leading-none">
                  <span className="text-[14px] font-semibold text-[#F3F4F6]">HELIX</span>
                  <span className="text-[9px] font-medium tracking-widest text-[#cbd5e1] uppercase">FOR LEGAL</span>
                </div>
                <p className="mt-1 truncate text-[10px] leading-none font-normal text-[#6B7280]">Enterprise Suite</p>
              </div>
            )}
          </div>
          <nav className="space-y-3 p-2">
            {NAV_GROUPS.map((group) => (
              <div key={group.label} className="space-y-0.5">
                {collapsed ? null : (
                  <p className="px-2.5 pb-1 text-[9px] font-semibold tracking-wider text-[#4B5563] uppercase">{group.label}</p>
                )}
                {group.items.map((item) => {
                  const on = current === item.id;
                  const badge =
                    item.id === "opportunities"
                      ? opportunityCount
                      : item.id === "deadlines"
                        ? deadlineCount
                        : 0;
                  return (
                    <Link
                      key={item.id}
                      href={LEGAL_HREF[item.id]}
                      onClick={() => onNav(item.id)}
                      className={cn(
                        "flex h-9 w-full items-center justify-between rounded-[4px] px-2.5 transition-colors duration-150",
                        on
                          ? "border-l-2 border-[#e2e8f0] bg-[#1b2a45] font-semibold text-[#e2e8f0]"
                          : "text-[#9CA3AF] hover:bg-[#1b2a45] hover:text-[#F3F4F6]",
                        collapsed && "justify-center px-0"
                      )}
                    >
                      <span className="flex items-center gap-2">
                        <NavIcon name={item.icon} className={on ? "text-[#e2e8f0]" : "text-[#6B7280]"} />
                        {collapsed ? null : <span className="text-xs">{item.label}</span>}
                      </span>
                      {!collapsed && badge > 0 ? (
                        item.id === "deadlines" ? (
                          <span
                            title={`${badge} open RFP${badge === 1 ? "" : "s"} due within 14 days or past due`}
                            className="font-mono-numbers rounded-[3px] bg-[#7F1D1D] px-1.5 py-0.5 text-[10px] font-medium text-[#FCA5A5]"
                          >
                            {badge}
                          </span>
                        ) : (
                          <span className="font-mono-numbers flex size-[18px] items-center justify-center rounded-full bg-[#1b2a45] text-[10px] text-[#F3F4F6]">
                            {badge}
                          </span>
                        )
                      ) : null}
                    </Link>
                  );
                })}
              </div>
            ))}
          </nav>
        </div>
        <div className="space-y-2 border-t border-[#1b2a45] p-3">
          {collapsed ? null : (
            <>
              <div className="space-y-1 rounded-[4px] border border-[#1b2a45] bg-[#0f1b30] px-2 py-1.5 text-[10px] text-[#6B7280]">
                <div className="flex items-center gap-1.5">
                  <span className="pulse-dot-green size-1.5 shrink-0 rounded-full bg-[#10B981]" />
                  <span>TLS 1.3 in transit</span>
                </div>
                <p>Matter text is not used to train public models.</p>
                <p>SOC 2 Type II and ISO 27001 are not attested on this build.</p>
              </div>
              <OperatorProductSwitch />
            </>
          )}
          <button
            type="button"
            className="btn-tactile flex w-full items-center justify-between rounded-[4px] px-2 py-1 text-[10px] text-[#4B5563] hover:text-[#9CA3AF]"
            onClick={onToggle}
          >
            <span className="flex items-center gap-1.5">
              <svg className="size-3.5 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                <path d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
              </svg>
              {collapsed ? null : "Collapse view"}
            </span>
            {collapsed ? null : <span className="font-mono-numbers text-[#4B5563]">⌘B</span>}
          </button>
        </div>
      </aside>

      <div className={cn("flex min-w-0 flex-1 flex-col bg-[#0a1322]", offset)}>
        <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-2 border-b border-[#1b2a45] bg-[#0a1322] px-3 sm:gap-4 sm:px-5">
          <button
            type="button"
            aria-label="Open navigation menu"
            aria-expanded={mobileOpen}
            aria-controls="mobile-nav"
            onClick={() => setMobileOpen(true)}
            className="flex size-10 shrink-0 items-center justify-center rounded-[4px] border border-[#1b2a45] text-[#e2e8f0] md:hidden"
          >
            <Menu className="size-5" />
          </button>
          <nav
            aria-label="Breadcrumb"
            className="flex min-w-0 flex-1 items-center gap-2 overflow-hidden text-[12px] font-medium"
          >
            {onWorkspaces ? (
              <span className="shrink-0 font-semibold text-[#F3F4F6]" aria-current="page">
                Workspaces
              </span>
            ) : (
              <>
                <Link
                  href="/workspaces"
                  className="inline-flex min-h-10 shrink-0 items-center text-[#9CA3AF] transition-colors duration-150 hover:text-[#F3F4F6]"
                >
                  Workspaces
                </Link>
                <span className="shrink-0 text-[#374151]" aria-hidden>
                  /
                </span>
                {onIntelligence && pathname === "/intelligence" ? (
                  <span className="shrink-0 font-semibold text-[#F3F4F6]" aria-current="page">
                    Intelligence
                  </span>
                ) : (
                  <>
                    <Link
                      href="/intelligence"
                      className="inline-flex min-h-10 shrink-0 items-center text-[#9CA3AF] transition-colors duration-150 hover:text-[#F3F4F6]"
                    >
                      Intelligence
                    </Link>
                    <span className="shrink-0 text-[#374151]" aria-hidden>
                      /
                    </span>
                    <span className="truncate font-semibold text-[#F3F4F6]" aria-current="page">
                      {breadcrumbCurrent}
                    </span>
                  </>
                )}
              </>
            )}
          </nav>
          <div className="flex shrink-0 items-center gap-1.5 sm:gap-3">
            <button
              type="button"
              aria-label="Ask Helix"
              onClick={onSearch}
              className="flex size-10 items-center justify-center rounded-[4px] text-[#9CA3AF] hover:text-[#F3F4F6] lg:hidden"
            >
              <svg className="size-4" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24" aria-hidden>
                <circle cx="11" cy="11" r="8" />
                <line x1="21" x2="16.65" y1="21" y2="16.65" />
              </svg>
            </button>
            <button
              type="button"
              onClick={onSearch}
              className="group relative hidden h-8 w-[260px] rounded-[4px] border border-[#1b2a45] bg-[#0f1b30] pr-10 pl-8 text-left text-xs text-[#6B7280] transition-colors duration-150 hover:border-[#e2e8f0] hover:text-[#F3F4F6] lg:block"
            >
              <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-2.5 text-[#6B7280] transition-colors group-hover:text-[#e2e8f0]">
                <svg className="size-3.5" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                  <circle cx="11" cy="11" r="8" />
                  <line x1="21" x2="16.65" y1="21" y2="16.65" />
                </svg>
              </span>
              Ask Helix…
              <kbd className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2">
                <span className="font-mono-numbers rounded-[3px] bg-[#1b2a45] px-1 py-0.5 text-[10px] text-[#9CA3AF]">⌘K</span>
              </kbd>
            </button>
            <div className="hidden items-center gap-1.5 rounded-[4px] border border-[#10B981]/30 bg-transparent px-2 py-0.5 text-[10px] font-medium text-[#10B981] md:flex">
              <span className="pulse-dot-green size-[5px] rounded-full bg-[#10B981]" />
              Engine Active
            </div>
            <div className="hidden items-center gap-1.5 rounded-[4px] border border-[#e2e8f0] bg-transparent px-2 py-0.5 text-[10px] font-medium text-[#e2e8f0] sm:flex">
              <span className="size-[5px] rounded-full bg-[#e2e8f0]" />
              Enterprise
            </div>
            <Link
              href="/notifications"
              aria-label="Notifications"
              className={cn(
                "btn-tactile relative flex size-10 items-center justify-center rounded-[4px] text-[#6B7280] hover:text-[#F3F4F6] sm:size-9",
                pathname.startsWith("/notifications") && "text-[#e2e8f0]"
              )}
            >
              <svg className="size-4" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                <path d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
              {reviewCount > 0 ? (
                <span className="font-mono-numbers absolute -top-0.5 -right-0.5 flex size-4 items-center justify-center rounded-full bg-[#DC2626] text-[9px] text-white">
                  {reviewCount > 9 ? "9+" : reviewCount}
                </span>
              ) : null}
            </Link>
            <Link
              href="/profile"
              aria-label="Profile"
              className="flex size-10 cursor-pointer items-center justify-center rounded-full sm:size-8 bg-[#374151] text-[11px] font-semibold text-[#F3F4F6] transition-colors duration-150 hover:bg-[#4B5563]"
            >
              D
            </Link>
          </div>
        </header>
        {mobileOpen ? (
          <div className="fixed inset-0 z-50 md:hidden">
            <button type="button" aria-label="Close navigation menu" className="absolute inset-0 bg-black/60" onClick={() => setMobileOpen(false)} />
            <nav
              id="mobile-nav"
              aria-label="Sections"
              className="absolute inset-y-0 left-0 flex w-[280px] max-w-[85vw] flex-col overflow-y-auto border-r border-[#1b2a45] bg-[#0a1322] p-3"
            >
              <div className="mb-2 flex items-center justify-between">
                <span className="text-[14px] font-semibold text-[#F3F4F6]">
                  HELIX <span className="text-[9px] font-medium tracking-widest text-[#cbd5e1] uppercase">for legal</span>
                </span>
                <button
                  type="button"
                  aria-label="Close menu"
                  autoFocus
                  onClick={() => setMobileOpen(false)}
                  className="flex size-10 items-center justify-center rounded-[4px] text-[#e2e8f0]"
                >
                  <X className="size-5" />
                </button>
              </div>
              {NAV_GROUPS.map((group) => (
                <div key={group.label} className="mb-3 space-y-0.5">
                  <p className="px-2.5 pb-1 text-[10px] font-semibold tracking-wider text-[#64748b] uppercase">{group.label}</p>
                  {group.items.map((item) => (
                    <Link
                      key={item.id}
                      href={LEGAL_HREF[item.id]}
                      onClick={() => {
                        onNav(item.id);
                        setMobileOpen(false);
                      }}
                      aria-current={current === item.id ? "page" : undefined}
                      className={cn(
                        "flex min-h-11 items-center gap-2.5 rounded-[4px] px-2.5 text-[13px]",
                        current === item.id ? "border-l-2 border-[#e2e8f0] bg-[#1b2a45] font-semibold text-[#e2e8f0]" : "text-[#9CA3AF]"
                      )}
                    >
                      <NavIcon name={item.icon} className="size-4" />
                      {item.label}
                      {item.id === "opportunities" && opportunityCount > 0 ? <span className="font-mono-numbers ml-auto text-[11px]">{opportunityCount}</span> : null}
                      {item.id === "deadlines" && deadlineCount > 0 ? (
                        <span className="font-mono-numbers ml-auto rounded-[3px] bg-[#7F1D1D] px-1.5 py-0.5 text-[11px] text-[#FCA5A5]">{deadlineCount}</span>
                      ) : null}
                    </Link>
                  ))}
                </div>
              ))}
              <div className="space-y-0.5 border-t border-[#1b2a45] pt-3">
                <p className="px-2.5 pb-1 text-[10px] font-semibold tracking-wider text-[#64748b] uppercase">More</p>
                {MORE_LINKS.map((l) => (
                  <Link key={l.href} href={l.href} onClick={() => setMobileOpen(false)} className="flex min-h-11 items-center rounded-[4px] px-2.5 text-[13px] text-[#9CA3AF]">
                    {l.label}
                  </Link>
                ))}
              </div>
            </nav>
          </div>
        ) : null}
        {children}
        <footer className="animate-entrance stagger-7 mt-auto flex h-7 items-center justify-between border-t border-[#1b2a45] bg-[#0a1322] px-5 text-[9px] text-[#6B7280]">
          <div className="flex items-center gap-1.5">
            <span className="font-semibold text-[#9CA3AF]">HELIX FOR LEGAL</span>
            <span className="text-[#6B7280]">— Confidential Enterprise Evaluation Build</span>
          </div>
          <div className="hidden items-center gap-1.5 text-[#4B5563] sm:flex">
            {(
              [
                ["/pricing", "Pricing"],
                ["/outcomes", "Outcomes"],
                ["/firm-book", "Firm Book"],
                ["/notifications", "Notifications"],
                ["/profile", "Profile"],
                ["/documents", "Documents"],
                ["/deadlines", "Deadlines"],
                ["/audit", "Audit Log"],
                ["/settings", "Settings"],
                ["/analytics", "Analytics"],
              ] as const
            ).map(([href, label], i) => (
              <span key={href} className="contents">
                {i > 0 ? <span className="text-[#374151]">·</span> : null}
                <Link href={href} className="transition-colors duration-150 hover:text-[#F3F4F6]">
                  {label}
                </Link>
              </span>
            ))}
          </div>
        </footer>
      </div>
    </div>
  );
}
