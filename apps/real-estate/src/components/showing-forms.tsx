"use client";

import { useMemo, useState, type FormEvent } from "react";
import { CalendarPlus, Check, Clock, Save, UserX } from "lucide-react";
import { DeskActionButton } from "@/components/desk-action-button";
import { runDeskAction } from "@/lib/desk-client";
import { cn } from "@/lib/utils";
import { COMMON_OBJECTIONS, INTEREST_LEVELS, type Interest } from "@/lib/types";

const field = "h-10 w-full rounded-lg border border-input bg-background/60 px-3 text-sm text-foreground focus:border-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-ring";
const label = "text-[11px] font-semibold tracking-wider text-muted-foreground uppercase";
const primary =
  "inline-flex min-h-10 cursor-pointer items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground transition hover:brightness-110 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50";

/** Local wall-clock date + time from the inputs, sent as an absolute instant. */
const toIso = (date: string, time: string) => new Date(`${date}T${time}`).toISOString();

type LeadOption = { id: string; name: string };
type PropOption = { id: string; title: string; zone: string; price: number };

export function ScheduleShowingForm({
  leads,
  properties,
  bestFor,
  initialLead,
  defaultDate,
}: {
  leads: LeadOption[];
  properties: PropOption[];
  /** Property ids per lead, best fit first. */
  bestFor: Record<string, { id: string; fit: number }[]>;
  initialLead?: string;
  defaultDate: string;
}) {
  const [leadId, setLeadId] = useState(initialLead && leads.some((l) => l.id === initialLead) ? initialLead : "");
  const [propertyId, setPropertyId] = useState(() => (initialLead ? bestFor[initialLead]?.[0]?.id ?? "" : ""));
  const [date, setDate] = useState(defaultDate);
  const [time, setTime] = useState("17:00");
  const [duration, setDuration] = useState(45);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ordered = useMemo(() => {
    const fits = new Map((bestFor[leadId] ?? []).map((f) => [f.id, f.fit]));
    return [...properties].sort((a, b) => (fits.get(b.id) ?? -1) - (fits.get(a.id) ?? -1));
  }, [bestFor, leadId, properties]);
  const fitOf = (id: string) => bestFor[leadId]?.find((f) => f.id === id)?.fit;

  function pickLead(id: string) {
    setLeadId(id);
    setPropertyId(bestFor[id]?.[0]?.id ?? "");
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    const lead = leads.find((l) => l.id === leadId);
    if (!lead || !propertyId) return setError("Pick a buyer and a listing.");
    setBusy(true);
    setError(null);
    try {
      await runDeskAction({ action: "schedule_showing", targetIds: [leadId], labels: [lead.name], params: { propertyId, startsAt: toIso(date, time), durationMin: duration } });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="grid gap-3 sm:grid-cols-2 xl:grid-cols-[1.2fr_1.6fr_1fr_0.8fr_0.8fr_auto] xl:items-end">
      <label className="space-y-1">
        <span className={label}>Buyer</span>
        <select value={leadId} onChange={(e) => pickLead(e.target.value)} className={field} required>
          <option value="">Choose a buyer…</option>
          {leads.map((l) => (
            <option key={l.id} value={l.id}>
              {l.name}
            </option>
          ))}
        </select>
      </label>
      <label className="space-y-1">
        <span className={label}>Listing</span>
        <select value={propertyId} onChange={(e) => setPropertyId(e.target.value)} className={field} required>
          <option value="">Choose a listing…</option>
          {ordered.map((p) => {
            const fit = fitOf(p.id);
            return (
              <option key={p.id} value={p.id}>
                {p.title} · {p.zone}
                {fit !== undefined ? ` · fit ${fit}` : ""}
              </option>
            );
          })}
        </select>
      </label>
      <label className="space-y-1">
        <span className={label}>Date</span>
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={field} required />
      </label>
      <label className="space-y-1">
        <span className={label}>Time</span>
        <input type="time" value={time} step={900} onChange={(e) => setTime(e.target.value)} className={field} required />
      </label>
      <label className="space-y-1">
        <span className={label}>Length</span>
        <select value={duration} onChange={(e) => setDuration(Number(e.target.value))} className={field}>
          {[30, 45, 60, 90].map((m) => (
            <option key={m} value={m}>
              {m} min
            </option>
          ))}
        </select>
      </label>
      <button type="submit" disabled={busy} className={primary}>
        <CalendarPlus className="size-4" aria-hidden /> {busy ? "Booking…" : "Book showing"}
      </button>
      {error ? (
        <p role="alert" className="text-xs text-rose-400 sm:col-span-2 xl:col-span-6">
          {error}
        </p>
      ) : null}
    </form>
  );
}

export function Checklist({ showingId, label: who, items, editable }: { showingId: string; label: string; items: { label: string; done: boolean }[]; editable: boolean }) {
  const [busy, setBusy] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function toggle(index: number) {
    setBusy(index);
    setError(null);
    try {
      await runDeskAction({ action: "toggle_checklist", targetIds: [showingId], labels: [who], params: { index } });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div>
      <ul className="space-y-1.5">
        {items.map((c, i) => (
          <li key={c.label}>
            <button
              type="button"
              role="checkbox"
              aria-checked={c.done}
              disabled={!editable || busy !== null}
              onClick={() => void toggle(i)}
              className="flex min-h-9 w-full cursor-pointer items-center gap-3 rounded-lg px-2 text-left text-sm transition hover:bg-accent/50 disabled:cursor-default disabled:hover:bg-transparent"
            >
              <span className={cn("inline-flex size-5 shrink-0 items-center justify-center rounded-md border", c.done ? "border-primary bg-primary text-primary-foreground" : "border-border")}>
                {c.done ? <Check className="size-3.5" aria-hidden /> : null}
              </span>
              <span className={c.done ? "text-muted-foreground line-through" : "text-foreground"}>{c.label}</span>
            </button>
          </li>
        ))}
      </ul>
      {error ? (
        <p role="alert" className="mt-2 text-xs text-rose-400">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function RescheduleControls({ showingId, label: who, date: d0, time: t0 }: { showingId: string; label: string; date: string; time: string }) {
  const [date, setDate] = useState(d0);
  const [time, setTime] = useState(t0);
  const changed = date !== d0 || time !== t0;
  return (
    <div className="flex flex-wrap items-end gap-2">
      <label className="space-y-1">
        <span className={label}>Date</span>
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={cn(field, "w-40")} />
      </label>
      <label className="space-y-1">
        <span className={label}>Time</span>
        <input type="time" value={time} step={900} onChange={(e) => setTime(e.target.value)} className={cn(field, "w-32")} />
      </label>
      <DeskActionButton action="reschedule_showing" targetIds={changed ? [showingId] : []} labels={[who]} params={{ startsAt: date && time ? toIso(date, time) : "" }} busyLabel="Moving…">
        <Clock className="size-4" aria-hidden /> Move
      </DeskActionButton>
      <DeskActionButton action="cancel_showing" targetIds={[showingId]} labels={[who]} variant="danger" busyLabel="Cancelling…" confirm="Cancel this showing? Nobody is notified automatically.">
        Cancel showing
      </DeskActionButton>
    </div>
  );
}

const INTEREST_LABEL: Record<Interest, string> = { high: "High — wants to move forward", medium: "Medium — interested, has doubts", low: "Low — probably not", none: "None — not for them" };

export function FeedbackForm({ showingId, label: who, started }: { showingId: string; label: string; started: boolean }) {
  const [interest, setInterest] = useState<Interest | "">("");
  const [objections, setObjections] = useState<string[]>([]);
  const [other, setOther] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggle = (o: string) => setObjections((xs) => (xs.includes(o) ? xs.filter((x) => x !== o) : [...xs, o]));

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!interest) return setError("How interested was the buyer?");
    setBusy(true);
    setError(null);
    try {
      const all = other.trim() ? [...objections, ...other.split(",").map((s) => s.trim())] : objections;
      await runDeskAction({ action: "record_feedback", targetIds: [showingId], labels: [who], params: { interest, objections: all, notes } });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed");
    } finally {
      setBusy(false);
    }
  }

  if (!started) return <p className="text-sm text-muted-foreground">Feedback opens once the showing has started.</p>;

  return (
    <form onSubmit={submit} className="space-y-4">
      <fieldset className="space-y-2">
        <legend className={label}>Interest</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {INTEREST_LEVELS.map((lvl) => (
            <label
              key={lvl}
              className={cn(
                "flex min-h-10 cursor-pointer items-center gap-2 rounded-lg border px-3 text-sm transition",
                interest === lvl ? "border-primary/60 bg-primary/10 text-foreground" : "border-border text-muted-foreground hover:text-foreground"
              )}
            >
              <input type="radio" name="interest" value={lvl} checked={interest === lvl} onChange={() => setInterest(lvl)} className="accent-[var(--primary)]" />
              {INTEREST_LABEL[lvl]}
            </label>
          ))}
        </div>
      </fieldset>
      <fieldset className="space-y-2">
        <legend className={label}>Objections</legend>
        <div className="flex flex-wrap gap-2">
          {COMMON_OBJECTIONS.map((o) => (
            <button
              key={o}
              type="button"
              aria-pressed={objections.includes(o)}
              onClick={() => toggle(o)}
              className={cn(
                "min-h-8 cursor-pointer rounded-full border px-3 text-xs transition",
                objections.includes(o) ? "border-amber-400/50 bg-amber-400/10 text-amber-200" : "border-border text-muted-foreground hover:text-foreground"
              )}
            >
              {o}
            </button>
          ))}
        </div>
        <input value={other} onChange={(e) => setOther(e.target.value)} placeholder="Other objections, comma separated" maxLength={120} className={field} />
      </fieldset>
      <label className="block space-y-1">
        <span className={label}>Notes</span>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          maxLength={1000}
          placeholder="What they liked, what they asked, what to send next."
          className="w-full rounded-lg border border-input bg-background/60 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
        />
      </label>
      <div className="flex flex-wrap items-start gap-2">
        <button type="submit" disabled={busy} className={primary}>
          <Save className="size-4" aria-hidden /> {busy ? "Saving…" : "Save feedback"}
        </button>
        <DeskActionButton action="record_feedback" targetIds={[showingId]} labels={[who]} params={{ noShow: true }} variant="ghost" busyLabel="Saving…" confirm="Mark this showing as a no-show?">
          <UserX className="size-4" aria-hidden /> Buyer didn&apos;t show
        </DeskActionButton>
      </div>
      {error ? (
        <p role="alert" className="text-xs text-rose-400">
          {error}
        </p>
      ) : null}
    </form>
  );
}
