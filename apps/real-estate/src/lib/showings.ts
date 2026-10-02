import type { Showing } from "./types";

export const MIN = 60_000;
export const DEFAULT_DURATION = 45;

export const DEFAULT_CHECKLIST = [
  "Confirm the time with the buyer",
  "Confirm access or keys with the owner",
  "Review the buyer's brief and budget",
  "Load the listing sheet",
  "Plan route and parking",
];

export const checklistFresh = () => DEFAULT_CHECKLIST.map((label) => ({ label, done: false }));

export const endsAt = (s: Pick<Showing, "startsAt" | "durationMin">) => Date.parse(s.startsAt) + s.durationMin * MIN;

/** Scheduled showings that overlap the given slot. The agent can only be in one place at a time. */
export function conflictsWith(all: Showing[], startsAt: string, durationMin: number, excludeId?: string): Showing[] {
  const a = Date.parse(startsAt);
  const b = a + durationMin * MIN;
  return all.filter((s) => s.id !== excludeId && s.status === "scheduled" && Date.parse(s.startsAt) < b && endsAt(s) > a);
}

/** The visit is over but nobody recorded how it went. */
export const needsFeedback = (s: Showing, now: number) => s.status === "scheduled" && endsAt(s) <= now;

export function startOfDay(t: number): Date {
  const d = new Date(t);
  d.setHours(0, 0, 0, 0);
  return d;
}

/** Monday 00:00 of the week containing t, shifted by `offset` weeks. */
export function weekStart(t: number, offset = 0): Date {
  const d = startOfDay(t);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7) + offset * 7);
  return d;
}

export const sameDay = (a: number, b: number) => startOfDay(a).getTime() === startOfDay(b).getTime();

const WEEKDAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

/**
 * Reads "today / tomorrow / friday ... at 5pm / 17:30" from a request. Returns null unless both a day and a
 * time are present, so Helix never guesses a slot the agent didn't say.
 */
export function parseWhen(text: string, now: number): Date | null {
  const q = text.toLowerCase();
  const time = q.match(/\bat\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b/) ?? q.match(/\b(\d{1,2}):(\d{2})\s*(am|pm)?\b/) ?? q.match(/\b(\d{1,2})\s*(am|pm)\b/);
  if (!time) return null;
  let h = Number(time[1]);
  const m = time[2] && /^\d{2}$/.test(time[2]) ? Number(time[2]) : 0;
  const ampm = time[3] ?? (time[2] && !/^\d{2}$/.test(time[2]) ? time[2] : undefined);
  if (ampm === "pm" && h < 12) h += 12;
  if (ampm === "am" && h === 12) h = 0;
  // "at 5" during a working day means 5 pm; nobody books a viewing at 5 am.
  if (!ampm && h >= 1 && h <= 7) h += 12;
  if (h > 23 || m > 59) return null;

  const d = startOfDay(now);
  if (/\btomorrow\b/.test(q)) d.setDate(d.getDate() + 1);
  else if (!/\btoday\b/.test(q)) {
    const wd = WEEKDAYS.findIndex((w) => q.includes(w));
    if (wd < 0) return null;
    d.setDate(d.getDate() + (((wd - d.getDay() + 7) % 7) || 7));
  }
  d.setHours(h, m, 0, 0);
  return d;
}
