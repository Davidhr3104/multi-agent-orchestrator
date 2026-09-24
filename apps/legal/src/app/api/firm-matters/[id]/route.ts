import { updateFirmMatter, deleteFirmMatter } from "@/lib/firm-knowledge";
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
  const { matterName, opposingParty, matterType, status } = body as {
    matterName?: string;
    opposingParty?: string | null;
    matterType?: string | null;
    status?: string;
  };
  const result = await updateFirmMatter(id, {
    matterName: matterName?.trim(),
    opposingParty: opposingParty === undefined ? undefined : opposingParty,
    matterType: matterType === undefined ? undefined : matterType,
    status: status === "Active" || status === "Closed" ? status : undefined,
  });
  if (!result.ok) return Response.json({ error: result.error }, { status: 409 });
  return Response.json({ ok: true });
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = requireOperator(req);
  if (denied) return denied;
  const { id } = await params;
  const result = await deleteFirmMatter(id);
  if (!result.ok) return Response.json({ error: result.error }, { status: 409 });
  return Response.json({ ok: true });
}
