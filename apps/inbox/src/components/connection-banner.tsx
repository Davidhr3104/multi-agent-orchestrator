"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Plug } from "lucide-react";

type Health = {
  claude: boolean;
  gmailConnected: boolean;
  oauthConfigured: boolean;
};

type Note = { id: string; title: string; text: string; href: string; label: string };

/**
 * Setup notes as a compact header chip instead of a permanent amber bar on every page.
 * Collapsed by default; opens a small panel with what is missing and the one-click fix.
 */
export function ConnectionBanner() {
  const [health, setHealth] = useState<Health | null>(null);
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);

  useEffect(() => {
    void fetch("/api/health")
      .then((r) => r.json())
      .then((d: Health) => setHealth(d))
      .catch(() => setHealth(null));
  }, []);

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (wrap.current && !wrap.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (!health) return null;

  const notes: Note[] = [];
  if (!health.claude) {
    notes.push({
      id: "claude",
      title: "Claude API key",
      text: "Not set. Drafts use the built-in local fallback until you add a key.",
      href: "/settings",
      label: "Add key",
    });
  }
  if (!health.gmailConnected) {
    notes.push({
      id: "gmail",
      title: "Gmail",
      text: health.oauthConfigured ? "Not connected. The desk is showing sample mail." : "Google sign-in is not configured yet, so the desk is showing sample mail.",
      href: health.oauthConfigured ? "/api/auth/gmail/start" : "/settings",
      label: health.oauthConfigured ? "Connect Gmail" : "Open settings",
    });
  }
  if (!notes.length) return null;

  return (
    <div ref={wrap} className="relative">
      <button
        type="button"
        aria-expanded={open}
        aria-controls="setup-notes"
        aria-label={`Setup notes: ${notes.length}`}
        onClick={() => setOpen((v) => !v)}
        className="inline-flex min-h-10 min-w-10 items-center justify-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 text-[11px] font-medium text-amber-700 hover:bg-amber-500/15 md:min-h-8 md:min-w-0 dark:text-amber-200"
      >
        <Plug className="size-4 md:size-3.5" aria-hidden />
        <span className="hidden lg:inline">Setup</span>
        <span className="rounded-full bg-amber-500/25 px-1.5 text-[10px] font-semibold tabular-nums">{notes.length}</span>
      </button>
      {open ? (
        <div id="setup-notes" role="region" aria-label="Setup notes" className="absolute top-12 right-0 z-50 w-[min(20rem,calc(100vw-1.5rem))] rounded-lg border border-border bg-surface p-3 text-xs shadow-xl dark:bg-[#120A24]">
          <p className="mb-2 font-semibold text-foreground">Finish setup to go live</p>
          <ul className="space-y-3">
            {notes.map((n) => (
              <li key={n.id}>
                <p className="font-medium text-foreground">{n.title}</p>
                <p className="mt-0.5 text-muted-foreground">{n.text}</p>
                <Link href={n.href} className="mt-1.5 inline-flex min-h-10 items-center rounded-md bg-amber-500 px-2.5 font-semibold text-black md:min-h-8" onClick={() => setOpen(false)}>
                  {n.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
