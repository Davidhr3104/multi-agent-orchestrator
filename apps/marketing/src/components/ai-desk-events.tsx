"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Makes a dashboard react when Helix AI changes data: refetches, flashes the touched rows, and
 * shows what happened. Rows opt in with `data-ai-id={record.id}`; the drawer dispatches
 * `helix:ai-action` ({ message, ids }) and `helix:desk-refresh`.
 */
export function useAiDeskEvents(refresh: () => void | Promise<void>) {
  const [toast, setToast] = useState<string | null>(null);
  const refreshRef = useRef(refresh);
  refreshRef.current = refresh;

  useEffect(() => {
    let toastTimer: number | undefined;

    function onRefresh() {
      void refreshRef.current();
    }

    function onAction(e: Event) {
      const { message, ids } = (e as CustomEvent<{ message: string; ids: string[] }>).detail;
      setToast(message);
      window.clearTimeout(toastTimer);
      toastTimer = window.setTimeout(() => setToast(null), 3800);
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

  return { toast };
}

export function AiToast({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <div
      role="status"
      className="fixed bottom-4 left-1/2 z-[60] -translate-x-1/2 rounded-lg border border-white/15 bg-black/85 px-4 py-2 text-sm text-white shadow-lg backdrop-blur"
    >
      {message}
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
    <div className="flex flex-wrap items-center gap-3 rounded-lg border border-white/15 bg-white/[0.06] px-4 py-2.5 text-xs text-slate-200">
      <span className="rounded-full bg-white/90 px-2 py-0.5 text-[11px] font-bold tracking-wider text-black uppercase">Demo data</span>
      <p className="min-w-0 flex-1 text-slate-300">{message}</p>
      {error ? <span className="text-rose-400">{error}</span> : null}
      <button type="button" disabled={busy} onClick={() => void post("demo")} className="rounded-md border border-white/20 px-2.5 py-1 font-semibold hover:bg-white/10 disabled:opacity-50">
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
