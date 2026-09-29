import { decideOrder } from "@/lib/order-decision";
import { operatorActor, requireOperator } from "@helix/core/operator";

export const runtime = "nodejs";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = requireOperator(req);
  if (denied) return denied;
  const { id } = await params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "JSON inválido" }, { status: 400 });
  }

  const decision = (body as { decision?: string } | null)?.decision;
  if (decision !== "approved" && decision !== "flagged" && decision !== "cancelled") {
    return Response.json(
      { error: "decision must be 'approved', 'flagged', or 'cancelled'" },
      { status: 400 }
    );
  }

  const result = await decideOrder(id, decision, operatorActor(req));
  if (!result.ok) return Response.json({ error: result.error, order: result.order }, { status: result.status });
  return Response.json({ order: result.order, shopify: result.shopify });
}
