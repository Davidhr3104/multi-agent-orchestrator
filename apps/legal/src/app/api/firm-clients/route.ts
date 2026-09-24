import { loadFirmKnowledge, createFirmClient } from "@/lib/firm-knowledge";
import { requireOperator } from "@helix/core/operator";

export const runtime = "nodejs";

export async function GET() {
  const knowledge = await loadFirmKnowledge();
  return Response.json(knowledge);
}

export async function POST(req: Request) {
  const denied = requireOperator(req);
  if (denied) return denied;

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
  if (!clientName?.trim()) {
    return Response.json({ error: "clientName is required" }, { status: 400 });
  }
  const result = await createFirmClient({
    clientName: clientName.trim(),
    clientType: clientType?.trim() || "Corporate",
    status: status === "Inactive" ? "Inactive" : "Active",
  });
  if (!result.ok) return Response.json({ error: result.error }, { status: 409 });
  return Response.json({ client: result.client });
}
