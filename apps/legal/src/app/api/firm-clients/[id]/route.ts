import { updateFirmClient, deleteFirmClient } from "@/lib/firm-knowledge";
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
  const { clientName, clientType, status } = body as {
    clientName?: string;
    clientType?: string;
    status?: string;
  };
  const result = await updateFirmClient(id, {
    clientName: clientName?.trim(),
    clientType: clientType?.trim(),
    status: status === "Active" || status === "Inactive" ? status : undefined,
  });
  if (!result.ok) return Response.json({ error: result.error }, { status: 409 });
  return Response.json({ ok: true });
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = requireOperator(req);
  if (denied) return denied;
  const { id } = await params;
  const result = await deleteFirmClient(id);
  if (!result.ok) return Response.json({ error: result.error }, { status: 409 });
  return Response.json({ ok: true });
}
