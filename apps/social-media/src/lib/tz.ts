/**
 * One explicit zone for every slot on the desk. Server and browser used to format with their own local
 * zone, so the same post read 4:00 AM in one place and 9:00 AM in another (and caused hydration errors).
 * Everything that prints, buckets or builds a slot goes through these helpers instead of Date's local getters.
 */
export const DESK_TZ = "America/New_York";
export const DESK_TZ_LABEL = "ET";

const PARTS = new Intl.DateTimeFormat("en-US", {
  timeZone: DESK_TZ,
  hourCycle: "h23",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  weekday: "short",
});
const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export type ZoneParts = { year: number; month: number; day: number; hour: number; minute: number; dow: number };

export function zoneParts(input: Date | string | number): ZoneParts {
  const out: Record<string, string> = {};
  for (const part of PARTS.formatToParts(new Date(input))) out[part.type] = part.value;
  return {
    year: Number(out.year),
    month: Number(out.month),
    day: Number(out.day),
    hour: Number(out.hour) % 24,
    minute: Number(out.minute),
    dow: DOW.indexOf(out.weekday),
  };
}

/** The instant at which the desk's wall clock reads y-m-d h:min. `month` is 1-12. */
export function zonedTime(year: number, month: number, day: number, hour = 0, minute = 0): Date {
  const wanted = Date.UTC(year, month - 1, day, hour, minute);
  let guess = wanted;
  for (let i = 0; i < 3; i += 1) {
    const p = zoneParts(guess);
    guess += wanted - Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute);
  }
  return new Date(guess);
}

export function pad(n: number): string {
  return String(n).padStart(2, "0");
}

/** "2026-10-03" for the desk-zone calendar day of an instant. */
export function dayKey(input: Date | string | number): string {
  const p = zoneParts(input);
  return `${p.year}-${pad(p.month)}-${pad(p.day)}`;
}

export function parseDayKey(key: string): { year: number; month: number; day: number } {
  const [year, month, day] = key.split("-").map(Number);
  return { year, month, day };
}

/** Pure calendar arithmetic on day keys (no zone, no DST). */
export function addDaysKey(key: string, count: number): string {
  const { year, month, day } = parseDayKey(key);
  const d = new Date(Date.UTC(year, month - 1, day + count));
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

/** 0 = Sunday. */
export function dowOfKey(key: string): number {
  const { year, month, day } = parseDayKey(key);
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}

/** Midnight at the start of the desk-zone day. */
export function startOfZonedDay(input: Date | string | number = new Date()): Date {
  const p = zoneParts(input);
  return zonedTime(p.year, p.month, p.day, 0, 0);
}

/** Same wall-clock time, `count` desk-zone days later (optionally at a new hour). */
export function addZonedDays(input: Date | string | number, count: number, hour?: number): Date {
  const p = zoneParts(input);
  const key = addDaysKey(`${p.year}-${pad(p.month)}-${pad(p.day)}`, count);
  const d = parseDayKey(key);
  return zonedTime(d.year, d.month, d.day, hour ?? p.hour, hour === undefined ? p.minute : 0);
}

export function keyToDate(key: string, hour = 12): Date {
  const d = parseDayKey(key);
  return zonedTime(d.year, d.month, d.day, hour, 0);
}

export function formatKey(key: string, opts: Intl.DateTimeFormatOptions): string {
  return keyToDate(key).toLocaleDateString("en-US", { ...opts, timeZone: DESK_TZ });
}

export function formatTime(input: Date | string | number): string {
  return new Date(input).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: DESK_TZ });
}
