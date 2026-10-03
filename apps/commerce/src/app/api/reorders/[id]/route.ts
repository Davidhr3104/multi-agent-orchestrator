import { patchReorderRequest } from "@/lib/store";
import { deskWriteDenied } from "@/lib/ai-desk";
import type { ReorderStatus } from "@helix/core";

export const runtime = "nodejs";

const STATUSES: ReorderStatus[] = ["draft", "ordered", "received", "cancelled"];

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = deskWriteDenied(req);
  if (denied) return denied;
  const { id } = await params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "JSON inválido" }, { status: 400 });
  }
  const { status, notes } = body as { status?: string; notes?: string };
  if (status && !STATUSES.includes(status as ReorderStatus)) {
    return Response.json({ error: `status must be one of ${STATUSES.join(", ")}` }, { status: 400 });
  }

  const patch: Parameters<typeof patchReorderRequest>[1] = {};
  if (status) {
    patch.status = status as ReorderStatus;
    if (status === "ordered") patch.orderedAt = new Date().toISOString();
    if (status === "received") patch.receivedAt = new Date().toISOString();
  }
  if (notes !== undefined) patch.notes = notes;

  const reorder = await patchReorderRequest(id, patch);
  if (!reorder) return Response.json({ error: "Reorder not found" }, { status: 404 });
  return Response.json({ reorder });
}
