import { requireOperator } from "@helix/core/operator";
import { mayChangeDesk } from "@/lib/ai-desk";
import { buildStoreSummary } from "@/lib/store-summary";
import { currentDeskMode, lastShopifySyncAt, listOrders, listProducts } from "@/lib/store";

export const runtime = "nodejs";

export async function POST(req: Request) {
  if (!mayChangeDesk(req)) {
    return requireOperator(req) ?? Response.json({ error: "Operator unlock required." }, { status: 401 });
  }
  const [orders, products] = await Promise.all([listOrders(), listProducts()]);
  const source = currentDeskMode() === "live" ? "shopify" : "demo";
  const summary = await buildStoreSummary(orders, products, source);
  return Response.json({ ...summary, lastShopifySyncAt: source === "shopify" ? lastShopifySyncAt() : null });
}
