import { loadNoBidRules, createNoBidRule } from "@/lib/no-bid-rules";
import { requireOperator } from "@helix/core/operator";

export const runtime = "nodejs";

export async function GET() {
  const data = await loadNoBidRules();
  return Response.json(data);
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
  const { pattern, reason } = body as { pattern?: string; reason?: string };
  if (!pattern?.trim() || !reason?.trim()) {
    return Response.json({ error: "pattern and reason are required" }, { status: 400 });
  }
  const result = await createNoBidRule({ pattern: pattern.trim(), reason: reason.trim() });
  if (!result.ok) return Response.json({ error: result.error }, { status: 409 });
  return Response.json({ rule: result.rule });
}
