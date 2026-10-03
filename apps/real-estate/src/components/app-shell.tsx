"use client";

import { useSyncExternalStore } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  Building2,
  CalendarDays,
  CircleHelp,
  Handshake,
  LayoutDashboard,
  Lock,
  Map as MapIcon,
  PanelLeftClose,
  PanelLeftOpen,
  Send,
  Settings,
  Users,
  type LucideIcon,
} from "lucide-react";
import { DeskRefresher } from "@/components/ask-ai-section";
import { CopilotButton, GlobalCopilot, HeaderSearch } from "@/components/global-copilot";
import { NotificationBell, type DeskNotice } from "@/components/notification-bell";
import { ThemeToggle } from "@/components/theme-toggle";
import { cn } from "@/lib/utils";

type NavItem = { href: string; label: string; icon: LucideIcon };

const NAV_GROUPS: { title: string; items: NavItem[] }[] = [
  {
    title: "Desk",
    items: [
      { href: "/", label: "Dashboard", icon: LayoutDashboard },
      { href: "/properties", label: "Properties", icon: Building2 },
      { href: "/leads", label: "Leads", icon: Users },
      { href: "/calendar", label: "Calendar", icon: CalendarDays },
      { href: "/outreach", label: "Outreach", icon: Send },
    ],
  },
  {
    title: "Market & intelligence",
    items: [
      { href: "/analytics", label: "Analytics", icon: BarChart3 },
      { href: "/market", label: "US Market", icon: MapIcon },
      { href: "/sellers", label: "Sellers", icon: Handshake },
    ],
  },
  {
    title: "System",
    items: [
      { href: "/settings", label: "Settings", icon: Settings },
      { href: "/help", label: "How to use", icon: CircleHelp },
    ],
  },
];

/** Live counts from the desk, keyed by nav href. Zero counts are not shown. */
export type NavBadges = Record<string, { count: number; label: string }>;

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}

const COLLAPSE_KEY = "helix-re:sidebar-collapsed";
const COLLAPSE_EVENT = "helix:sidebar";

function subscribeCollapsed(cb: () => void) {
  window.addEventListener(COLLAPSE_EVENT, cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(COLLAPSE_EVENT, cb);
    window.removeEventListener("storage", cb);
  };
}

function useCollapsed(): [boolean, () => void] {
  const collapsed = useSyncExternalStore(
    subscribeCollapsed,
    () => localStorage.getItem(COLLAPSE_KEY) === "1",
    () => false
  );
  const toggle = () => {
    localStorage.setItem(COLLAPSE_KEY, collapsed ? "0" : "1");
    window.dispatchEvent(new Event(COLLAPSE_EVENT));
  };
  return [collapsed, toggle];
}

export function AppShell({ children, badges = {}, notices = [], mode = "demo" }: { children: React.ReactNode; badges?: NavBadges; notices?: DeskNotice[]; mode?: "demo" | "live" }) {
  const pathname = usePathname();
  const [collapsed, toggleCollapsed] = useCollapsed();
  return (
    <div className="flex min-h-dvh flex-col lg:flex-row">
      <aside
        className={cn(
          "z-30 bg-sidebar shadow-[0_24px_48px_-12px_rgba(0,0,0,0.85)] lg:sticky lg:top-0 lg:flex lg:h-dvh lg:shrink-0 lg:flex-col lg:transition-[width] lg:duration-200",
          collapsed ? "lg:w-[76px]" : "lg:w-72"
        )}
      >
        <div className={cn("flex items-center gap-3 px-4 py-3 lg:flex-col lg:items-stretch lg:gap-2 lg:bg-card/40 lg:py-5", collapsed ? "lg:px-3" : "lg:px-6")}>
          <Link href="/" aria-label="Helix for Real Estate — dashboard" className={cn("relative flex shrink-0 items-center gap-3 rounded-xl", collapsed && "lg:justify-center")}>
            <span className="pointer-events-none absolute -left-4 top-1/2 size-16 -translate-y-1/2 rounded-full bg-primary/15 blur-2xl" aria-hidden />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo-icon.png" alt="" width={262} height={403} className="relative h-10 w-auto drop-shadow-[0_0_10px_rgba(251,191,36,0.35)]" />
            <span className={cn("relative leading-none", collapsed && "lg:hidden")}>
              <span className="block font-heading text-lg font-semibold tracking-[0.12em] text-[var(--gold-soft,var(--primary))] uppercase">Helix</span>
              <span className="mt-1 block text-[10px] font-semibold tracking-[0.2em] text-muted-foreground uppercase">Real Estate AI</span>
            </span>
          </Link>
          <span className={cn("hidden w-fit items-center gap-1.5 rounded-full bg-accent px-2 py-0.5 text-[10px] font-medium text-muted-foreground lg:inline-flex", collapsed && "lg:hidden")}>
            <span className="size-1.5 rounded-full bg-primary" aria-hidden />
            Agent desk · you approve every action
          </span>
        </div>

        <div className={cn("flex items-center gap-3 px-4 pb-3 lg:min-h-0 lg:flex-1 lg:flex-col lg:items-stretch lg:gap-5 lg:overflow-y-auto lg:py-5", collapsed ? "lg:px-3" : "lg:px-4")}>
          <div className="hidden lg:block xl:hidden">
            <CopilotButton collapsed={collapsed} />
          </div>
          <nav data-tour="re-nav" aria-label="Primary" className="relative flex min-w-0 flex-1 gap-1 overflow-x-auto lg:flex-none lg:flex-col lg:gap-5 lg:overflow-visible">
            {NAV_GROUPS.map((group) => (
              <div key={group.title} className="flex shrink-0 gap-1 lg:flex-col">
                <p className={cn("hidden px-2 pb-1 text-[10px] font-semibold tracking-[0.16em] text-muted-foreground/80 uppercase lg:block", collapsed && "lg:sr-only")}>{group.title}</p>
                {group.items.map(({ href, label, icon: Icon }) => {
                  const active = isActive(pathname, href);
                  const badge = badges[href];
                  return (
                    <Link
                      key={href}
                      href={href}
                      aria-current={active ? "page" : undefined}
                      title={collapsed ? (badge?.count ? `${label} — ${badge.label}` : label) : badge?.count ? badge.label : undefined}
                      className={cn(
                        "relative flex min-h-9 shrink-0 items-center gap-3 rounded-lg px-2.5 text-[13px] transition-colors duration-200",
                        collapsed && "lg:justify-center lg:px-0",
                        active ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground" : "text-muted-foreground hover:bg-sidebar-accent hover:text-foreground"
                      )}
                    >
                      <Icon className={cn("size-[18px] shrink-0", active && "text-primary")} aria-hidden />
                      <span className={cn(collapsed && "lg:sr-only")}>{label}</span>
                      {badge?.count ? (
                        <span
                          className={cn(
                            "tabular ml-auto inline-flex min-w-5 items-center justify-center rounded bg-accent px-1.5 py-0.5 font-mono text-[10px] font-semibold text-[var(--gold-soft,var(--primary))]",
                            collapsed && "lg:absolute lg:top-1 lg:right-1.5 lg:ml-0 lg:size-2 lg:min-w-0 lg:rounded-full lg:bg-primary lg:p-0 lg:text-[0px]"
                          )}
                        >
                          {badge.count}
                          <span className="sr-only">: {badge.label}</span>
                        </span>
                      ) : null}
                    </Link>
                  );
                })}
              </div>
            ))}
          </nav>
        </div>

        <div className={cn("hidden shrink-0 space-y-3 bg-card/40 py-4 lg:block", collapsed ? "px-3" : "px-5")}>
          <button
            type="button"
            onClick={toggleCollapsed}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            className={cn(
              "flex min-h-8 items-center gap-2 rounded-lg px-2 text-xs font-medium text-muted-foreground transition hover:bg-sidebar-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
              collapsed && "mx-auto"
            )}
          >
            {collapsed ? <PanelLeftOpen className="size-4" aria-hidden /> : <PanelLeftClose className="size-4" aria-hidden />}
            {collapsed ? null : "Collapse sidebar"}
          </button>
          {collapsed ? null : (
            <p className="flex items-start gap-1.5 text-[11px] leading-snug text-muted-foreground">
              <Lock className="mt-px size-3.5 shrink-0 text-primary" aria-hidden />
              <span>
                <span className="font-semibold text-foreground">AI proposes, you approve.</span> Nothing is published or sent without your OK.
              </span>
            </p>
          )}
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 hidden h-16 items-center justify-between gap-4 bg-background/85 px-6 shadow-[0_1px_8px_rgba(0,0,0,0.25)] backdrop-blur-xl lg:flex lg:px-8">
          <HeaderSearch />
          <div className="flex items-center gap-2">
            {mode === "demo" ? (
              <span className="hidden items-center gap-2 rounded-full bg-card px-3 py-1 text-[11px] font-medium text-muted-foreground xl:inline-flex" title="Sample agency data held in memory — import your own listings under Settings to switch to your data">
                <span className="size-2 rounded-full bg-[var(--tertiary,#38bdf8)]" aria-hidden />
                Demo desk · sample data
              </span>
            ) : (
              <span className="hidden items-center gap-2 rounded-full bg-card px-3 py-1 text-[11px] font-medium text-muted-foreground xl:inline-flex" title="Your own data, held in this server's memory">
                <span className="size-2 rounded-full bg-emerald-400" aria-hidden />
                Your data · in memory
              </span>
            )}
            <ThemeToggle compact />
            <NotificationBell notices={notices} align="right" />
          </div>
        </header>
        <div className="flex items-center justify-end gap-1 px-4 pt-2 lg:hidden">
          <ThemeToggle compact />
          <NotificationBell notices={notices} align="right" />
        </div>
        <main className="min-w-0 flex-1">
          <div className="mx-auto w-full max-w-[1440px] space-y-8 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">{children}</div>
        </main>
      </div>
      <GlobalCopilot />
      <DeskRefresher />
    </div>
  );
}
