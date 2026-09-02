import { getBrain, setBrain } from "@/lib/brain";

export const runtime = "nodejs";

export async function GET() {
  return Response.json(getBrain());
}

export async function PUT(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const row = body as { addendum?: string; hitl?: number };
  return Response.json(setBrain(row));
}
