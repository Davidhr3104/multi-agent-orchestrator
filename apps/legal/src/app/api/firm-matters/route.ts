import { createFirmMatter } from "@/lib/firm-knowledge";
import { deskWriteDenied } from "@/lib/ai-desk";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const denied = deskWriteDenied(req);
  if (denied) return denied;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const { clientId, matterName, opposingParty, matterType, status } = body as {
    clientId?: string;
    matterName?: string;
    opposingParty?: string;
    matterType?: string;
    status?: string;
  };
  if (!clientId || !matterName?.trim()) {
    return Response.json({ error: "clientId and matterName are required" }, { status: 400 });
  }
  const result = await createFirmMatter({
    clientId,
    matterName: matterName.trim(),
    opposingParty: opposingParty?.trim() || undefined,
    matterType: matterType?.trim() || undefined,
    status: status === "Active" ? "Active" : "Closed",
  });
  if (!result.ok) return Response.json({ error: result.error }, { status: 409 });
  return Response.json({ matter: result.matter });
}
