"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { StoredLead } from "@helix/core";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { CommandPalette, ShortcutsHelp } from "@/components/command-palette";
import {
  applyBrand,
  readBrand,
  readCurrentWorkspace,
  readWorkspaces,
  writeCurrentWorkspace,
  type Workspace,
} from "@/lib/prefs";
import {
  BarChart3,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  FileText,
  Inbox,
  LayoutDashboard,
  Menu,
  Palette,
  Plug,
  Repeat2,
  Search,
  Settings,
  Sliders,
  Sparkles,
  Target,
  Workflow,
  X,
  Cpu,
} from "lucide-react";

const STORAGE_KEY = "helix-leads-sidebar-collapsed";
const SETTINGS_KEY = "helix-leads-settings-open";

const PRODUCTS = [
  { name: "Helix for Commerce", href: "#commerce", className: "text-emerald-400" },
  { name: "Helix for Legal", href: "http://localhost:43149", className: "text-amber-400" },
  { name: "Helix for Video", href: "#video", className: "text-red-400" },
  { name: "Helix for Social", href: "#social", className: "text-pink-400" },
  { name: "Helix for Edit", href: "#edit", className: "text-violet-400" },
];

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(true);
  const [productsOpen, setProductsOpen] = useState(false);
  const [newCount, setNewCount] = useState(0);
  const [reviewCount, setReviewCount] = useState(0);
  const [ready, setReady] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [workspaceId, setWorkspaceId] = useState("a");
  const [brandName, setBrandName] = useState("Helix for Leads");
  const [logoUrl, setLogoUrl] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    try {
      setCollapsed(window.localStorage.getItem(STORAGE_KEY) === "1");
      setSettingsOpen(window.localStorage.getItem(SETTINGS_KEY) !== "0");
      const brand = readBrand();
      applyBrand(brand);
      setBrandName(brand.productName);
      setLogoUrl(brand.logoUrl);
      setWorkspaces(readWorkspaces());
      setWorkspaceId(readCurrentWorkspace());
    } catch {
      /* ignore */
    }
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, collapsed ? "1" : "0");
    } catch {
      /* ignore */
    }
  }, [collapsed, ready]);

  useEffect(() => {
    if (!ready) return;
    try {
      window.localStorage.setItem(SETTINGS_KEY, settingsOpen ? "1" : "0");
    } catch {
      /* ignore */
    }
  }, [settingsOpen, ready]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const t = e.target as HTMLElement | null;
      const typing = t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable);
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen(true);
        return;
      }
      if (e.key === "Escape") {
        setPaletteOpen(false);
        setHelpOpen(false);
        window.dispatchEvent(new Event("helix:close-panel"));
        return;
      }
      if (typing) return;
      if (e.key === "/") {
        e.preventDefault();
        searchRef.current?.focus();
      }
      if (e.key === "n" || e.key === "N") {
        e.preventDefault();
        window.dispatchEvent(new Event("helix:new-lead"));
      }
      if (e.key === "?") {
        e.preventDefault();
        setHelpOpen(true);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    void fetch("/api/leads")
      .then((r) => r.json())
      .then((data: { leads?: StoredLead[] }) => {
        const leads = data.leads ?? [];
        setNewCount(leads.filter((l) => (l.pipelineStage ?? "new") === "new").length);
        setReviewCount(leads.filter((l) => l.needsReview).length);
      })
      .catch(() => undefined);
  }, [pathname]);

  useEffect(() => {
    setMobileOpen(false);
    setProductsOpen(false);
  }, [pathname]);

  const expanded = !collapsed;

  const nav = [
    { href: "/", label: "Dashboard", icon: LayoutDashboard },
    { href: "/leads", label: "Leads", icon: Target, badge: newCount },
    { href: "/analytics", label: "Analytics", icon: BarChart3 },
    { href: "/inbox", label: "Inbox", icon: Inbox, badge: reviewCount },
  ] as const;

  const settingsItems = [
    { href: "/settings/scoring", label: "Scoring Rules", icon: Sliders },
    { href: "/settings/prompts", label: "Prompt Playground", icon: Sparkles },
    { href: "/settings/usage", label: "Usage & API", icon: Cpu },
    { href: "/settings/automations", label: "Automations", icon: Workflow },
    { href: "/settings/integrations", label: "Integrations", icon: Plug },
    { href: "/settings/brand", label: "White-label", icon: Palette },
  ] as const;

  function NavLabel({ label, children }: { label: string; children: ReactNode }) {
    if (expanded || mobileOpen) return children;
    return (
      <Tooltip>
        <TooltipTrigger className="flex w-full justify-center">{children}</TooltipTrigger>
        <TooltipContent side="right" className="border border-white/10 bg-[#041a2e] text-slate-200">
          {label}
        </TooltipContent>
      </Tooltip>
    );
  }

  const sidebar = (
    <aside
      className={cn(
        "fixed inset-y-0 left-0 z-40 flex flex-col border-r border-white/10 bg-slate-900/95 transition-all duration-300",
        mobileOpen ? "w-[250px] translate-x-0" : "w-[250px] -translate-x-full",
        "md:translate-x-0",
        expanded ? "md:w-[250px]" : "md:w-16"
      )}
    >
      <div className="flex h-16 shrink-0 items-center gap-2 border-b border-white/10 px-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-white p-1">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={logoUrl || "/helix-leads-icon.png"} alt="" className="h-full w-full object-contain" />
        </div>
        {expanded || mobileOpen ? (
          logoUrl ? (
            <span className="min-w-0 flex-1 truncate text-sm font-medium text-white">{brandName}</span>
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src="/helix-leads-wordmark.png"
              alt={brandName}
              className="h-7 min-w-0 flex-1 object-contain object-left brightness-0 invert"
            />
          )
        ) : null}
        <button
          type="button"
          className="ml-auto hidden rounded-md p-1 text-white/70 hover:bg-white/5 md:inline-flex"
          onClick={() => setCollapsed((v) => !v)}
          aria-label={expanded ? "Collapse sidebar" : "Expand sidebar"}
        >
          {expanded ? <ChevronLeft className="size-5" /> : <ChevronRight className="size-5" />}
        </button>
        <button
          type="button"
          className="ml-auto rounded-md p-1 text-white/70 hover:bg-white/5 md:hidden"
          onClick={() => setMobileOpen(false)}
          aria-label="Close menu"
        >
          <X className="size-5" />
        </button>
      </div>

      <nav className="flex flex-1 flex-col gap-1 overflow-y-auto p-2">
        {nav.map((item) => {
          const active = isActive(pathname, item.href);
          const Icon = item.icon;
          const badge = "badge" in item ? item.badge : undefined;
          return (
            <NavLabel key={item.href} label={item.label}>
              <Link
                href={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-4 py-3 text-sm font-medium text-white/70 hover:bg-white/5",
                  !expanded && !mobileOpen && "justify-center px-0",
                  active && "bg-cyan-500/20 text-cyan-400 hover:bg-cyan-500/20"
                )}
              >
                <Icon className="size-5 shrink-0" />
                {expanded || mobileOpen ? (
                  <>
                    <span className="flex-1 truncate">{item.label}</span>
                    {badge != null && badge > 0 ? (
                      <span className="rounded-full bg-cyan-500/20 px-2 py-0.5 text-[10px] font-semibold text-cyan-400">
                        {badge}
                      </span>
                    ) : null}
                  </>
                ) : null}
              </Link>
            </NavLabel>
          );
        })}

        <div className="mt-1">
          <NavLabel label="Settings">
            <button
              type="button"
              className={cn(
                "flex w-full items-center gap-3 rounded-lg px-4 py-3 text-sm font-medium text-white/70 hover:bg-white/5",
                !expanded && !mobileOpen && "justify-center px-0",
                pathname.startsWith("/settings") && "bg-cyan-500/20 text-cyan-400"
              )}
              onClick={() => {
                if (!expanded && !mobileOpen) {
                  setCollapsed(false);
                  setSettingsOpen(true);
                  return;
                }
                setSettingsOpen((v) => !v);
              }}
            >
              <Settings className="size-5 shrink-0" />
              {expanded || mobileOpen ? (
                <>
                  <span className="flex-1 text-left">Settings</span>
                  <ChevronDown
                    className={cn("size-4 transition-transform", settingsOpen && "rotate-180")}
                  />
                </>
              ) : null}
            </button>
          </NavLabel>
          {settingsOpen && (expanded || mobileOpen) ? (
            <div className="mt-1 space-y-1">
              {settingsItems.map((item) => {
                const Icon = item.icon;
                const active = isActive(pathname, item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "flex items-center gap-3 rounded-lg py-3 pr-4 pl-12 text-sm font-medium text-white/70 hover:bg-white/5",
                      active && "bg-cyan-500/20 text-cyan-400 hover:bg-cyan-500/20"
                    )}
                  >
                    <Icon className="size-5 shrink-0" />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </div>
          ) : null}
        </div>

        <NavLabel label="Audit Log">
          <Link
            href="/audit"
            className={cn(
              "flex items-center gap-3 rounded-lg px-4 py-3 text-sm font-medium text-white/70 hover:bg-white/5",
              !expanded && !mobileOpen && "justify-center px-0",
              isActive(pathname, "/audit") && "bg-cyan-500/20 text-cyan-400 hover:bg-cyan-500/20"
            )}
          >
            <FileText className="size-5 shrink-0" />
            {expanded || mobileOpen ? <span>Audit Log</span> : null}
          </Link>
        </NavLabel>
      </nav>

      <div className="relative border-t border-white/10 p-2">
        <NavLabel label="Switch Product">
          <button
            type="button"
            className={cn(
              "flex w-full items-center gap-3 rounded-lg px-4 py-3 text-sm font-medium text-white/70 hover:bg-white/5",
              !expanded && !mobileOpen && "justify-center px-0"
            )}
            onClick={() => setProductsOpen((v) => !v)}
          >
            <Repeat2 className="size-5 shrink-0" />
            {expanded || mobileOpen ? <span>Switch Product</span> : null}
          </button>
        </NavLabel>
        {productsOpen ? (
          <div
            className={cn(
              "card-bg absolute bottom-14 z-50 rounded-xl p-2",
              expanded || mobileOpen ? "left-2 right-2" : "left-16 w-56"
            )}
          >
            {PRODUCTS.map((p) => (
              <a
                key={p.name}
                href={p.href}
                className={cn(
                  "block rounded-lg px-3 py-2 text-sm font-medium hover:bg-white/5",
                  p.className
                )}
              >
                {p.name}
              </a>
            ))}
          </div>
        ) : null}
      </div>
    </aside>
  );

  return (
    <div className="min-h-full">
      {mobileOpen ? (
        <button
          type="button"
          className="fixed inset-0 z-30 bg-black/60 md:hidden"
          aria-label="Close sidebar"
          onClick={() => setMobileOpen(false)}
        />
      ) : null}
      {sidebar}
      <div
        className={cn(
          "flex min-h-full flex-col transition-all duration-300",
          expanded ? "md:ml-[250px]" : "md:ml-16"
        )}
      >
        <div className="sticky top-0 z-20 flex h-12 items-center gap-2 border-b border-white/10 bg-[#021426] px-3">
          <button
            type="button"
            className="rounded-md p-1 text-white/80 hover:bg-white/5 md:hidden"
            onClick={() => setMobileOpen(true)}
            aria-label="Open menu"
          >
            <Menu className="size-5" />
          </button>
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute top-1/2 left-2 size-3.5 -translate-y-1/2 text-slate-500" />
            <input
              ref={searchRef}
              className="h-8 w-full rounded-md border border-sky-900/50 bg-[#0a1e30] pr-16 pl-8 text-sm text-slate-200 placeholder-slate-500 outline-none focus:border-sky-500"
              placeholder="Search leads, logs, settings…"
              onFocus={() => setPaletteOpen(true)}
              readOnly
            />
            <kbd className="pointer-events-none absolute top-1/2 right-2 -translate-y-1/2 rounded border border-sky-900/50 px-1.5 py-0.5 font-mono text-[10px] text-slate-500">
              ⌘K
            </kbd>
          </div>
          <select
            className="hidden h-8 max-w-[10rem] rounded-md border border-sky-900/50 bg-[#0a1e30] px-2 text-xs text-slate-300 sm:block"
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
        </div>
        <div className="flex-1">{children}</div>
      </div>
      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
      <ShortcutsHelp open={helpOpen} onClose={() => setHelpOpen(false)} />
    </div>
  );
}
