import { getClientProfile, setClientProfile } from "@/lib/store";

export const runtime = "nodejs";

export async function GET() {
  return Response.json({ clientProfile: getClientProfile() });
}

export async function PUT(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "JSON inválido" }, { status: 400 });
  }
  const row = body as Record<string, unknown>;
  const next = String(row.client_profile ?? row.clientProfile ?? "");
  const saved = setClientProfile(next);
  if (!saved) {
    return Response.json({ error: "client_profile must be at least 24 characters." }, { status: 400 });
  }
  return Response.json({ clientProfile: saved });
}
