import { listLeads } from "@/lib/store";
import { resurrectLeads } from "@helix/core";

export const runtime = "nodejs";

export async function GET() {
  const leads = await listLeads();
  const hits = resurrectLeads(leads).map((h) => ({
    id: h.lead.id,
    name: h.lead.name,
    email: h.lead.email,
    score: h.lead.score,
    reason: h.reason,
    scoreBoost: h.scoreBoost,
  }));
  return Response.json({ hits });
}
