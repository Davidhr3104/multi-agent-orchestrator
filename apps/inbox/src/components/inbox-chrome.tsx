"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Activity, BarChart3, CalendarDays, ChevronLeft, CircleHelp, Clock, FileText, LayoutDashboard, Menu, Plug, Repeat2, Rows3, Send, Settings, ShieldOff, SlidersHorizontal, Sparkles, Timer, Users, ScrollText, type LucideIcon } from "lucide-react";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { DENSE_KEY } from "@/lib/desk-ui";
import { ThemeToggle } from "@/components/theme-toggle";
import { CommandPalette } from "@/components/command-palette";
import { ConnectionBanner } from "@/components/connection-banner";
import { AskAiDrawer } from "@/components/ask-ai-drawer";

export type InboxNavId =
  | "dashboard"
  | "queue"
  | "followups"
  | "routed"
  | "blocked"
  | "sla"
  | "calendar"
  | "weekly-report"
  | "settings"
  | "help"
  | "analytics"
  | "studio"
  | "integrations"
  | "audit"
  | "team";

/** One icon per destination, so no two menu items look alike. */
const NAV_ICON: Record<InboxNavId, LucideIcon> = {
  dashboard: LayoutDashboard,
  queue: Activity,
  followups: Clock,
  routed: Send,
  blocked: ShieldOff,
  sla: Timer,
  calendar: CalendarDays,
  "weekly-report": FileText,
  analytics: BarChart3,
  studio: SlidersHorizontal,
  integrations: Plug,
  audit: ScrollText,
  team: Users,
  settings: Settings,
  help: CircleHelp,
};

type ProductLink = { name: string; href: string; className: string };

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
    <div className="relative px-2 pb-1">
      <button
        type="button"
        className="btn-tactile flex w-full items-center gap-1.5 rounded-md px-2 py-1 text-[10px] text-muted-foreground hover:text-foreground"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <Repeat2 className="size-3.5" />
        Switch product
      </button>
      {open ? (
        <div className="absolute bottom-8 left-2 z-50 w-56 rounded-lg border border-border bg-surface p-1.5 shadow-xl backdrop-blur-xl dark:border-white/[0.08] dark:bg-[#120A24]/95">
          {links.map((p) => (
            <a
              key={p.name}
              href={p.href}
              className={cn("block rounded-md px-2.5 py-1.5 text-xs hover:bg-surface-muted dark:hover:bg-white/[0.06]", p.className)}
            >
              {p.name}
            </a>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function InboxChrome({
  children,
  queueCount,
  reviewCount,
  routedCount = 0,
  blockedCount = 0,
}: {
  children: ReactNode;
  queueCount: number;
  reviewCount: number;
  routedCount?: number;
  blockedCount?: number;
}) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [dense, setDense] = useState(false);
  const [orgName, setOrgName] = useState("Northwind EA");
  const [orgOpen, setOrgOpen] = useState(false);
  const [askOpen, setAskOpen] = useState(false);
  const [navOpen, setNavOpen] = useState(false);
  const [navPath, setNavPath] = useState(pathname);
  if (navPath !== pathname) {
    setNavPath(pathname);
    setNavOpen(false);
  }
  const [askSeed, setAskSeed] = useState<{ text: string; n: number } | null>(null);
  const [modelLabel, setModelLabel] = useState("Claude");
  const width = collapsed ? "w-[72px]" : "w-[200px]";
  const offset = collapsed ? "md:ml-[72px]" : "md:ml-[200px]";

  useEffect(() => {
    setDense(window.localStorage.getItem(DENSE_KEY) === "1");
  }, []);

  useEffect(() => {
    void fetch("/api/workspace")
      .then((r) => r.json())
      .then((d: { workspace?: { name?: string } }) => {
        if (d.workspace?.name) setOrgName(d.workspace.name);
      })
      .catch(() => undefined);
  }, [pathname]);

  useEffect(() => {
    function loadModel() {
      void fetch("/api/studio")
        .then((r) => r.json())
        .then((d: { profile?: { model?: string } }) => {
          if (d.profile?.model) {
            const known: Record<string, string> = {
              "claude-sonnet-4-20250514": "Claude Sonnet 4",
              "claude-3-5-sonnet-latest": "Claude 3.5 Sonnet",
              "claude-3-5-haiku-latest": "Claude 3.5 Haiku",
            };
            setModelLabel(known[d.profile.model] ?? d.profile.model);
          }
        })
        .catch(() => undefined);
    }
    loadModel();
    window.addEventListener("helix:model-changed", loadModel);
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((v) => !v);
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "j") {
        e.preventDefault();
        setAskOpen((v) => !v);
      }
    }
    function onAsk(event: Event) {
      const text = (event as CustomEvent<string>).detail;
      if (typeof text === "string" && text.trim()) setAskSeed({ text: text.trim(), n: Date.now() });
      setAskOpen(true);
    }
    window.addEventListener("keydown", onKey);
    window.addEventListener("helix:ask", onAsk);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("helix:model-changed", loadModel);
      window.removeEventListener("helix:ask", onAsk);
    };
  }, []);

  function toggleDense() {
    setDense((v) => {
      const next = !v;
      window.localStorage.setItem(DENSE_KEY, next ? "1" : "0");
      return next;
    });
  }

  const nav: {
    id: InboxNavId;
    label: string;
    href: string;
    badge?: number;
    badgeTone?: "amber" | "muted";
  }[] = [
    { id: "dashboard", label: "Dashboard", href: "/" },
    { id: "queue", label: "HITL queue", href: "/hitl-queue", badge: reviewCount, badgeTone: "amber" },
    { id: "followups", label: "Followups", href: "/followup-queue" },
    { id: "routed", label: "Routed", href: "/routed", badge: routedCount, badgeTone: "muted" },
    { id: "blocked", label: "Blocked", href: "/blocked", badge: blockedCount, badgeTone: "muted" },
    { id: "sla", label: "SLA", href: "/sla" },
    { id: "calendar", label: "Calendar", href: "/calendar" },
    { id: "weekly-report", label: "Weekly report", href: "/weekly-report" },
    { id: "analytics", label: "Analytics", href: "/analytics" },
  ];

  const footerNav: typeof nav = [
    { id: "studio", label: "Studio", href: "/studio" },
    { id: "integrations", label: "Integrations", href: "/integrations" },
    { id: "audit", label: "Audit", href: "/audit" },
    { id: "team", label: "Team", href: "/team" },
    { id: "settings", label: "Settings", href: "/settings" },
    { id: "help", label: "How to use", href: "/help" },
  ];

  void queueCount;

  function renderNav(items: typeof nav, mobile = false) {
    const isCollapsed = collapsed && !mobile;
    return items.map((item) => {
      const on =
        item.href === "/"
          ? pathname === "/"
          : pathname === item.href || pathname.startsWith(`${item.href}/`);
      const Icon = NAV_ICON[item.id];
      return (
        <Link
          key={item.href}
          href={item.href}
          aria-current={on ? "page" : undefined}
          aria-label={isCollapsed ? item.label : undefined}
          title={isCollapsed ? item.label : undefined}
          className={cn(
            "group relative flex items-center justify-between rounded-md px-3 py-2 text-xs font-medium transition-colors",
            mobile && "min-h-11 text-sm",
            on
              ? "border border-accent/25 bg-accent/10 text-foreground shadow-sm dark:border-[#8B5CF6]/25 dark:bg-gradient-to-r dark:from-[#8B5CF6]/[0.18] dark:to-[#6366F1]/[0.05] dark:text-[#F9FAFB] dark:shadow-[inset_0_1px_0_0_rgba(255,255,255,0.08)]"
              : "text-muted-foreground hover:bg-surface-muted hover:text-foreground dark:hover:bg-white/[0.04] dark:hover:text-[#F9FAFB]",
            isCollapsed && "justify-center px-0"
          )}
        >
          {on ? (
            <span className="absolute top-1.5 bottom-1.5 left-0 w-[2px] rounded-r bg-gradient-to-b from-accent to-indigo-500 shadow-[0_0_8px_hsl(var(--accent)/0.5)]" />
          ) : null}
          <span className="flex items-center gap-2.5">
            <Icon aria-hidden className={cn("size-4", on ? "text-accent" : "text-muted-foreground group-hover:text-accent")} />
            {isCollapsed ? null : <span className={on ? "font-medium text-foreground" : undefined}>{item.label}</span>}
          </span>
          {!isCollapsed && item.badge != null && item.badge > 0 ? (
            item.badgeTone === "amber" ? (
              <span className="font-mono-numbers rounded border border-amber-500/30 bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700 dark:border-[#F59E0B]/25 dark:bg-[#F59E0B]/15 dark:text-[#FBBF24]">
                {item.badge}
              </span>
            ) : (
              <span className="font-mono-numbers text-[11px] text-muted-foreground">{item.badge}</span>
            )
          ) : null}
        </Link>
      );
    });
  }

  return (
    <div data-density={dense ? "dense" : "comfortable"} className="relative flex min-h-screen text-sm text-foreground">
      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} onToggleDense={toggleDense} />
      <AskAiDrawer open={askOpen} onOpenChange={setAskOpen} initialQuestion={askSeed?.text} seed={askSeed?.n} />
      <Sheet open={navOpen} onOpenChange={setNavOpen}>
        <SheetContent side="left" showCloseButton className="w-[18rem] max-w-[85vw] gap-0 overflow-y-auto border-r border-border bg-surface p-0 md:hidden dark:bg-[#0d0719]">
          <div className="flex h-14 items-center gap-2.5 border-b border-border px-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/helix-inbox-icon.png" alt="" className="size-8 rounded-lg bg-black object-contain p-0.5" />
            <SheetTitle className="text-sm font-semibold tracking-wide text-foreground">
              HELIX <span className="font-medium text-accent">for Inbox</span>
            </SheetTitle>
          </div>
          <nav className="space-y-1 px-2 py-3" aria-label="Main">
            <button
              type="button"
              onClick={() => {
                setNavOpen(false);
                setAskOpen(true);
              }}
              className="mb-2 flex min-h-11 w-full items-center gap-2.5 rounded-md bg-gradient-to-r from-[#4E5FF7] to-[#8B5CF6] px-3 py-2 text-sm font-semibold text-white"
            >
              <Sparkles className="size-4 shrink-0" aria-hidden />
              Ask Helix AI
            </button>
            {renderNav(nav, true)}
          </nav>
          <nav className="space-y-1 border-t border-border px-2 py-3" aria-label="Secondary">
            {renderNav(footerNav, true)}
          </nav>
        </SheetContent>
      </Sheet>
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 hidden flex-col justify-between border-r border-border bg-surface/95 shadow-sm transition-[width] backdrop-blur-xl md:flex dark:border-white/[0.08] dark:bg-[rgba(10,5,20,0.78)] dark:shadow-none",
          width
        )}
      >
        <div>
          <div
            className={cn(
              "flex h-16 items-center border-b border-border dark:border-white/[0.06]",
              collapsed ? "justify-center px-2" : "justify-between px-5"
            )}
          >
            <div className="flex items-center gap-2.5">
              <div className="flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border bg-slate-950 shadow-[0_0_14px_rgba(79,70,229,0.2)] dark:border-white/[0.08] dark:bg-black dark:shadow-[0_0_14px_rgba(139,92,246,0.35)]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/helix-inbox-icon.png"
                  alt="Helix for Inbox"
                  className="h-full w-full object-contain object-center p-0.5"
                />
              </div>
              {collapsed ? null : (
                <div className="flex items-center gap-1.5 leading-none" aria-label="Helix for Inbox">
                  <span className="bg-gradient-to-r from-slate-900 via-indigo-800 to-indigo-600 bg-clip-text text-[13px] font-bold tracking-wider text-transparent dark:from-white dark:via-indigo-100 dark:to-indigo-300">
                    HELIX
                  </span>
                  <span className="text-[12px] font-medium text-accent dark:text-[#A78BFA]/90">for Inbox</span>
                </div>
              )}
            </div>
          </div>

          <nav className="space-y-1 px-2 py-4" aria-label="Main">
            <button
              type="button"
              onClick={() => setAskOpen(true)}
              className={cn(
                "mb-2 flex w-full items-center gap-2.5 rounded-md bg-gradient-to-r from-[#4E5FF7] to-[#8B5CF6] px-3 py-2 text-xs font-semibold text-white shadow-[0_4px_14px_rgba(99,102,241,0.35)]",
                collapsed && "justify-center px-0"
              )}
              title="Ask Helix AI"
              aria-label="Ask Helix AI"
            >
              <Sparkles className="size-4 shrink-0" />
              {collapsed ? null : <span>Ask Helix AI</span>}
            </button>
            {renderNav(nav)}
          </nav>
        </div>

        <div className="border-t border-border dark:border-white/[0.06]">
          <nav className="space-y-1 px-2 py-2" aria-label="Secondary">
            {renderNav(footerNav)}
          </nav>
          <OperatorProductSwitch />
          <div className={cn("flex items-center justify-between p-3", collapsed && "justify-center")}>
            {collapsed ? null : (
              <div className="flex min-w-0 items-center gap-2.5">
                <div className="flex size-8 shrink-0 items-center justify-center rounded-full border border-accent/40 bg-gradient-to-tr from-indigo-500/20 to-violet-500/30 text-xs font-semibold text-foreground">
                  N
                </div>
                <div className="min-w-0 truncate">
                  <p className="truncate text-xs leading-tight font-medium text-foreground">Northwind EA</p>
                  <p className="truncate text-[11px] text-muted-foreground">triage@company.io</p>
                </div>
              </div>
            )}
            <button
              type="button"
              className="p-1 text-muted-foreground transition-colors hover:text-foreground"
              title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
              aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
              onClick={() => setCollapsed((v) => !v)}
            >
              <ChevronLeft className={cn("size-3.5 transition-transform", collapsed && "rotate-180")} />
            </button>
          </div>
        </div>
      </aside>

      <div className={cn("relative flex min-h-screen min-w-0 flex-1 flex-col", offset)}>
        <header className="z-10 flex h-14 shrink-0 items-center justify-between gap-2 border-b border-border bg-surface/90 px-3 backdrop-blur-xl sm:px-4 md:h-16 md:px-6 dark:border-white/[0.08] dark:bg-[rgba(12,6,26,0.72)]">
          <div className="flex min-w-0 items-center gap-2">
            <button
              type="button"
              aria-label="Open navigation menu"
              className="inline-flex size-10 shrink-0 items-center justify-center rounded-md border border-border text-foreground md:hidden"
              onClick={() => setNavOpen(true)}
            >
              <Menu className="size-5" aria-hidden />
            </button>
            <div className="relative min-w-0">
              <button
                type="button"
                aria-expanded={orgOpen}
                aria-label={`Organization: ${orgName}`}
                className="flex min-h-10 max-w-full items-center gap-2 rounded-md border border-border px-2 py-1 text-sm hover:bg-surface-muted md:min-h-0"
                onClick={() => setOrgOpen((v) => !v)}
              >
                <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-accent/20 text-[10px] font-semibold text-accent">
                  {orgName.slice(0, 1)}
                </span>
                <span className="truncate font-medium text-foreground">{orgName}</span>
                <span className="hidden text-muted-foreground lg:inline">/</span>
                <span className="hidden text-muted-foreground lg:inline">Inbox triage</span>
              </button>
              {orgOpen ? (
                <div className="absolute top-12 left-0 z-50 w-56 rounded-lg border border-border bg-surface p-1.5 shadow-xl">
                  <p className="px-2 py-1 text-[10px] tracking-wide text-muted-foreground uppercase">Organization</p>
                  <p className="rounded-md bg-accent/10 px-2 py-1.5 text-xs font-medium text-foreground">{orgName}</p>
                </div>
              ) : null}
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2 md:gap-3.5">
            <button
              type="button"
              title="Dense mode"
              aria-label="Toggle dense mode"
              aria-pressed={dense}
              className={cn(
                "hidden rounded-md border px-2 py-1 text-[11px] md:inline-flex",
                dense ? "border-accent/40 bg-accent/10 text-foreground" : "border-border text-muted-foreground"
              )}
              onClick={toggleDense}
            >
              <Rows3 className="size-3.5" aria-hidden />
            </button>
            <button
              type="button"
              className="hidden items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-[10px] font-medium text-emerald-700 lg:flex dark:text-emerald-300"
              title={modelLabel}
              aria-label={`Model: ${modelLabel}`}
            >
              <span className="size-1.5 rounded-full bg-emerald-500" />
              <span className="max-w-[140px] truncate">{modelLabel}</span>
            </button>
            <button
              type="button"
              className="flex min-h-10 min-w-10 items-center justify-center gap-1.5 rounded-md bg-gradient-to-r from-[#4E5FF7] to-[#8B5CF6] px-2.5 py-1.5 text-xs font-semibold text-white md:min-h-0 md:px-3"
              onClick={() => setAskOpen(true)}
              title="Ask Helix AI (Ctrl+J)"
              aria-label="Ask Helix AI"
            >
              <Sparkles className="size-4 md:size-3.5" aria-hidden />
              <span className="hidden md:inline">Ask Helix AI</span>
            </button>
            <button
              type="button"
              className="hidden rounded-md border border-border px-2 py-1 font-mono text-[10px] text-muted-foreground hover:text-foreground md:inline-flex"
              aria-label="Open command palette"
              onClick={() => setPaletteOpen(true)}
            >
              ⌘K
            </button>
            {reviewCount > 0 ? (
              <div className="flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-xs font-medium text-amber-700 dark:border-[#F59E0B]/25 dark:bg-[#F59E0B]/10 dark:text-[#FBBF24]" aria-label={`${reviewCount} threads need review`}>
                <span className="relative flex size-1.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-500 opacity-75" />
                  <span className="relative inline-flex size-1.5 rounded-full bg-amber-500" />
                </span>
                <span>
                  {reviewCount}
                  <span className="hidden sm:inline"> need review</span>
                </span>
              </div>
            ) : null}
            <ConnectionBanner />
            <ThemeToggle className="size-10 md:size-8" />
            <div className="hidden size-8 items-center justify-center rounded-full border border-accent/40 bg-gradient-to-tr from-indigo-500/20 to-violet-500/30 text-xs font-medium text-foreground shadow-inner md:flex" aria-hidden>
              N
            </div>
          </div>
        </header>
        <div id="main" className="min-w-0 flex-1 overflow-x-hidden overflow-y-auto bg-transparent">{children}</div>
      </div>
    </div>
  );
}
