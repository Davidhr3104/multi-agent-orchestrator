import { patchLead } from "@/lib/store";
import { operatorActor, requireOperator } from "@helix/core/operator";

export const runtime = "nodejs";

async function clear(id: string, actor: string) {
  const lead = await patchLead(id, {
    needsReview: false,
    reviewedBy: actor,
    reviewedAt: new Date().toISOString(),
  });
  if (!lead) return Response.json({ error: "Lead not found" }, { status: 404 });
  return lead;
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = requireOperator(req);
  if (denied) return denied;
  const { id } = await params;
  const lead = await clear(id, operatorActor(req));
  if (lead instanceof Response) return lead;
  return Response.json({ lead });
}

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = requireOperator(req);
  if (denied) return denied;
  const { id } = await params;
  const lead = await clear(id, operatorActor(req));
  if (lead instanceof Response) return lead;
  return new Response("Approved. You can close this tab.", { headers: { "Content-Type": "text/plain" } });
}
