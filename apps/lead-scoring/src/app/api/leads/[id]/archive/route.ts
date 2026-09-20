import { patchLead } from "@/lib/store";
import { operatorActor, requireOperator } from "@helix/core/operator";

export const runtime = "nodejs";

async function archive(id: string, actor: string) {
  const lead = await patchLead(id, {
    needsReview: false,
    pipelineStage: "lost",
    reviewedBy: actor,
    reviewedAt: new Date().toISOString(),
  });
  if (!lead) return Response.json({ error: "Lead not found" }, { status: 404 });
  return Response.json({ lead });
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = requireOperator(req);
  if (denied) return denied;
  const { id } = await params;
  return archive(id, operatorActor(req));
}

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = requireOperator(req);
  if (denied) return denied;
  const { id } = await params;
  const res = await archive(id, operatorActor(req));
  if (!res.ok) return res;
  return new Response("Archived. You can close this tab.", { headers: { "Content-Type": "text/plain" } });
}
