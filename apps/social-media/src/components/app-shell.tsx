"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { BarChart3, CalendarDays, CircleHelp, Images, LayoutDashboard, ListChecks, Palette, PanelLeft, Plug, Users, type LucideIcon } from "lucide-react";
import { CommandPalette, type PalettePost } from "@/components/command-palette";
import { CreditMeter } from "@/components/credit-meter";
import { WorkspaceSwitcher } from "@/components/workspace-switcher";
import type { ShellSession } from "@/lib/store";
import { cn } from "@/lib/utils";

const NAV: { href: string; label: string; icon: LucideIcon }[] = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/calendar", label: "Calendar", icon: CalendarDays },
  { href: "/posts", label: "Posts", icon: ListChecks },
  { href: "/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/library", label: "Library", icon: Images },
  { href: "/team", label: "Team", icon: Users },
  { href: "/brand", label: "Brand voice", icon: Palette },
  { href: "/connections", label: "Connections", icon: Plug },
  { href: "/help", label: "How to use", icon: CircleHelp },
];

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}

export function AppShell({ children, session, posts }: { children: React.ReactNode; session: ShellSession; posts: PalettePost[] }) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  return (
    <div className="flex min-h-dvh flex-row">
      <aside className={cn("sticky top-0 flex h-dvh shrink-0 flex-col border-r border-sidebar-border bg-sidebar", collapsed ? "w-16" : "w-72")}>
        <div className={cn("flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto py-4", collapsed ? "px-2" : "px-4")}>
          <div className={cn("flex items-center", collapsed ? "justify-center" : "justify-between")}>
            <Link href="/" aria-label="Helix for Social Media — dashboard" className="flex items-center gap-3 rounded-xl px-1 py-1">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/logo-icon.png" alt="" width={512} height={512} className="size-10" />
              {collapsed ? null : (
                <span className="leading-none">
                  <span className="block font-[family-name:var(--font-space)] text-xl font-bold tracking-wide text-foreground">HELIX</span>
                  <span className="mt-1 block text-[10px] font-medium tracking-[0.12em] text-foreground/85 uppercase">For Social</span>
                </span>
              )}
            </Link>
            {collapsed ? null : (
              <button type="button" aria-label="Collapse sidebar" onClick={() => setCollapsed(true)} className="rounded-lg p-2 text-muted-foreground hover:bg-sidebar-accent hover:text-foreground">
                <PanelLeft className="size-4" aria-hidden />
              </button>
            )}
          </div>
          {collapsed ? (
            <button type="button" aria-label="Expand sidebar" onClick={() => setCollapsed(false)} className="rounded-lg p-2 text-muted-foreground hover:bg-sidebar-accent hover:text-foreground">
              <PanelLeft className="size-4" aria-hidden />
            </button>
          ) : (
            <WorkspaceSwitcher session={session} />
          )}
          <nav aria-label="Primary" className="flex flex-col gap-1">
            {NAV.map(({ href, label, icon: Icon }) => {
              const active = isActive(pathname, href);
              return (
                <Link
                  key={href}
                  href={href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex min-h-11 shrink-0 items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors duration-200",
                    active ? "bg-primary text-primary-foreground shadow-[0_0_16px_rgba(247,81,161,0.35)]" : "text-muted-foreground hover:bg-accent hover:text-foreground"
                  )}
                >
                  <Icon className="size-[18px] shrink-0" aria-hidden />
                  {collapsed ? <span className="sr-only">{label}</span> : label}
                </Link>
              );
            })}
          </nav>
        </div>
        {collapsed ? null : (
          <div className="px-4 pb-4">
            <CreditMeter session={session} />
          </div>
        )}
      </aside>
      <main className="min-w-0 flex-1">
        <div className="mx-auto w-full max-w-[1720px] space-y-6 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          <CommandPalette session={session} posts={posts} showTrigger={pathname !== "/"} />
          {children}
        </div>
      </main>
    </div>
  );
}
