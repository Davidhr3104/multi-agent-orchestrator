import { getSecret } from "@helix/core";
import { fetchCalendlyAgenda } from "@/lib/calendly";
import { deskAgenda, planShowing, type AgendaMeeting } from "@/lib/showing-schedule";
import { listAllThreads } from "@/lib/store";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const header = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim() ?? "";
  const token = getSecret("CALENDLY_TOKEN") || header;
  const now = new Date();
  const desk = deskAgenda(now);
  const threads = await listAllThreads();
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
  const calendly = token
    ? await fetchCalendlyAgenda(token, now)
    : { connected: false, name: null, schedulingUrl: null, events: [], error: null };
  const events = [...desk, ...booked, ...calendly.events].sort((a, b) => a.start.localeCompare(b.start));
  return Response.json({
    events,
    calendly: {
      connected: calendly.connected,
      name: calendly.name,
      schedulingUrl: calendly.schedulingUrl,
      error: calendly.error,
    },
  });
}
