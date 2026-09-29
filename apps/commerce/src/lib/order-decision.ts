import type { StoredOrder } from "@helix/core";
import { getLiveShopifyClient } from "@/lib/shopify";
import { getOrder, patchOrder } from "@/lib/store";

export type OrderDecision = "approved" | "flagged" | "cancelled";

/** The mock Shopify catalog's orders (#1001-#1005) are local-only: nothing external is ever touched for them. */
export function isDemoShopifyId(gid: string): boolean {
  return /gid:\/\/shopify\/Order\/100[1-5]/.test(gid);
}

export type DecisionResult =
  | { ok: true; order: StoredOrder; shopify: boolean }
  | { ok: false; status: number; error: string; order?: StoredOrder };

/**
 * One implementation of "approve / flag / cancel an order", shared by the HITL button route and
 * Helix AI. Approve and cancel on a real Shopify order call Shopify first; if that fails nothing
 * is recorded locally, so the desk never claims a change Shopify did not make.
 */
export async function decideOrder(id: string, decision: OrderDecision, actor: string): Promise<DecisionResult> {
  const current = await getOrder(id);
  if (!current) return { ok: false, status: 404, error: "Order not found" };

  const live = getLiveShopifyClient();
  const demo = isDemoShopifyId(current.shopifyOrderId);

  if ((decision === "approved" || decision === "cancelled") && !demo) {
    if (!live) {
      return {
        ok: false,
        status: 409,
        error: "Shopify is not configured. Paste domain + token in Settings, or Load demo for local review.",
        order: current,
      };
    }
    try {
      if (decision === "approved") await live.fulfillOrder(current.shopifyOrderId);
      else await live.cancelOrder(current.shopifyOrderId);
    } catch (err) {
      return { ok: false, status: 502, error: err instanceof Error ? err.message : String(err), order: current };
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
  if (!order) return { ok: false, status: 404, error: "Order not found" };
  return { ok: true, order, shopify: Boolean(live) && !demo };
}
