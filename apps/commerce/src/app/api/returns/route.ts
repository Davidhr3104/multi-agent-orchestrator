import { createReturnRequest, listReturns } from "@/lib/store";
import { requireOperator } from "@helix/core/operator";

export const runtime = "nodejs";

export async function GET() {
  const returns = await listReturns();
  return Response.json({ returns });
}

export async function POST(req: Request) {
  const denied = requireOperator(req);
  if (denied) return denied;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "JSON inválido" }, { status: 400 });
  }
  const { orderId, reason, refundAmount, restock } = body as {
    orderId?: string;
    reason?: string;
    refundAmount?: number;
    restock?: boolean;
  };
  if (!orderId || !reason || typeof refundAmount !== "number" || refundAmount <= 0) {
    return Response.json(
      { error: "orderId, reason, and a positive refundAmount are required" },
      { status: 400 }
    );
  }
  const request = await createReturnRequest({ orderId, reason, refundAmount, restock: Boolean(restock) });
  if (!request) return Response.json({ error: "Order not found" }, { status: 404 });
  return Response.json({ return: request });
}
