import { addComm, listComms, type CommKind } from "@/lib/store";

export const runtime = "nodejs";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const events = await listComms(id);
  return Response.json({ events });
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "JSON inválido" }, { status: 400 });
  }
  const kind = String((body as { kind?: string }).kind ?? "note") as CommKind;
  const text = String((body as { text?: string }).text ?? "");
  const allowed: CommKind[] = ["email", "call", "meeting", "note"];
  if (!allowed.includes(kind)) return Response.json({ error: "Bad kind" }, { status: 400 });
  const events = await addComm(id, kind, text);
  if (!events) return Response.json({ error: "RFP not found" }, { status: 404 });
  return Response.json({ events });
}
