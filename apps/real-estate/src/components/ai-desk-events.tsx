"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Makes a dashboard react when Helix AI changes data: refetches, flashes the touched rows, and
 * shows what happened. Rows opt in with `data-ai-id={record.id}`; the drawer dispatches
 * `helix:ai-action` ({ message, ids }) and `helix:desk-refresh`.
 */
export function useAiDeskEvents(refresh: () => void | Promise<void>) {
  const [toast, setToast] = useState<string | null>(null);
  const [undo, setUndo] = useState<unknown[] | null>(null);
  const refreshRef = useRef(refresh);
  refreshRef.current = refresh;

  useEffect(() => {
    let toastTimer: number | undefined;

    function onRefresh() {
      void refreshRef.current();
    }

    function onAction(e: Event) {
      const { message, ids, undo: entries } = (e as CustomEvent<{ message: string; ids: string[]; undo?: unknown[] }>).detail;
      setToast(message);
      setUndo(entries?.length ? entries : null);
      window.clearTimeout(toastTimer);
      toastTimer = window.setTimeout(
        () => {
          setToast(null);
          setUndo(null);
        },
        entries?.length ? 8000 : 3800
      );
      // Rows re-render after the refetch; wait a beat so the flash lands on the fresh elements.
      window.setTimeout(() => {
        for (const id of ids) {
          document.querySelectorAll<HTMLElement>(`[data-ai-id="${CSS.escape(id)}"]`).forEach((el) => {
            el.classList.remove("ai-flash");
            void el.offsetWidth; // restart the animation if it is already running
            el.classList.add("ai-flash");
            window.setTimeout(() => el.classList.remove("ai-flash"), 3500);
          });
        }
      }, 450);
    }

    window.addEventListener("helix:desk-refresh", onRefresh);
    window.addEventListener("helix:ai-action", onAction);
    return () => {
      window.removeEventListener("helix:desk-refresh", onRefresh);
      window.removeEventListener("helix:ai-action", onAction);
      window.clearTimeout(toastTimer);
    };
  }, []);

  return { toast, undo };
}

/** Reverts a button-run action with the snapshots the server returned for it. */
async function runUndo(entries: unknown[]) {
  const res = await fetch("/api/ask-ai/execute", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "restore", entries }) });
  const body = (await res.json().catch(() => null)) as { done?: string[]; failed?: { error: string }[]; error?: string } | null;
  const message = res.ok && body?.done?.length ? "Undone." : `Couldn't undo: ${body?.failed?.[0]?.error ?? body?.error ?? "request failed"}.`;
  window.dispatchEvent(new CustomEvent("helix:ai-action", { detail: { message, ids: body?.done ?? [] } }));
  window.dispatchEvent(new CustomEvent("helix:desk-refresh"));
}

/** Toasts for things that aren't desk actions (copied text, downloads). Same look and slot as action toasts. */
export function notify(message: string) {
  window.dispatchEvent(new CustomEvent("helix:ai-action", { detail: { message, ids: [] } }));
}

export function AiToast({ message, undo }: { message: string | null; undo?: unknown[] | null }) {
  if (!message) return null;
  const failed = /^(couldn't|could not|failed|error)/i.test(message);
  return (
    <div
      key={message}
      role="status"
      className="fixed right-4 bottom-4 z-[60] flex max-w-[min(26rem,calc(100vw-2rem))] items-start gap-3 rounded-xl border border-white/10 bg-slate-950/90 py-3 pr-3 pl-3.5 text-sm text-white shadow-2xl shadow-black/40 backdrop-blur-md animate-in fade-in-0 slide-in-from-bottom-3 duration-300"
    >
      <span className={`mt-0.5 inline-flex size-5 shrink-0 items-center justify-center rounded-full ${failed ? "bg-rose-500/20 text-rose-300" : "bg-emerald-500/20 text-emerald-300"}`} aria-hidden>
        {failed ? (
          <svg viewBox="0 0 16 16" className="size-3" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round">
            <path d="M4 4l8 8M12 4l-8 8" />
          </svg>
        ) : (
          <svg viewBox="0 0 16 16" className="size-3" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 8.5l3.2 3L13 5" />
          </svg>
        )}
      </span>
      <span className="min-w-0 flex-1 leading-snug">{message}</span>
      {undo?.length ? (
        <button
          type="button"
          onClick={() => void runUndo(undo)}
          className="shrink-0 rounded-md border border-white/25 px-2.5 py-1 text-xs font-semibold hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        >
          Undo
        </button>
      ) : null}
    </div>
  );
}

type DeskStatus = { mode?: "demo" | "live" };

/**
 * Shown only while the desk is on demo data. Connecting the integration (or choosing "use my own data")
 * switches the desk to live and the sample records disappear.
 */
export function DemoBanner({
  message,
  connectLabel,
  connectHref,
  ownDataLabel,
}: {
  message: string;
  connectLabel?: string;
  connectHref?: string;
  /** For desks with no integration to connect: a button that leaves the demo for good. */
  ownDataLabel?: string;
}) {
  const [mode, setMode] = useState<"demo" | "live" | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    try {
      const res = await fetch("/api/settings/desk");
      if (res.ok) setMode(((await res.json()) as DeskStatus).mode ?? null);
    } catch {
      setMode(null);
    }
  }

  useEffect(() => {
    void load();
    const onRefresh = () => void load();
    window.addEventListener("helix:desk-refresh", onRefresh);
    return () => window.removeEventListener("helix:desk-refresh", onRefresh);
  }, []);

  async function post(action: "demo" | "empty") {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/settings/desk", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action }) });
      if (!res.ok) throw new Error(((await res.json().catch(() => null)) as { error?: string } | null)?.error ?? `Request failed (${res.status})`);
      await load();
      window.dispatchEvent(new CustomEvent("helix:desk-refresh"));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed");
    } finally {
      setBusy(false);
    }
  }

  if (mode !== "demo") return null;
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl bg-muted/60 px-4 py-2.5 text-xs text-foreground ring-1 ring-border/60">
      <span className="rounded-full bg-foreground px-2 py-0.5 text-[10px] font-bold tracking-wider text-background uppercase">Demo data</span>
      <p className="min-w-0 flex-1 text-muted-foreground">{message}</p>
      {error ? <span className="text-rose-400">{error}</span> : null}
      <button type="button" disabled={busy} onClick={() => void post("demo")} className="rounded-md border border-border px-2.5 py-1 font-semibold hover:bg-accent disabled:opacity-50">
        Reset demo
      </button>
      {connectHref ? (
        <a href={connectHref} className="rounded-md bg-white px-2.5 py-1 font-bold text-black hover:brightness-90">
          {connectLabel ?? "Connect →"}
        </a>
      ) : null}
      {ownDataLabel ? (
        <button type="button" disabled={busy} onClick={() => void post("empty")} className="rounded-md bg-white px-2.5 py-1 font-bold text-black hover:brightness-90 disabled:opacity-50">
          {ownDataLabel}
        </button>
      ) : null}
    </div>
  );
}
