import { intentFor, INTENT_LABEL } from "@/lib/intent";
import { listLeads, listProperties, listSellers, listShowings } from "@/lib/store";

export const runtime = "nodejs";

const cell = (v: unknown) => {
  const s = v === null || v === undefined ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const csv = (header: string[], rows: unknown[][]) => [header, ...rows].map((r) => r.map(cell).join(",")).join("\r\n");

/** Exports what is on the desk right now as CSV. Read-only; nothing leaves the server except this download. */
export async function GET(_req: Request, { params }: { params: Promise<{ kind: string }> }) {
  const { kind } = await params;
  let body: string;
  if (kind === "leads") {
    const leads = await listLeads();
    body = csv(
      ["name", "email", "phone", "source", "stage", "score", "tier", "intent", "budget_usd", "zones", "beds_min", "timeline_months", "financing", "created_at", "last_contact_at"],
      leads.map((l) => [l.name, l.email, l.phone, l.source, l.stage, l.buyer.score, l.buyer.tier, INTENT_LABEL[intentFor(l).intent], l.budget || "", l.zones.join("; "), l.bedsMin || "", l.timelineMonths ?? "", l.financing, l.createdAt, l.lastContactAt])
    );
  } else if (kind === "properties") {
    const props = await listProperties();
    body = csv(
      ["title", "address", "zone", "type", "status", "price_usd", "sqm", "beds", "baths", "days_on_market", "amenities"],
      props.map((p) => [p.title, p.address, p.zone, p.kind, p.status, p.price, p.sqm, p.beds, p.baths, p.daysOnMarket, p.amenities.join("; ")])
    );
  } else if (kind === "sellers") {
    const sellers = await listSellers();
    body = csv(
      ["name", "email", "phone", "source", "stage", "address", "zone", "type", "sqm", "beds", "asking_price_usd", "created_at"],
      sellers.map((s) => [s.name, s.email, s.phone, s.source, s.stage, s.address, s.zone, s.kind, s.sqm, s.beds, s.askingPrice ?? "", s.createdAt])
    );
  } else if (kind === "showings") {
    const showings = await listShowings();
    body = csv(
      ["id", "lead_id", "property_id", "starts_at", "duration_min", "status", "interest", "objections"],
      showings.map((s) => [s.id, s.leadId, s.propertyId, s.startsAt, s.durationMin, s.status, s.feedback?.interest, s.feedback?.objections.join("; ")])
    );
  } else {
    return Response.json({ error: "Unknown export. Use leads, properties, sellers or showings." }, { status: 404 });
  }
  return new Response(`\uFEFF${body}`, {
    headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="helix-real-estate-${kind}.csv"` },
  });
}
