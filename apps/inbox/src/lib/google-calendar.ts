import { getSecret } from "@helix/core";
import { getValidGmailAccessToken } from "@/lib/gmail-oauth";
import type { AgendaMeeting } from "@/lib/showing-schedule";

/**
 * Google Calendar (read-only) on top of the same Google OAuth grant as Gmail.
 * Mailboxes connected before the calendar scope was added get a 403 here; we say "reconnect"
 * instead of showing an empty calendar.
 */

const EVENTS_URL = "https://www.googleapis.com/calendar/v3/calendars/primary/events";
export const DEFAULT_CALENDAR_TIMEZONE = "America/Mexico_City";

export type CalendarAttendee = { email: string; name?: string; responseStatus?: string; self?: boolean; organizer?: boolean };

export type GoogleCalendarEvent = {
  id: string;
  title: string;
  start: string;
  end: string;
  allDay: boolean;
  /** For all-day events: inclusive start / exclusive end dates (YYYY-MM-DD) in the calendar's zone. */
  startDate?: string;
  endDate?: string;
  /** False when the event is marked "free" or the owner declined it. */
  busy: boolean;
  location: string;
  htmlLink: string;
  organizerEmail: string;
  attendees: CalendarAttendee[];
};

export type GoogleCalendarResult =
  | { ok: true; timeZone: string; events: GoogleCalendarEvent[] }
  | { ok: false; error: string; needsReconnect: boolean };

type RawDate = { dateTime?: string; date?: string; timeZone?: string };
type RawEvent = {
  id?: string;
  status?: string;
  summary?: string;
  start?: RawDate;
  end?: RawDate;
  transparency?: string;
  location?: string;
  htmlLink?: string;
  hangoutLink?: string;
  organizer?: { email?: string };
  attendees?: Array<{ email?: string; displayName?: string; responseStatus?: string; self?: boolean; organizer?: boolean }>;
};

export function calendarTimeZone(fromApi?: string): string {
  return fromApi || getSecret("HELIX_INBOX_TIMEZONE") || DEFAULT_CALENDAR_TIMEZONE;
}

export function normalizeGoogleEvent(raw: RawEvent): GoogleCalendarEvent | null {
  if (!raw.id || raw.status === "cancelled") return null;
  const allDay = Boolean(raw.start?.date && !raw.start?.dateTime);
  const start = raw.start?.dateTime ?? (raw.start?.date ? `${raw.start.date}T00:00:00.000Z` : "");
  const end = raw.end?.dateTime ?? (raw.end?.date ? `${raw.end.date}T00:00:00.000Z` : start);
  if (!start || Number.isNaN(Date.parse(start))) return null;
  const attendees: CalendarAttendee[] = (raw.attendees ?? [])
    .filter((a) => a.email)
    .map((a) => ({ email: a.email!.toLowerCase(), name: a.displayName, responseStatus: a.responseStatus, self: a.self, organizer: a.organizer }));
  const declinedBySelf = attendees.some((a) => a.self && a.responseStatus === "declined");
  return {
    id: raw.id,
    title: raw.summary?.trim() || "(sin título)",
    start: new Date(start).toISOString(),
    end: new Date(end).toISOString(),
    allDay,
    startDate: allDay ? raw.start?.date : undefined,
    endDate: allDay ? raw.end?.date : undefined,
    busy: raw.transparency !== "transparent" && !declinedBySelf,
    location: raw.location || (raw.hangoutLink ? "Google Meet" : ""),
    htmlLink: raw.hangoutLink || raw.htmlLink || "https://calendar.google.com",
    organizerEmail: raw.organizer?.email?.toLowerCase() ?? "",
    attendees,
  };
}

export async function fetchGoogleCalendarEvents(
  token: string,
  opts: { timeMin: Date; timeMax: Date; maxResults?: number }
): Promise<GoogleCalendarResult> {
  const params = new URLSearchParams({
    singleEvents: "true",
    orderBy: "startTime",
    timeMin: opts.timeMin.toISOString(),
    timeMax: opts.timeMax.toISOString(),
    maxResults: String(opts.maxResults ?? 100),
  });
  let res: Response;
  try {
    res = await fetch(`${EVENTS_URL}?${params.toString()}`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(10_000),
    });
  } catch (err) {
    return { ok: false, error: `Google Calendar no respondió: ${err instanceof Error ? err.message : String(err)}`, needsReconnect: false };
  }
  if (res.status === 401 || res.status === 403) {
    return {
      ok: false,
      error: "Google no dio acceso al calendario. Reconecta Google en Integraciones para aceptar el permiso de Calendar (solo lectura).",
      needsReconnect: true,
    };
  }
  if (!res.ok) return { ok: false, error: `Google Calendar respondió ${res.status}.`, needsReconnect: false };
  const data = (await res.json().catch(() => ({}))) as { items?: RawEvent[]; timeZone?: string };
  const events = (data.items ?? []).map(normalizeGoogleEvent).filter((e): e is GoogleCalendarEvent => e !== null);
  return { ok: true, timeZone: calendarTimeZone(data.timeZone), events };
}

/** Resolves the connected Google account's token (refreshing it if needed) and reads its primary calendar. */
export async function loadGoogleCalendar(
  now = new Date(),
  days = 14
): Promise<{ connected: boolean; error: string | null; timeZone: string; events: GoogleCalendarEvent[]; needsReconnect: boolean }> {
  const resolved = await getValidGmailAccessToken();
  if (!resolved.ok) return { connected: false, error: null, timeZone: calendarTimeZone(), events: [], needsReconnect: false };
  const result = await fetchGoogleCalendarEvents(resolved.token, {
    timeMin: now,
    timeMax: new Date(now.getTime() + days * 86_400_000),
  });
  if (!result.ok) return { connected: false, error: result.error, timeZone: calendarTimeZone(), events: [], needsReconnect: result.needsReconnect };
  return { connected: true, error: null, timeZone: result.timeZone, events: result.events, needsReconnect: false };
}

export function eventsWithContact(events: GoogleCalendarEvent[], email: string): GoogleCalendarEvent[] {
  const needle = email.trim().toLowerCase();
  if (!needle) return [];
  return events.filter((e) => e.organizerEmail === needle || e.attendees.some((a) => a.email === needle));
}

function zoneFormatter(timeZone: string) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    weekday: "short",
    hourCycle: "h23",
  });
}

function localParts(date: Date, fmt: Intl.DateTimeFormat) {
  const map = Object.fromEntries(fmt.formatToParts(date).map((p) => [p.type, p.value]));
  return {
    date: `${map.year}-${map.month}-${map.day}`,
    minutes: Number(map.hour) * 60 + Number(map.minute),
    weekday: map.weekday as string,
  };
}

export type FreeSlot = { start: string; end: string };

/**
 * Free slots between `from` and `to`: weekdays only, inside working hours in the calendar's zone,
 * not overlapping any busy event (all-day busy events block the whole local day).
 */
export function findFreeSlots(
  events: GoogleCalendarEvent[],
  opts: {
    from: Date;
    to: Date;
    durationMinutes?: number;
    timeZone?: string;
    workdayStartHour?: number;
    workdayEndHour?: number;
    stepMinutes?: number;
    limit?: number;
  }
): FreeSlot[] {
  const duration = (opts.durationMinutes ?? 30) * 60_000;
  const step = (opts.stepMinutes ?? 30) * 60_000;
  const fmt = zoneFormatter(opts.timeZone ?? calendarTimeZone());
  const dayStart = (opts.workdayStartHour ?? 9) * 60;
  const dayEnd = (opts.workdayEndHour ?? 18) * 60;
  const limit = opts.limit ?? 5;
  const busy = events.filter((e) => e.busy);
  const timed = busy.filter((e) => !e.allDay).map((e) => [Date.parse(e.start), Date.parse(e.end)] as const);
  const allDay = busy.filter((e) => e.allDay && e.startDate && e.endDate);

  const slots: FreeSlot[] = [];
  let t = Math.ceil(opts.from.getTime() / step) * step;
  const last = opts.to.getTime() - duration;
  while (t <= last && slots.length < limit) {
    const s = localParts(new Date(t), fmt);
    const e = localParts(new Date(t + duration), fmt);
    const weekday = s.weekday !== "Sat" && s.weekday !== "Sun";
    const inHours = s.date === e.date && s.minutes >= dayStart && e.minutes <= dayEnd;
    const blockedDay = allDay.some((ev) => s.date >= ev.startDate! && s.date < ev.endDate!);
    const overlaps = timed.some(([bs, be]) => t < be && t + duration > bs);
    if (weekday && inHours && !blockedDay && !overlaps) {
      slots.push({ start: new Date(t).toISOString(), end: new Date(t + duration).toISOString() });
    }
    t += step;
  }
  return slots;
}

export function googleEventToAgenda(event: GoogleCalendarEvent): AgendaMeeting {
  return {
    id: `google-${event.id}`,
    source: "google",
    title: event.title,
    start: event.start,
    end: event.end,
    location: event.location || "Google Calendar",
    href: event.htmlLink,
    hrefLabel: event.location === "Google Meet" ? "Meet" : "Google Calendar",
  };
}
