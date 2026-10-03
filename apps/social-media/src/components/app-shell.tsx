"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { BarChart3, CalendarDays, CircleHelp, Images, KeyRound, LayoutDashboard, ListChecks, Menu, Palette, PanelLeft, Plug, Sparkles, Users, type LucideIcon } from "lucide-react";
import { AskAiDrawer } from "@/components/ask-ai-drawer";
import { CommandPalette, type PalettePost } from "@/components/command-palette";
import { CreditMeter } from "@/components/credit-meter";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
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
  { href: "/operator", label: "Operator", icon: KeyRound },
];

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}

function NavLinks({ pathname, collapsed = false }: { pathname: string; collapsed?: boolean }) {
  return (
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
  );
}

function Brand({ collapsed = false }: { collapsed?: boolean }) {
  return (
    <Link href="/" aria-label="Helix for Social Media — dashboard" className="flex items-center gap-3 rounded-xl px-1 py-1">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/logo-icon.png" alt="" width={512} height={512} className="size-10" />
      {collapsed ? null : (
        <span className="leading-none">
          <span className="block font-[family-name:var(--font-space)] text-xl font-bold tracking-wide text-foreground">HELIX</span>
          <span className="mt-1 block text-xs font-medium tracking-[0.12em] text-foreground/85 uppercase">For Social</span>
        </span>
      )}
    </Link>
  );
}

export function AppShell({ children, session, posts }: { children: React.ReactNode; session: ShellSession; posts: PalettePost[] }) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [navOpen, setNavOpen] = useState(false);
  const [askOpen, setAskOpen] = useState(false);
  const [question, setQuestion] = useState<string | undefined>(undefined);

  // The mobile menu closes whenever the route changes.
  const [navPath, setNavPath] = useState(pathname);
  if (navPath !== pathname) {
    setNavPath(pathname);
    setNavOpen(false);
  }

  // Any page can open the assistant with `window.dispatchEvent(new CustomEvent("helix:open-ask", { detail: { question } }))`.
  useEffect(() => {
    function onOpen(event: Event) {
      const asked = (event as CustomEvent<{ question?: string }>).detail?.question;
      setQuestion(asked);
      setAskOpen(true);
    }
    window.addEventListener("helix:open-ask", onOpen);
    return () => window.removeEventListener("helix:open-ask", onOpen);
  }, []);

  const askButton = (extra: string) => (
    <button
      type="button"
      data-tour="social-ask-ai"
      onClick={() => {
        setQuestion(undefined);
        setAskOpen(true);
      }}
      className={cn("inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-lg border border-primary/50 bg-primary/10 px-3 text-sm font-semibold text-primary hover:bg-primary/20 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none", extra)}
    >
      <Sparkles className="size-4 shrink-0" aria-hidden />
      Ask Helix AI
    </button>
  );

  return (
    <div className="flex min-h-dvh flex-col lg:flex-row">
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-2 border-b border-sidebar-border bg-sidebar/95 px-3 backdrop-blur lg:hidden">
        <div className="flex items-center gap-1">
          <button type="button" aria-label="Open menu" aria-expanded={navOpen} onClick={() => setNavOpen(true)} className="grid size-11 cursor-pointer place-items-center rounded-lg text-foreground hover:bg-sidebar-accent/20">
            <Menu className="size-5" aria-hidden />
          </button>
          <Brand />
        </div>
        {askButton("px-3")}
      </header>

      <Sheet open={navOpen} onOpenChange={setNavOpen}>
        <SheetContent side="left" aria-describedby={undefined} className="w-72 max-w-[85vw] gap-0 bg-sidebar p-0 sm:max-w-72 lg:hidden">
          <SheetHeader className="p-4">
            <SheetTitle className="sr-only">Menu</SheetTitle>
            <Brand />
          </SheetHeader>
          <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4 pb-4">
            <WorkspaceSwitcher session={session} />
            <NavLinks pathname={pathname} />
          </div>
          <div className="px-4 pb-4">
            <CreditMeter session={session} />
          </div>
        </SheetContent>
      </Sheet>

      <aside className={cn("sticky top-0 hidden h-dvh shrink-0 flex-col border-r border-sidebar-border bg-sidebar lg:flex", collapsed ? "w-16" : "w-72")}>
        <div className={cn("flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto py-4", collapsed ? "px-2" : "px-4")}>
          <div className={cn("flex items-center", collapsed ? "justify-center" : "justify-between")}>
            <Brand collapsed={collapsed} />
            {collapsed ? null : (
              <button type="button" aria-label="Collapse sidebar" onClick={() => setCollapsed(true)} className="rounded-lg p-2.5 text-muted-foreground hover:bg-sidebar-accent hover:text-foreground">
                <PanelLeft className="size-4" aria-hidden />
              </button>
            )}
          </div>
          {collapsed ? (
            <button type="button" aria-label="Expand sidebar" onClick={() => setCollapsed(false)} className="rounded-lg p-2.5 text-muted-foreground hover:bg-sidebar-accent hover:text-foreground">
              <PanelLeft className="size-4" aria-hidden />
            </button>
          ) : (
            <WorkspaceSwitcher session={session} />
          )}
          {collapsed ? (
            <button
              type="button"
              aria-label="Ask Helix AI"
              onClick={() => {
                setQuestion(undefined);
                setAskOpen(true);
              }}
              className="grid size-11 cursor-pointer place-items-center rounded-lg border border-primary/50 bg-primary/10 text-primary hover:bg-primary/20">
              <Sparkles className="size-[18px]" aria-hidden />
            </button>
          ) : (
            askButton("w-full")
          )}
          <NavLinks pathname={pathname} collapsed={collapsed} />
        </div>
        {collapsed ? null : (
          <div className="px-4 pb-4">
            <CreditMeter session={session} />
          </div>
        )}
      </aside>

      <main className="min-w-0 flex-1">
        <div className="mx-auto w-full max-w-[1720px] space-y-6 px-4 py-5 sm:px-6 lg:px-8 lg:py-8">
          <CommandPalette session={session} posts={posts} showTrigger={pathname !== "/"} />
          {children}
        </div>
      </main>

      <AskAiDrawer open={askOpen} onOpenChange={setAskOpen} initialQuestion={question} />
    </div>
  );
}
