"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Rows3,
  ShieldAlert,
  Send,
  Menu,
  Upload,
  CircleHelp,
} from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import { AskAiDrawer, AskAiWorkspace } from "@/components/ask-ai-drawer";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/datasets", label: "Datasets", icon: Rows3 },
  { href: "/hitl-queue", label: "HITL queue", icon: ShieldAlert, hitl: true },
  { href: "/help", label: "How to use", icon: CircleHelp },
];

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [hitl, setHitl] = useState(0);
  const [mode, setMode] = useState<"demo" | "live" | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    void fetch("/api/datasets")
      .then((r) => r.json())
      .then((d: { kpis?: { hitlPending?: number }; mode?: "demo" | "live" }) => {
        setHitl(d.kpis?.hitlPending ?? 0);
        setMode(d.mode ?? null);
      })
      .catch(() => undefined);
  }, [pathname]);

  return (
    <div className="relative flex min-h-screen text-sm">
      {open ? (
        <button
          type="button"
          className="fixed inset-0 z-30 bg-black/40 md:hidden"
          aria-label="Close menu"
          onClick={() => setOpen(false)}
        />
      ) : null}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex w-[240px] flex-col border-r border-border bg-surface/90 backdrop-blur-xl transition-transform md:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        )}
      >
        <div className="flex h-28 items-center border-b border-border bg-black px-1">
          <Link href="/" aria-label="Helix Data dashboard" className="flex h-full w-full items-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/helix-data.png?v=white" alt="Helix Data" className="h-full w-full object-contain" />
          </Link>
        </div>
        <nav className="flex-1 space-y-1 p-2" aria-label="Main">
          {NAV.map((item) => {
            const on = item.href === "/" ? pathname === "/" : pathname === item.href || pathname.startsWith(`${item.href}/`);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                aria-current={on ? "page" : undefined}
                className={cn(
                  "flex items-center justify-between rounded-md px-3 py-2 text-xs font-medium",
                  on ? "bg-accent/15 text-foreground" : "text-muted-foreground hover:bg-surface-muted hover:text-foreground"
                )}
              >
                <span className="flex items-center gap-2.5">
                  <Icon className={cn("size-4", on ? "text-accent" : "")} />
                  {item.label}
                </span>
                {item.hitl && hitl > 0 ? (
                  <span className="hitl-badge rounded px-1.5 py-0.5 font-mono text-[10px] font-semibold">{hitl}</span>
                ) : null}
              </Link>
            );
          })}
        </nav>
        <p className="px-4 pb-4 text-[10px] text-muted-foreground">
          Contact <a className="text-accent underline" href="mailto:hello@helix.ai">hello@helix.ai</a>
        </p>
      </aside>
      <div className="relative flex min-h-screen min-w-0 flex-1 flex-col md:ml-[240px]">
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between gap-3 border-b border-border bg-background/80 px-3 backdrop-blur-md sm:px-6">
          <div className="flex min-w-0 items-center gap-2">
            <button
              type="button"
              className="flex size-10 items-center justify-center rounded-lg md:hidden"
              aria-label="Open navigation"
              onClick={() => setOpen(true)}
            >
              <Menu className="size-5" />
            </button>
            <span className="truncate text-xs font-semibold text-primary">Helix Data</span>
            {mode === "demo" ? (
              <span className="hitl-badge rounded-full px-2 py-0.5 text-[10px] font-bold tracking-wide uppercase">
                Demo data
              </span>
            ) : null}
          </div>
          <div className="flex items-center gap-2">
            <AskAiDrawer />
            <label className="inline-flex min-h-9 cursor-pointer items-center gap-1.5 rounded-md border border-border px-3 text-xs font-medium hover:bg-surface-muted">
              <Upload className="size-3.5" />
              Upload
              <input
                type="file"
                accept=".xlsx,.xls,.csv"
                className="sr-only"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  const body = new FormData();
                  body.append("file", file);
                  void fetch("/api/datasets/upload", { method: "POST", body }).then((r) =>
                    r.json().then((d: { id?: string; dataset?: { id?: string; dataset?: { id?: string } }; error?: string }) => {
                      const id = d.id ?? d.dataset?.dataset?.id ?? d.dataset?.id;
                      if (id) window.location.href = `/datasets/${id}`;
                      else alert(d.error || "Upload failed.");
                    })
                  );
                }}
              />
            </label>
            <Link
              href="/datasets"
              className="hidden items-center gap-1 rounded-md border border-border px-3 py-1.5 text-xs sm:inline-flex"
            >
              <Send className="size-3.5" />
              Export is always a new file
            </Link>
            <ThemeToggle />
          </div>
        </header>
        <main className="relative z-10 flex-1">{children}</main>
        <AskAiWorkspace />
      </div>
    </div>
  );
}
