import { patchLead } from "@/lib/store";
import { listSalesReps } from "@/lib/reps";
import { operatorActor, requireOperator } from "@helix/core/operator";

export const runtime = "nodejs";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = requireOperator(req);
  if (denied) return denied;
  const { id } = await params;
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const repId = String((body as { repId?: unknown }).repId ?? "").trim();
  const rep = listSalesReps().find((r) => r.id === repId);
  if (!rep) return Response.json({ error: "Unknown rep" }, { status: 400 });
  const lead = await patchLead(id, {
    assignedRepId: rep.id,
    assignee: rep.name,
    routingReason: `Assigned by ${operatorActor(req)}`,
    reviewedBy: operatorActor(req),
    reviewedAt: new Date().toISOString(),
  });
  if (!lead) return Response.json({ error: "Lead not found" }, { status: 404 });
  return Response.json({ lead });
}
