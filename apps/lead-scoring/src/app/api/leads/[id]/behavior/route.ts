import { applyBehavior, isBehaviorKind } from "@helix/core";
import { getLead, saveLead } from "@/lib/store";

export const runtime = "nodejs";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const current = await getLead(id);
  if (!current) return Response.json({ error: "Lead not found" }, { status: 404 });
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const kind = String((body as { kind?: string }).kind ?? "");
  if (!isBehaviorKind(kind)) {
    return Response.json({ error: "Invalid behavior kind" }, { status: 400 });
  }
  const lead = await saveLead(applyBehavior(current, kind));
  return Response.json({ lead });
}
