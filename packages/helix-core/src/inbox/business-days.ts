const TIME_ZONE = "America/New_York";

/** Returns the weekday index (0=Sun..6=Sat) for a Date, evaluated in US Eastern. */
function easternWeekday(date: Date): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: TIME_ZONE,
    weekday: "short",
  }).format(date);
  const map: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return map[parts] ?? 0;
}

/** Returns the US-Eastern calendar date (midnight UTC-normalized) for a Date, as a comparable key. */
function easternDateKey(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE }).format(date); // "YYYY-MM-DD"
}

/**
 * Number of US-Eastern business-day boundaries crossed between `from` and `to`.
 * Same Eastern calendar day (regardless of time) counts as 0. Weekends are not counted.
 */
export function businessDaysBetween(from: Date, to: Date): number {
  const fromKey = easternDateKey(from);
  let count = 0;
  const cursor = new Date(from.getTime());
  let cursorKey = fromKey;
  const toKey = easternDateKey(to);
  while (cursorKey !== toKey) {
    cursor.setUTCDate(cursor.getUTCDate() + 1);
    cursorKey = easternDateKey(cursor);
    const weekday = easternWeekday(cursor);
    if (weekday !== 0 && weekday !== 6) count += 1;
  }
  return count;
}

/** True once `lastReplySentAt` is at least 2 US-Eastern business days in the past. */
export function isOverdue(lastReplySentAt: string, now: Date = new Date()): boolean {
  return businessDaysBetween(new Date(lastReplySentAt), now) >= 2;
}
