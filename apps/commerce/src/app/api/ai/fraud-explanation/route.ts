import { requireOperator } from "@helix/core/operator";
import { explainOrderFraud } from "@/lib/fraud-explanation";
import { getOrder } from "@/lib/store";

export const runtime = "nodejs";

// Each call can spend Claude tokens, so it always requires the operator unlock.
export async function POST(req: Request) {
  const denied = requireOperator(req);
  if (denied) return denied;
  let body: { orderId?: unknown };
  try {
    body = (await req.json()) as { orderId?: unknown };
  } catch {
    return Response.json({ error: "JSON body required" }, { status: 400 });
  }
  if (typeof body.orderId !== "string" || !body.orderId) return Response.json({ error: "orderId required" }, { status: 400 });
  const order = await getOrder(body.orderId);
  if (!order) return Response.json({ error: "Order not found" }, { status: 404 });
  return Response.json(await explainOrderFraud(order));
}
