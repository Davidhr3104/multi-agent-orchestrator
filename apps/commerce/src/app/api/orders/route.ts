import { listOrders } from "@/lib/store";

export const runtime = "nodejs";

export async function GET() {
  const orders = await listOrders();
  return Response.json({ orders });
}
