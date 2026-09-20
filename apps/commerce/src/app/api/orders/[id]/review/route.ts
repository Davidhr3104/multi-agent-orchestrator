import { getOrder, patchOrder, syncShopifyLive } from "@/lib/store";
import { getLiveShopifyClient } from "@/lib/shopify";
import { operatorActor, requireOperator } from "@helix/core/operator";

export const runtime = "nodejs";

function isDemoShopifyId(gid: string): boolean {
  return /gid:\/\/shopify\/Order\/100[1-5]/.test(gid);
}

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

  const current = await getOrder(id);
  if (!current) return Response.json({ error: "Order not found" }, { status: 404 });

  const actor = operatorActor(req);
  const live = getLiveShopifyClient();
  const demo = isDemoShopifyId(current.shopifyOrderId);

  if ((decision === "approved" || decision === "cancelled") && !demo) {
    if (!live) {
      return Response.json(
        {
          error: "Shopify is not configured. Paste domain + token in Settings, or Load demo for local review.",
          order: current,
        },
        { status: 409 }
      );
    }
    try {
      if (decision === "approved") await live.fulfillOrder(current.shopifyOrderId);
      else await live.cancelOrder(current.shopifyOrderId);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return Response.json({ error: message, order: current }, { status: 502 });
    }
  }

  const order = await patchOrder(id, {
    reviewDecision: decision,
    reviewedBy: actor,
    reviewedAt: new Date().toISOString(),
    requiresReview: false,
    fulfillmentStatus:
      decision === "approved" ? "fulfilled" : decision === "cancelled" ? "cancelled" : current.fulfillmentStatus,
    financialStatus: decision === "cancelled" ? "voided" : current.financialStatus,
  });

  if (!order) return Response.json({ error: "Order not found" }, { status: 404 });
  return Response.json({ order, shopify: Boolean(live) && !demo });
}
