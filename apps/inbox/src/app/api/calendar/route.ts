import { getSecret } from "@helix/core";
import { fetchCalendlyAgenda } from "@/lib/calendly";
import { googleEventToAgenda, loadGoogleCalendar } from "@/lib/google-calendar";
import { deskAgenda, planShowing, type AgendaMeeting } from "@/lib/showing-schedule";
import { currentDeskMode, listAllThreads } from "@/lib/store";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const header = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim() ?? "";
  const token = getSecret("CALENDLY_TOKEN") || header;
  const now = new Date();
  const threads = await listAllThreads();
  const demo = currentDeskMode() === "demo";
  // The sample showings are demo data; a live desk only shows real calendars.
  const desk = demo ? deskAgenda(now) : [];
  const booked: AgendaMeeting[] = [];
  for (const thread of threads) {
    const plan = planShowing({ fromName: thread.fromName, subject: thread.subject, body: thread.body, now });
    if (plan?.status !== "book" || !plan.event) continue;
    booked.push({
      id: `book-${thread.id}`,
      source: "desk",
      title: plan.event.title,
      start: plan.event.start,
      end: plan.event.end,
      location: plan.event.location,
      href: plan.event.mapsUrl,
      hrefLabel: "Mapa",
    });
  }
  const [calendly, google] = await Promise.all([
    token
      ? fetchCalendlyAgenda(token, now)
      : Promise.resolve({ connected: false, name: null, schedulingUrl: null, events: [], error: null }),
    demo
      ? Promise.resolve({ connected: false, error: null, timeZone: "", events: [], needsReconnect: false })
      : loadGoogleCalendar(now),
  ]);
  const events = [...desk, ...booked, ...calendly.events, ...google.events.map(googleEventToAgenda)].sort((a, b) =>
    a.start.localeCompare(b.start)
  );
  return Response.json({
    events,
    demo,
    calendly: {
      connected: calendly.connected,
      name: calendly.name,
      schedulingUrl: calendly.schedulingUrl,
      error: calendly.error,
    },
    google: {
      connected: google.connected,
      error: google.error,
      needsReconnect: google.needsReconnect,
      timeZone: google.timeZone || null,
      count: google.events.length,
    },
  });
}
