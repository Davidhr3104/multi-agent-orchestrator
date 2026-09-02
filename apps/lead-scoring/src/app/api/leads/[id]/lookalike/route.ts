import { getLead, listLeads } from "@/lib/store";
import { lookalikeLeads } from "@helix/core";

export const runtime = "nodejs";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const seed = await getLead(id);
  if (!seed) return Response.json({ error: "Lead not found" }, { status: 404 });
  const likes = lookalikeLeads(seed, await listLeads()).map((l) => ({
    id: l.id,
    name: l.name,
    email: l.email,
    score: l.score,
    tier: l.tier,
    source: l.source,
    company: l.company,
  }));
  return Response.json({ likes });
}
