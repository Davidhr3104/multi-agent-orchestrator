import { requireOperator } from "@helix/core/operator";
import { buildRestockReport } from "@/lib/restock";
import { currentDeskMode, lastShopifySyncAt, listOrders, listProducts } from "@/lib/store";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const denied = requireOperator(req);
  if (denied) return denied;
  const [orders, products] = await Promise.all([listOrders(), listProducts()]);
  const source = currentDeskMode() === "live" ? "shopify" : "demo";
  const report = await buildRestockReport(products, orders, source);
  return Response.json({ ...report, lastShopifySyncAt: source === "shopify" ? lastShopifySyncAt() : null });
}
