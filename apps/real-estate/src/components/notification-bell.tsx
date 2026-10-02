"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { Bell, CalendarClock, Handshake, MessageSquareWarning, Send, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export type DeskNotice = { id: string; href: string; title: string; detail: string; count: number; kind: "showing" | "feedback" | "draft" | "seller" };

const ICON: Record<DeskNotice["kind"], LucideIcon> = { showing: CalendarClock, feedback: MessageSquareWarning, draft: Send, seller: Handshake };
const TONE: Record<DeskNotice["kind"], string> = {
  showing: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-300",
  feedback: "bg-sky-500/15 text-sky-600 dark:text-sky-300",
  draft: "bg-primary/15 text-primary",
  seller: "bg-violet-500/15 text-violet-600 dark:text-violet-300",
};

/** Counted from the desk on every page load — showings, feedback, drafts and prospects that need a person. */
export function NotificationBell({ notices, align = "left" }: { notices: DeskNotice[]; align?: "left" | "right" }) {
  const [pos, setPos] = useState<{ top: number; left?: number; right?: number } | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const live = notices.filter((n) => n.count > 0);
  const total = live.reduce((s, n) => s + n.count, 0);
  const open = pos !== null;
  const setOpen = (next: boolean) => {
    const r = ref.current?.getBoundingClientRect();
    if (!next || !r) return setPos(null);
    setPos(align === "left" ? { top: r.bottom + 8, left: r.left } : { top: r.bottom + 8, right: window.innerWidth - r.right });
  };

  useEffect(() => {
    if (!open) return;
    const close = () => setPos(null);
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (!ref.current?.contains(t) && !panelRef.current?.contains(t)) close();
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    window.addEventListener("resize", close);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", close);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="true"
        aria-label={total ? `Notifications, ${total} need you` : "Notifications, nothing pending"}
        onClick={() => setOpen(!open)}
        className="relative inline-flex size-9 cursor-pointer items-center justify-center rounded-lg text-muted-foreground transition hover:bg-sidebar-accent/60 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
      >
        <Bell className="size-[18px]" aria-hidden />
        {total ? (
          <span className="tabular absolute -top-0.5 -right-0.5 inline-flex min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 font-mono text-[10px] font-semibold text-white ring-2 ring-sidebar">
            {total > 99 ? "99+" : total}
          </span>
        ) : null}
      </button>
      {pos ? createPortal(
        <div
          ref={panelRef}
          role="dialog"
          aria-label="Notifications"
          style={pos}
          className="glass-panel fixed z-[60] w-80 max-w-[calc(100vw-2rem)] overflow-hidden rounded-xl text-sm animate-in fade-in-0 slide-in-from-top-1"
        >
          <p className="border-b border-border/60 px-4 py-2.5 text-xs font-semibold tracking-wider text-muted-foreground uppercase">Needs you</p>
          {live.length === 0 ? (
            <p className="px-4 py-6 text-center text-xs text-muted-foreground">You&apos;re all caught up.</p>
          ) : (
            <ul className="max-h-80 divide-y divide-border/60 overflow-y-auto">
              {live.map((n) => {
                const Icon = ICON[n.kind];
                return (
                  <li key={n.id}>
                    <Link href={n.href} onClick={() => setOpen(false)} className="flex items-start gap-3 px-4 py-3 transition hover:bg-accent/50 focus-visible:bg-accent/50 focus-visible:outline-none">
                      <span className={cn("inline-flex size-8 shrink-0 items-center justify-center rounded-lg", TONE[n.kind])}>
                        <Icon className="size-4" aria-hidden />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block font-semibold text-foreground">{n.title}</span>
                        <span className="block text-xs text-muted-foreground">{n.detail}</span>
                      </span>
                      <span className="tabular rounded-full bg-muted px-2 py-0.5 font-mono text-[11px] text-foreground">{n.count}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
          <p className="border-t border-border/60 px-4 py-2 text-[11px] text-muted-foreground">Counted from your desk. Helix doesn&apos;t send anything for you.</p>
        </div>,
        document.body
      ) : null}
    </div>
  );
}
