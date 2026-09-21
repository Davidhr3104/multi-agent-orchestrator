import { listOrders } from "@/lib/store";
import { summarizeDeskRisk } from "@helix/core";

export const runtime = "nodejs";

export async function GET() {
  const orders = await listOrders();
  return Response.json({
    orders,
    risk: summarizeDeskRisk(orders),
  });
}
