import { listLeads, listProperties, listShowings } from "@/lib/store";

export const runtime = "nodejs";

const stamp = (iso: string) => new Date(iso).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
const esc = (s: string) => s.replace(/\\/g, "\\\\").replace(/[,;]/g, (c) => `\\${c}`).replace(/\n/g, "\\n");

/**
 * One-way export of scheduled showings as an .ics file the agent imports into Google or Outlook by hand.
 * It is a snapshot, not a sync: later changes on the desk don't reach the imported events.
 */
export async function GET(req: Request) {
  const only = new URL(req.url).searchParams.get("id");
  const [showings, leads, props] = await Promise.all([listShowings(), listLeads(), listProperties()]);
  const leadName = new Map(leads.map((l) => [l.id, l.name]));
  const prop = new Map(props.map((p) => [p.id, p]));
  const list = showings.filter((s) => s.status === "scheduled" && (!only || s.id === only));
  if (only && list.length === 0) return Response.json({ error: "Showing not found or not scheduled." }, { status: 404 });
  const now = stamp(new Date().toISOString());
  const events = list.map((s) => {
    const p = prop.get(s.propertyId);
    const end = new Date(Date.parse(s.startsAt) + s.durationMin * 60_000).toISOString();
    return [
      "BEGIN:VEVENT",
      `UID:${s.id}@helix-real-estate`,
      `DTSTAMP:${now}`,
      `DTSTART:${stamp(s.startsAt)}`,
      `DTEND:${stamp(end)}`,
      `SUMMARY:${esc(`Showing: ${leadName.get(s.leadId) ?? "Buyer"} · ${p?.title ?? "Listing"}`)}`,
      p ? `LOCATION:${esc(`${p.address}, ${p.zone}`)}` : "",
      `DESCRIPTION:${esc("Exported from Helix for Real Estate. A one-time copy — changes on the desk are not synced.")}`,
      "END:VEVENT",
    ]
      .filter(Boolean)
      .join("\r\n");
  });
  const body = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Helix//Real Estate//EN", "CALSCALE:GREGORIAN", ...events, "END:VCALENDAR"].join("\r\n");
  return new Response(body, {
    headers: { "content-type": "text/calendar; charset=utf-8", "content-disposition": `attachment; filename="${only ? `showing-${only}` : "helix-showings"}.ics"` },
  });
}
