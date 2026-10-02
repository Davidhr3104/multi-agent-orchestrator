import { intentFor, INTENT_LABEL } from "@/lib/intent";
import { fitBreakdown } from "@/lib/scoring";
import { getProperty, listLeads } from "@/lib/store";

export const runtime = "nodejs";

/** Open buyers ranked by fit for one listing, with the four-part breakdown behind each fit score. Read-only. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const p = await getProperty(id);
  if (!p) return Response.json({ error: "Listing not found." }, { status: 404 });
  const buyers = (await listLeads())
    .filter((l) => l.stage !== "closed" && l.stage !== "archived")
    .map((l) => {
      const parts = fitBreakdown(l, p);
      const intent = intentFor(l);
      return {
        id: l.id,
        name: l.name,
        email: l.email,
        phone: l.phone ?? null,
        stage: l.stage,
        score: l.buyer.score,
        tier: l.buyer.tier,
        budget: l.budget,
        zones: l.zones,
        bedsMin: l.bedsMin,
        intent: INTENT_LABEL[intent.intent],
        fit: Math.min(100, parts.reduce((s, x) => s + x.points, 0)),
        parts,
      };
    })
    .sort((a, b) => b.fit - a.fit || b.score - a.score)
    .slice(0, 8);
  return Response.json({ property: { id: p.id, title: p.title, zone: p.zone, price: p.price, beds: p.beds, status: p.status }, buyers });
}
