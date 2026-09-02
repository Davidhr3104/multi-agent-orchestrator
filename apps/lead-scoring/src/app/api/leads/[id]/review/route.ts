import { patchLead } from "@/lib/store";

export const runtime = "nodejs";

async function clear(id: string) {
  const lead = await patchLead(id, { needsReview: false });
  if (!lead) return Response.json({ error: "Lead not found" }, { status: 404 });
  return lead;
}

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const lead = await clear(id);
  if (lead instanceof Response) return lead;
  return Response.json({ lead });
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const lead = await clear(id);
  if (lead instanceof Response) return lead;
  return new Response("Approved. You can close this tab.", { headers: { "Content-Type": "text/plain" } });
}

