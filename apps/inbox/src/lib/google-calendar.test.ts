import { afterEach, describe, expect, it, vi } from "vitest";
import {
  eventsWithContact,
  fetchGoogleCalendarEvents,
  findFreeSlots,
  normalizeGoogleEvent,
  type GoogleCalendarEvent,
} from "./google-calendar";

const TZ = "America/Mexico_City"; // UTC-6, no DST

function ev(partial: Partial<GoogleCalendarEvent> & Pick<GoogleCalendarEvent, "start" | "end">): GoogleCalendarEvent {
  return {
    id: partial.id ?? `e-${partial.start}`,
    title: partial.title ?? "Busy",
    allDay: false,
    busy: true,
    location: "",
    htmlLink: "https://calendar.google.com",
    organizerEmail: "",
    attendees: [],
    ...partial,
  };
}

afterEach(() => vi.unstubAllGlobals());

describe("normalizeGoogleEvent", () => {
  it("maps attendees, Meet links and marks declined / transparent events as not busy", () => {
    const e = normalizeGoogleEvent({
      id: "abc",
      summary: "Coffee with Ava",
      start: { dateTime: "2026-10-06T10:00:00-06:00" },
      end: { dateTime: "2026-10-06T10:30:00-06:00" },
      hangoutLink: "https://meet.google.com/xyz",
      organizer: { email: "Me@Company.com" },
      attendees: [
        { email: "AVA@lindqvist.co", displayName: "Ava", responseStatus: "accepted" },
        { email: "me@company.com", self: true, responseStatus: "accepted" },
      ],
    })!;
    expect(e.start).toBe("2026-10-06T16:00:00.000Z");
    expect(e.location).toBe("Google Meet");
    expect(e.htmlLink).toBe("https://meet.google.com/xyz");
    expect(e.attendees[0].email).toBe("ava@lindqvist.co");
    expect(e.busy).toBe(true);

    expect(normalizeGoogleEvent({ id: "t", start: { dateTime: "2026-10-06T10:00:00Z" }, end: { dateTime: "2026-10-06T11:00:00Z" }, transparency: "transparent" })!.busy).toBe(false);
    expect(
      normalizeGoogleEvent({
        id: "d",
        start: { dateTime: "2026-10-06T10:00:00Z" },
        end: { dateTime: "2026-10-06T11:00:00Z" },
        attendees: [{ email: "me@x.com", self: true, responseStatus: "declined" }],
      })!.busy
    ).toBe(false);
    expect(normalizeGoogleEvent({ id: "c", status: "cancelled", start: { dateTime: "2026-10-06T10:00:00Z" } })).toBeNull();
  });
});

describe("fetchGoogleCalendarEvents", () => {
  it("reads the primary calendar with the bearer token and returns the calendar's zone", async () => {
    const fetchMock = vi.fn(async () =>
      new Response(
        JSON.stringify({
          timeZone: "Europe/Madrid",
          items: [{ id: "1", summary: "Board prep", start: { dateTime: "2026-10-06T09:00:00Z" }, end: { dateTime: "2026-10-06T10:00:00Z" } }],
        }),
        { status: 200 }
      )
    );
    vi.stubGlobal("fetch", fetchMock);
    const r = await fetchGoogleCalendarEvents("tok", { timeMin: new Date("2026-10-05T00:00:00Z"), timeMax: new Date("2026-10-19T00:00:00Z") });
    expect(r.ok && r.timeZone).toBe("Europe/Madrid");
    expect(r.ok && r.events.map((e) => e.title)).toEqual(["Board prep"]);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toContain("/calendars/primary/events?");
    expect(url).toContain("singleEvents=true");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer tok");
  });

  it("asks to reconnect when Google refuses the calendar scope", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("{}", { status: 403 })));
    const r = await fetchGoogleCalendarEvents("tok", { timeMin: new Date(), timeMax: new Date() });
    expect(r.ok).toBe(false);
    expect(!r.ok && r.needsReconnect).toBe(true);
  });
});

describe("eventsWithContact", () => {
  it("matches the contact as attendee or organizer, case-insensitively", () => {
    const events = [
      ev({ id: "a", start: "2026-10-06T16:00:00Z", end: "2026-10-06T16:30:00Z", attendees: [{ email: "ava@lindqvist.co" }] }),
      ev({ id: "b", start: "2026-10-07T16:00:00Z", end: "2026-10-07T16:30:00Z", organizerEmail: "ava@lindqvist.co" }),
      ev({ id: "c", start: "2026-10-08T16:00:00Z", end: "2026-10-08T16:30:00Z", attendees: [{ email: "bob@x.com" }] }),
    ];
    expect(eventsWithContact(events, " AVA@Lindqvist.co ").map((e) => e.id)).toEqual(["a", "b"]);
    expect(eventsWithContact(events, "")).toEqual([]);
  });
});

describe("findFreeSlots", () => {
  // Monday 5 Oct 2026, 08:00 in Mexico City = 14:00 UTC.
  const from = new Date("2026-10-05T14:00:00Z");

  it("skips busy time and stays inside working hours in the calendar zone", () => {
    const busy = [ev({ start: "2026-10-05T15:00:00Z", end: "2026-10-05T16:00:00Z" })]; // 09:00-10:00 local
    const slots = findFreeSlots(busy, { from, to: new Date("2026-10-06T00:00:00Z"), timeZone: TZ, durationMinutes: 30, limit: 3 });
    expect(slots.map((s) => s.start)).toEqual(["2026-10-05T16:00:00.000Z", "2026-10-05T16:30:00.000Z", "2026-10-05T17:00:00.000Z"]);
  });

  it("ignores free (transparent) events and never offers weekends or after-hours", () => {
    const free = [ev({ start: "2026-10-05T15:00:00Z", end: "2026-10-05T23:00:00Z", busy: false })];
    const fridayEvening = new Date("2026-10-09T23:30:00Z"); // Fri 17:30 local
    const slots = findFreeSlots(free, { from: fridayEvening, to: new Date("2026-10-12T16:00:00Z"), timeZone: TZ, durationMinutes: 60, limit: 2 });
    // Fri 17:30 + 60 min would end after 18:00; next valid is Monday 09:00 local.
    expect(slots[0].start).toBe("2026-10-12T15:00:00.000Z");
    expect(findFreeSlots(free, { from, to: new Date("2026-10-05T16:00:00Z"), timeZone: TZ, limit: 1 })[0].start).toBe("2026-10-05T15:00:00.000Z");
  });

  it("treats a busy all-day event as blocking that whole local day", () => {
    const ooo = [ev({ start: "2026-10-05T00:00:00.000Z", end: "2026-10-06T00:00:00.000Z", allDay: true, startDate: "2026-10-05", endDate: "2026-10-06" })];
    const slots = findFreeSlots(ooo, { from, to: new Date("2026-10-07T00:00:00Z"), timeZone: TZ, limit: 1 });
    expect(slots[0].start).toBe("2026-10-06T15:00:00.000Z"); // Tue 09:00 local
  });
});
