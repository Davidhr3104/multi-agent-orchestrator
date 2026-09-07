"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Repeat2 } from "lucide-react";
import { cn } from "@/lib/utils";

export type LegalNavId =
  | "dashboard"
  | "opportunities"
  | "documents"
  | "deadlines"
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
  analytics: "/analytics",
  settings: "/settings",
  audit: "/audit",
  pricing: "/pricing",
  help: "/help",
};

type ProductLink = { name: string; href: string; className: string };

const NAV: { id: LegalNavId; label: string; icon: string }[] = [
  { id: "dashboard", label: "Dashboard", icon: "dash" },
  { id: "opportunities", label: "Opportunities", icon: "target" },
  { id: "documents", label: "Documents", icon: "doc" },
  { id: "deadlines", label: "Deadlines", icon: "cal" },
  { id: "pricing", label: "Pricing", icon: "coin" },
  { id: "analytics", label: "Analytics", icon: "chart" },
  { id: "settings", label: "Settings", icon: "gear" },
  { id: "audit", label: "Audit Log", icon: "clip" },
  { id: "help", label: "How to use", icon: "help" },
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
  const [links, setLinks] = useState<ProductLink[]>([]);

  useEffect(() => {
    void fetch("/api/operator")
      .then((r) => r.json())
      .then((d: { operator?: boolean; products?: ProductLink[] }) => {
        setOperator(Boolean(d.operator));
        setLinks(Array.isArray(d.products) ? d.products : []);
      })
      .catch(() => setOperator(false));
  }, []);

  if (!operator) return null;

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
        <div className="absolute bottom-8 left-0 z-50 w-56 rounded-[4px] border border-[#1F2937] bg-[#111827] p-1.5 shadow-subtle">
          {links.map((p) => (
            <a key={p.name} href={p.href} className={cn("block rounded-[4px] px-2.5 py-1.5 text-xs hover:bg-[#1F2937]", p.className)}>
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
  const routeActive: LegalNavId | null = pathname.startsWith("/analytics")
    ? "analytics"
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
    <div className="flex min-h-screen bg-[#0B0F19] text-xs text-[#9CA3AF]">
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 hidden flex-col justify-between border-r border-[#1F2937] bg-[#0B0F19] select-none transition-[width] md:flex",
          width
        )}
      >
        <div>
          <div className={cn("flex h-12 items-center gap-2.5 border-b border-[#1F2937]", collapsed ? "justify-center px-2" : "px-3.5")}>
            <div className="flex size-6 shrink-0 items-center justify-center overflow-hidden rounded-[3px] bg-white p-px transition-transform duration-150 hover:scale-105">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/helix-legal-icon.png" alt="" className="h-full w-full object-contain" />
            </div>
            {collapsed ? null : (
              <div className="min-w-0 overflow-hidden" aria-label="Helix for Legal">
                <div className="flex items-center gap-1.5 leading-none">
                  <span className="text-[14px] font-semibold text-[#F3F4F6]">HELIX</span>
                  <span className="text-[9px] font-medium tracking-widest text-[#F59E0B] uppercase">FOR LEGAL</span>
                </div>
                <p className="mt-1 truncate text-[10px] leading-none font-normal text-[#6B7280]">Enterprise Suite</p>
              </div>
            )}
          </div>
          <nav className="space-y-0.5 p-2">
            {NAV.map((item) => {
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
                      ? "border-l-2 border-[#F59E0B] bg-[#1F2937] font-semibold text-[#F59E0B]"
                      : "text-[#9CA3AF] hover:bg-[#1F2937] hover:text-[#F3F4F6]",
                    collapsed && "justify-center px-0"
                  )}
                >
                  <span className="flex items-center gap-2">
                    <NavIcon name={item.icon} className={on ? "text-[#F59E0B]" : "text-[#6B7280]"} />
                    {collapsed ? null : <span className="text-xs">{item.label}</span>}
                  </span>
                  {!collapsed && badge > 0 ? (
                    item.id === "deadlines" ? (
                      <span className="font-mono-numbers rounded-[3px] bg-[#7F1D1D] px-1.5 py-0.5 text-[10px] font-medium text-[#FCA5A5]">
                        {badge}
                      </span>
                    ) : (
                      <span className="font-mono-numbers flex size-[18px] items-center justify-center rounded-full bg-[#1F2937] text-[10px] text-[#F3F4F6]">
                        {badge}
                      </span>
                    )
                  ) : null}
                </Link>
              );
            })}
          </nav>
        </div>
        <div className="space-y-2 border-t border-[#1F2937] p-3">
          {collapsed ? null : (
            <>
              <div className="flex items-center justify-between rounded-[4px] border border-[#1F2937] bg-[#111827] px-2 py-1.5 text-[10px]">
                <div className="flex items-center gap-1.5">
                  <span className="pulse-dot-green size-1.5 shrink-0 rounded-full bg-[#10B981]" />
                  <span className="text-[#6B7280]">Vault Encrypted</span>
                </div>
                <span className="font-mono-numbers text-[#6B7280]">TLS 1.3</span>
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

      <div className={cn("flex min-w-0 flex-1 flex-col bg-[#0B0F19]", offset)}>
        <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-4 border-b border-[#1F2937] bg-[#0B0F19] px-5">
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
                  className="shrink-0 text-[#9CA3AF] transition-colors duration-150 hover:text-[#F3F4F6]"
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
                      className="shrink-0 text-[#9CA3AF] transition-colors duration-150 hover:text-[#F3F4F6]"
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
          <div className="flex shrink-0 items-center gap-3">
            <button
              type="button"
              onClick={onSearch}
              className="group relative hidden h-8 w-[260px] rounded-[4px] border border-[#1F2937] bg-[#111827] pr-10 pl-8 text-left text-xs text-[#6B7280] transition-colors duration-150 hover:border-[#F59E0B] hover:text-[#F3F4F6] lg:block"
            >
              <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-2.5 text-[#6B7280] transition-colors group-hover:text-[#F59E0B]">
                <svg className="size-3.5" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                  <circle cx="11" cy="11" r="8" />
                  <line x1="21" x2="16.65" y1="21" y2="16.65" />
                </svg>
              </span>
              Search RFPs, dockets...
              <kbd className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2">
                <span className="font-mono-numbers rounded-[3px] bg-[#1F2937] px-1 py-0.5 text-[10px] text-[#9CA3AF]">⌘K</span>
              </kbd>
            </button>
            <div className="hidden items-center gap-1.5 rounded-[4px] border border-[#10B981]/30 bg-transparent px-2 py-0.5 text-[10px] font-medium text-[#10B981] md:flex">
              <span className="pulse-dot-green size-[5px] rounded-full bg-[#10B981]" />
              Engine Active
            </div>
            <div className="hidden items-center gap-1.5 rounded-[4px] border border-[#F59E0B] bg-transparent px-2 py-0.5 text-[10px] font-medium text-[#F59E0B] sm:flex">
              <span className="size-[5px] rounded-full bg-[#F59E0B]" />
              Enterprise
            </div>
            <Link
              href="/notifications"
              aria-label="Notifications"
              className={cn(
                "btn-tactile relative rounded-[4px] p-1.5 text-[#6B7280] hover:text-[#F3F4F6]",
                pathname.startsWith("/notifications") && "text-[#F59E0B]"
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
              className="flex size-7 cursor-pointer items-center justify-center rounded-full bg-[#374151] text-[11px] font-semibold text-[#F3F4F6] transition-colors duration-150 hover:bg-[#4B5563]"
            >
              D
            </Link>
          </div>
        </header>
        {children}
        <footer className="animate-entrance stagger-7 mt-auto flex h-7 items-center justify-between border-t border-[#1F2937] bg-[#0B0F19] px-5 text-[9px] text-[#6B7280]">
          <div className="flex items-center gap-1.5">
            <span className="font-semibold text-[#9CA3AF]">HELIX FOR LEGAL</span>
            <span className="text-[#6B7280]">— Confidential Enterprise Evaluation Build</span>
          </div>
          <div className="hidden items-center gap-1.5 text-[#4B5563] sm:flex">
            {(
              [
                ["/pricing", "Pricing"],
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
