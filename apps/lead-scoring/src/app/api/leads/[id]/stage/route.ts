import { patchLead } from "@/lib/store";
import type { PipelineStage } from "@helix/core";

export const runtime = "nodejs";

const STAGES: PipelineStage[] = ["new", "qualified", "contacted", "won", "lost"];

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const stage = String((body as { pipelineStage?: string }).pipelineStage ?? "");
  if (!STAGES.includes(stage as PipelineStage)) {
    return Response.json({ error: "Invalid pipelineStage" }, { status: 400 });
  }
  const lead = await patchLead(id, { pipelineStage: stage as PipelineStage });
  if (!lead) return Response.json({ error: "Lead not found" }, { status: 404 });
  return Response.json({ lead });
}
