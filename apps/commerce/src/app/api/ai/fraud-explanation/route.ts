import { requireOperator } from "@helix/core/operator";
import { mayChangeDesk } from "@/lib/ai-desk";
import { explainOrderFraud } from "@/lib/fraud-explanation";
import { getOrder } from "@/lib/store";

export const runtime = "nodejs";

// Each call can spend Claude tokens, so a live desk requires the operator unlock.
export async function POST(req: Request) {
  if (!mayChangeDesk(req)) {
    return requireOperator(req) ?? Response.json({ error: "Operator unlock required." }, { status: 401 });
  }
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
