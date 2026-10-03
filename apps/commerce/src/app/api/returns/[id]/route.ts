import { getOrder, listReturns, patchReturnRequest } from "@/lib/store";
import { getLiveShopifyClient } from "@/lib/shopify";
import { operatorActor } from "@helix/core/operator";
import { deskWriteDenied } from "@/lib/ai-desk";

export const runtime = "nodejs";

function isDemoShopifyId(gid: string): boolean {
  return /gid:\/\/shopify\/Order\/100[1-5]/.test(gid);
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = deskWriteDenied(req);
  if (denied) return denied;
  const { id } = await params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "JSON inválido" }, { status: 400 });
  }
  const decision = (body as { decision?: string } | null)?.decision;
  if (decision !== "approved" && decision !== "rejected") {
    return Response.json({ error: "decision must be 'approved' or 'rejected'" }, { status: 400 });
  }

  const current = (await listReturns()).find((r) => r.id === id);
  if (!current) return Response.json({ error: "Return not found" }, { status: 404 });
  if (current.status !== "requested") {
    return Response.json({ error: `Return already ${current.status}` }, { status: 409 });
  }

  const actor = operatorActor(req);

  if (decision === "rejected") {
    const updated = await patchReturnRequest(id, {
      status: "rejected",
      resolvedBy: actor,
      resolvedAt: new Date().toISOString(),
    });
    return Response.json({ return: updated });
  }

  // Approved: process a real Shopify refund unless this is a demo order.
  const order = await getOrder(current.orderId);
  const demo = order ? isDemoShopifyId(order.shopifyOrderId) : true;
  const live = getLiveShopifyClient();

  let shopifyRefundId: string | undefined;
  if (!demo) {
    if (!live) {
      return Response.json(
        { error: "Shopify is not configured. Paste domain + token in Settings, or use a demo order." },
        { status: 409 }
      );
    }
    try {
      shopifyRefundId = await live.refundOrder(current.shopifyOrderId, current.refundAmount, current.restock);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return Response.json({ error: message }, { status: 502 });
    }
  }

  const updated = await patchReturnRequest(id, {
    status: "refunded",
    resolvedBy: actor,
    resolvedAt: new Date().toISOString(),
    shopifyRefundId,
  });
  return Response.json({ return: updated, shopify: Boolean(live) && !demo });
}
