import { patchLead } from "@/lib/store";
import type { PipelineStage } from "@helix/core";
import { withOrgScope } from "@/lib/org-auth";

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
  const { pipelineStage: rawStage, dealValue: rawDealValue } = body as {
    pipelineStage?: string;
    dealValue?: number;
  };
  const stage = String(rawStage ?? "");
  if (!STAGES.includes(stage as PipelineStage)) {
    return Response.json({ error: "Invalid pipelineStage" }, { status: 400 });
  }
  if (stage === "won") {
    if (typeof rawDealValue !== "number" || !Number.isFinite(rawDealValue) || rawDealValue <= 0) {
      return Response.json({ error: "dealValue is required to mark a lead as won" }, { status: 400 });
    }
  }
  const patch: { pipelineStage: PipelineStage; dealValue?: number; closedAt?: string } = {
    pipelineStage: stage as PipelineStage,
  };
  if (stage === "won") {
    patch.dealValue = rawDealValue;
    patch.closedAt = new Date().toISOString();
  }
  return withOrgScope(async (orgId) => {
    const lead = await patchLead(id, patch, orgId);
    if (!lead) return Response.json({ error: "Lead not found" }, { status: 404 });
    return Response.json({ lead });
  });
}
