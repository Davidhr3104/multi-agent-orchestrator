import { updateNoBidRule, deleteNoBidRule } from "@/lib/no-bid-rules";
import { requireOperator } from "@helix/core/operator";

export const runtime = "nodejs";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = requireOperator(req);
  if (denied) return denied;
  const { id } = await params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const { pattern, reason, enabled } = body as { pattern?: string; reason?: string; enabled?: boolean };
  const result = await updateNoBidRule(id, { pattern, reason, enabled });
  if (!result.ok) return Response.json({ error: result.error }, { status: 409 });
  return Response.json({ ok: true });
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = requireOperator(req);
  if (denied) return denied;
  const { id } = await params;
  const result = await deleteNoBidRule(id);
  if (!result.ok) return Response.json({ error: result.error }, { status: 409 });
  return Response.json({ ok: true });
}
