import { requireOperator } from "@helix/core/operator";
import { mayChangeDesk } from "@/lib/ai-desk";
import { buildRestockReport } from "@/lib/restock";
import { currentDeskMode, lastShopifySyncAt, listOrders, listProducts } from "@/lib/store";

export const runtime = "nodejs";

export async function POST(req: Request) {
  if (!mayChangeDesk(req)) {
    return requireOperator(req) ?? Response.json({ error: "Operator unlock required." }, { status: 401 });
  }
  const [orders, products] = await Promise.all([listOrders(), listProducts()]);
  const source = currentDeskMode() === "live" ? "shopify" : "demo";
  const report = await buildRestockReport(products, orders, source);
  return Response.json({ ...report, lastShopifySyncAt: source === "shopify" ? lastShopifySyncAt() : null });
}
