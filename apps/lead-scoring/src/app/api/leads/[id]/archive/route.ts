import { patchLead } from "@/lib/store";

export const runtime = "nodejs";

async function archive(id: string) {
  const lead = await patchLead(id, { needsReview: false, pipelineStage: "lost" });
  if (!lead) return Response.json({ error: "Lead not found" }, { status: 404 });
  return Response.json({ lead });
}

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return archive(id);
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const res = await archive(id);
  if (!res.ok) return res;
  return new Response("Archived. You can close this tab.", { headers: { "Content-Type": "text/plain" } });
}
