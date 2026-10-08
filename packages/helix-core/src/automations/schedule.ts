import type { AutomationSpec } from "./types";

export function parseClock(value: string): { hour: number; minute: number } | null {
  const m = /^(\d{2}):(\d{2})$/.exec(value.trim());
  if (!m) return null;
  const hour = Number(m[1]);
  const minute = Number(m[2]);
  if (hour > 23 || minute > 59) return null;
  return { hour, minute };
}

export function isValidTimeZone(tz: string | null | undefined): boolean {
  if (!tz || !tz.trim()) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/** Offset of `tz` from UTC at the instant `utcMs`, in ms (UTC-6 => -21_600_000). */
function tzOffsetMs(utcMs: number, tz: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(new Date(utcMs));
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  return asUtc - Math.floor(utcMs / 1000) * 1000;
}

function localDate(utcMs: number, tz: string): { y: number; m: number; d: number } {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date(utcMs));
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  return { y: get("year"), m: get("month"), d: get("day") };
}

/** The UTC instant at which the wall clock in `tz` reads y-m-d hh:mm. Two passes handle a DST boundary. */
function zonedToUtc(y: number, m: number, d: number, hour: number, minute: number, tz: string): number {
  const guess = Date.UTC(y, m - 1, d, hour, minute, 0);
  const first = guess - tzOffsetMs(guess, tz);
  const second = guess - tzOffsetMs(first, tz);
  return second;
}

function shiftDay(date: { y: number; m: number; d: number }, days: number): { y: number; m: number; d: number } {
  const t = new Date(Date.UTC(date.y, date.m - 1, date.d + days));
  return { y: t.getUTCFullYear(), m: t.getUTCMonth() + 1, d: t.getUTCDate() };
}

function clockOrThrow(time: string): { hour: number; minute: number } {
  const c = parseClock(time);
  if (!c) throw new Error(`Invalid time of day "${time}" (expected HH:MM).`);
  return c;
}

/** The most recent scheduled run at or before `now`. */
export function lastDailyRun(time: string, tz: string, now: Date): Date {
  const { hour, minute } = clockOrThrow(time);
  const today = localDate(now.getTime(), tz);
  const candidate = zonedToUtc(today.y, today.m, today.d, hour, minute, tz);
  if (candidate <= now.getTime()) return new Date(candidate);
  const y = shiftDay(today, -1);
  return new Date(zonedToUtc(y.y, y.m, y.d, hour, minute, tz));
}

/** The first scheduled run strictly after `now`. */
export function nextDailyRun(time: string, tz: string, now: Date): Date {
  const { hour, minute } = clockOrThrow(time);
  const today = localDate(now.getTime(), tz);
  const candidate = zonedToUtc(today.y, today.m, today.d, hour, minute, tz);
  if (candidate > now.getTime()) return new Date(candidate);
  const t = shiftDay(today, 1);
  return new Date(zonedToUtc(t.y, t.m, t.d, hour, minute, tz));
}

export function runKey(automationId: string, scheduledForIso: string): string {
  return `${automationId}@${scheduledForIso}`;
}

export const DEFAULT_CATCHUP_MS = 3 * 3_600_000;

export type DueRun = { key: string; scheduledFor: string; state: "due" | "expired" };

/**
 * Whether a scheduled run is owed right now. Pure and idempotent: the same `doneKeys` set means the same
 * run is never owed twice. A run missed by more than the catch-up window is "expired" so the caller records
 * it as skipped, visibly, instead of sending yesterday's 9 pm summary at 3 am.
 */
export function dueRun(spec: AutomationSpec, doneKeys: ReadonlySet<string>, now: Date, catchupMs = DEFAULT_CATCHUP_MS): DueRun | null {
  if (spec.status !== "active" || spec.trigger.kind !== "daily") return null;
  const last = lastDailyRun(spec.trigger.time, spec.trigger.tz, now);
  const scheduledFor = last.toISOString();
  const key = runKey(spec.id, scheduledFor);
  if (doneKeys.has(key)) return null;
  return { key, scheduledFor, state: now.getTime() - last.getTime() > catchupMs ? "expired" : "due" };
}
