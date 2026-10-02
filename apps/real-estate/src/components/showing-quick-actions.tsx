"use client";

import { useState, type FormEvent } from "react";
import { CalendarClock, CalendarX2, Download } from "lucide-react";
import { runDeskAction } from "@/lib/desk-client";
import { cn } from "@/lib/utils";

const BTN = "inline-flex min-h-8 cursor-pointer items-center gap-1.5 rounded-lg px-2.5 text-xs font-semibold ring-1 transition focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:opacity-50";

const localInput = (iso: string) => {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

/** Move, cancel or export one showing in place. Moving or cancelling tells nobody — the toast says so. */
export function ShowingQuickActions({ id, label, startsAt }: { id: string; label: string; startsAt: string }) {
  const [moving, setMoving] = useState(false);
  const [when, setWhen] = useState(() => localInput(new Date(Date.parse(startsAt) + 86_400_000).toISOString()));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(action: "reschedule_showing" | "cancel_showing", params?: Record<string, unknown>) {
    setBusy(true);
    setError(null);
    try {
      await runDeskAction({ action, targetIds: [id], labels: [label], params });
      setMoving(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Request failed");
    } finally {
      setBusy(false);
    }
  }

  function move(e: FormEvent) {
    e.preventDefault();
    const t = new Date(when);
    if (Number.isNaN(t.getTime())) return;
    void run("reschedule_showing", { startsAt: t.toISOString() });
  }

  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap gap-1.5">
        <button type="button" disabled={busy} onClick={() => setMoving((m) => !m)} aria-expanded={moving} className={cn(BTN, "text-foreground ring-border hover:bg-accent")}>
          <CalendarClock className="size-3.5" aria-hidden /> Move
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => window.confirm(`Cancel ${label}? Nobody is notified — tell the buyer yourself.`) && void run("cancel_showing")}
          className={cn(BTN, "text-rose-300 ring-rose-400/30 hover:bg-rose-400/10")}
        >
          <CalendarX2 className="size-3.5" aria-hidden /> Cancel
        </button>
        <a href={`/api/calendar/ics?id=${encodeURIComponent(id)}`} className={cn(BTN, "text-muted-foreground ring-border hover:text-foreground")} title="Download an .ics file to add this showing to Google or Outlook by hand">
          <Download className="size-3.5" aria-hidden /> .ics
        </a>
      </div>
      {moving ? (
        <form onSubmit={move} className="flex flex-wrap items-center gap-1.5">
          <label className="sr-only" htmlFor={`move-${id}`}>
            New date and time
          </label>
          <input
            id={`move-${id}`}
            type="datetime-local"
            value={when}
            onChange={(e) => setWhen(e.target.value)}
            className="h-8 rounded-md border border-input bg-background/60 px-2 text-xs text-foreground focus:border-primary focus:outline-none"
          />
          <button type="submit" disabled={busy} className="h-8 rounded-md bg-primary px-2.5 text-xs font-semibold text-primary-foreground disabled:opacity-50">
            {busy ? "Moving…" : "Save"}
          </button>
        </form>
      ) : null}
      {error ? (
        <p role="alert" className="text-[11px] text-rose-400">
          {error}
        </p>
      ) : null}
    </div>
  );
}
