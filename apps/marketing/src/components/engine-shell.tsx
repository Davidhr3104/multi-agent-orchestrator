"use client";

import type { ReactNode } from "react";
import { CircleHelp, Gauge, Settings } from "lucide-react";
import { cn } from "@/lib/utils";

type Nav = "engine" | "help" | "settings";

const ITEMS: { id: Nav; href: string; label: string; icon: typeof Gauge }[] = [
  { id: "engine", href: "/", label: "Performance Engine", icon: Gauge },
  { id: "help", href: "/help", label: "How to use", icon: CircleHelp },
  { id: "settings", href: "/settings", label: "Settings", icon: Settings },
];

export function EngineShell({
  active,
  children,
}: {
  active: Nav;
  children: ReactNode;
}) {
  return (
    <div className="relative flex min-h-full overflow-x-hidden text-[#F3F4F6]">
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 -z-10 overflow-hidden select-none"
      >
        <div className="absolute inset-0 bg-[#08090d]" />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/engine-aurora-orange.jpg"
          alt=""
          className="absolute inset-0 h-full w-full object-cover object-center"
          style={{ opacity: 0.38 }}
        />
      </div>

      <aside
        suppressHydrationWarning
        className="fixed inset-y-0 left-0 z-40 hidden w-60 flex-col border-r border-white/[0.08] bg-[#08090d]/55 backdrop-blur-xl md:flex"
      >
        <a href="/" className="flex h-16 items-center gap-2.5 border-b border-white/[0.08] px-4">
          <div className="flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-white/[0.14] bg-[#171F2C] p-0.5 shadow-inner">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/helix-for-marketing.png" alt="" className="h-full w-full object-contain" />
          </div>
          <div className="min-w-0 leading-tight">
            <p className="truncate text-[13px] font-semibold tracking-tight text-white">HELIX</p>
            <p className="truncate text-[11px] font-medium tracking-wide text-[#F97316]">for Marketing</p>
          </div>
        </a>

        <nav aria-label="Main" className="flex flex-1 flex-col gap-1 p-3">
          {ITEMS.map((item) => {
            const on = active === item.id;
            const Icon = item.icon;
            return (
              <a
                key={item.id}
                href={item.href}
                className={cn(
                  "flex items-center gap-2.5 rounded-md border-l-2 px-3 py-2 text-xs font-medium transition-colors",
                  on
                    ? "border-[#F97316] bg-[#F97316]/10 text-white"
                    : "border-transparent text-[#9CA3AF] hover:bg-white/[0.04] hover:text-white"
                )}
              >
                <Icon className={cn("size-4", on ? "text-[#F97316]" : "text-[#6B7280]")} />
                {item.label}
              </a>
            );
          })}
        </nav>

        <div className="space-y-3 border-t border-white/[0.08] p-3">
          <div className="flex items-center gap-2 rounded-lg border border-white/[0.08] bg-[#12151e]/90 px-2.5 py-2">
            <span className="size-2 shrink-0 rounded-full bg-[#3BAF7E]" />
            <span className="text-[11px] leading-snug font-medium text-[#9CA3AF]">
              Engine nominal · heuristic · ads APIs locked
            </span>
          </div>
          <div className="flex items-center gap-2.5 px-1">
            <div className="flex size-8 items-center justify-center rounded-full border border-[#F97316]/30 bg-[#F97316]/20 text-xs font-bold text-[#F97316] shadow-[0_0_12px_rgba(249,115,22,0.25)]">
              G
            </div>
            <div className="min-w-0">
              <p className="truncate text-xs font-medium text-white">Growth Team</p>
              <p className="font-mono text-[10px] text-[#6B7280]">CSV desk</p>
            </div>
          </div>
        </div>
      </aside>

      <div className="relative z-10 flex min-w-0 flex-1 flex-col md:ml-60">
        <header className="flex h-12 items-center justify-between gap-3 border-b border-white/[0.08] bg-[#08090d]/80 px-4 backdrop-blur-md md:hidden">
          <a href="/" className="flex items-center gap-2">
            <div className="flex size-7 items-center justify-center overflow-hidden rounded-md border border-white/[0.14] bg-[#171F2C] p-0.5">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/helix-for-marketing.png" alt="" className="h-full w-full object-contain" />
            </div>
            <span className="text-sm font-semibold text-white">Helix for Marketing</span>
          </a>
          <nav className="flex items-center gap-1" aria-label="Main">
            {ITEMS.map((item) => (
              <a
                key={item.id}
                href={item.href}
                className={cn(
                  "rounded-md px-2 py-1 text-[11px] font-medium",
                  active === item.id ? "bg-white/10 text-white" : "text-[#9CA3AF]"
                )}
              >
                {item.label === "Performance Engine" ? "Engine" : item.label}
              </a>
            ))}
          </nav>
        </header>

        <div className="relative z-10 flex-1">{children}</div>

        <footer className="relative z-10 mt-auto w-full border-t border-white/[0.08] py-4">
          <div className="flex flex-col items-center justify-between gap-2 px-6 text-xs text-[#6B7280] sm:flex-row lg:px-8">
            <div>© 2026 Helix Engine · High-density algorithmic marketing analytics</div>
            <div className="flex items-center gap-2">
              <span className="size-1.5 rounded-full bg-[#3BAF7E]" />
              <span className="font-mono text-[11px] text-[#9CA3AF]">SYSTEMS NOMINAL</span>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}
