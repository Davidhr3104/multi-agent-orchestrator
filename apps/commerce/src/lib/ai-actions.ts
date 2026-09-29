import type { DeskActionRegistry, StoredOrder } from "@helix/core";
import { decideOrder, isDemoShopifyId } from "@/lib/order-decision";
import { createReorderRequest, getOrder, getProduct, listReorders, patchOrder, patchReorderRequest } from "@/lib/store";

/**
 * What Helix AI may do on the Commerce desk, and the rules for when it may do it alone.
 *   hold_orders     reversible, local          -> auto (+Undo)
 *   create_reorders drafts only, nothing sent  -> auto (+Undo)
 *   approve_orders  fulfils the order          -> auto only for a clean low-risk demo order, else ask
 *   cancel_orders   irreversible on Shopify    -> always ask
 */

export type CommerceCtx = { actor: string };

const BULK_LIMIT = 3;

/** JSON drops undefined, so "was unset" is stored as an explicit null and turned back into undefined on restore. */
type OrderSnapshot = {
  reviewedBy: string | null;
  reviewedAt: string | null;
  reviewDecision: "approved" | "flagged" | "cancelled" | null;
  requiresReview: boolean;
  fulfillmentStatus: string;
  financialStatus: string;
};

const strOrNull = (v: unknown) => v === null || typeof v === "string";

function isOrderSnapshot(d: unknown): d is OrderSnapshot {
  if (!d || typeof d !== "object") return false;
  const o = d as Record<string, unknown>;
  return (
    strOrNull(o.reviewedBy) &&
    strOrNull(o.reviewedAt) &&
    (o.reviewDecision === null || ["approved", "flagged", "cancelled"].includes(o.reviewDecision as string)) &&
    typeof o.requiresReview === "boolean" &&
    typeof o.fulfillmentStatus === "string" &&
    typeof o.financialStatus === "string"
  );
}

async function orderSnapshot(id: string): Promise<OrderSnapshot | null> {
  const o = await getOrder(id);
  if (!o) return null;
  return {
    reviewedBy: o.reviewedBy ?? null,
    reviewedAt: o.reviewedAt ?? null,
    reviewDecision: o.reviewDecision ?? null,
    requiresReview: o.requiresReview,
    fulfillmentStatus: o.fulfillmentStatus,
    financialStatus: o.financialStatus,
  };
}

async function restoreOrder(id: string, data: unknown): Promise<boolean> {
  if (!isOrderSnapshot(data)) throw new Error("Invalid undo data");
  const current = await getOrder(id);
  if (!current) return false;
  // A change already made on the real Shopify store cannot be reversed from here — say so, never pretend.
  if (!isDemoShopifyId(current.shopifyOrderId) && (current.fulfillmentStatus !== data.fulfillmentStatus || current.financialStatus !== data.financialStatus)) {
    throw new Error("This change was made on Shopify and cannot be undone from Helix.");
  }
  return (
    (await patchOrder(id, {
      reviewedBy: data.reviewedBy ?? undefined,
      reviewedAt: data.reviewedAt ?? undefined,
      reviewDecision: data.reviewDecision ?? undefined,
      requiresReview: data.requiresReview,
      fulfillmentStatus: data.fulfillmentStatus,
      financialStatus: data.financialStatus,
    })) !== null
  );
}

async function orders(ids: string[]): Promise<StoredOrder[]> {
  const rows = await Promise.all(ids.map((id) => getOrder(id)));
  return rows.filter((o): o is StoredOrder => o !== null);
}

const names = (labels: string[]) => labels.join(", ");
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

export const commerceActions: DeskActionRegistry<CommerceCtx> = {
  hold_orders: {
    name: "hold_orders",
    assess: async (ids) => {
      const rows = await orders(ids);
      const reasons: string[] = [];
      if (rows.length !== ids.length) reasons.push("An order no longer exists");
      if (rows.some((o) => o.fulfillmentStatus === "fulfilled" || o.fulfillmentStatus === "cancelled")) reasons.push("An order is already fulfilled or cancelled");
      if (rows.length > BULK_LIMIT) reasons.push(`Bulk change (${rows.length} orders)`);
      return reasons.length ? { level: "confirm", reasons } : { level: "auto", reasons };
    },
    snapshot: (id) => orderSnapshot(id),
    apply: async (id, _p, ctx) => (await decideOrder(id, "flagged", ctx.actor)).ok,
    restore: (id, data) => restoreOrder(id, data),
    resultText: (done, failed) => `Held ${plural(done.length, "order")} for review.${failed ? ` ${failed} failed.` : ""}`,
    announce: (labels) => `Helix AI held ${names(labels)} for review`,
  },

  approve_orders: {
    name: "approve_orders",
    assess: async (ids) => {
      const rows = await orders(ids);
      const reasons: string[] = [];
      if (rows.length !== ids.length) reasons.push("An order no longer exists");
      if (rows.some((o) => o.riskLevel !== "low")) reasons.push("Includes an order above low fraud risk");
      if (rows.some((o) => o.requiresReview)) reasons.push("An order is still flagged for human review");
      if (rows.some((o) => !isDemoShopifyId(o.shopifyOrderId))) reasons.push("Fulfilling a real Shopify order is external and final");
      if (rows.length > BULK_LIMIT) reasons.push(`Bulk change (${rows.length} orders)`);
      return reasons.length ? { level: "confirm", reasons } : { level: "auto", reasons };
    },
    snapshot: (id) => orderSnapshot(id),
    apply: async (id, _p, ctx) => {
      const r = await decideOrder(id, "approved", ctx.actor);
      if (!r.ok) throw new Error(r.error);
      return true;
    },
    restore: (id, data) => restoreOrder(id, data),
    resultText: (done, failed) => `Approved and fulfilled ${plural(done.length, "order")}.${failed ? ` ${failed} failed.` : ""}`,
    announce: (labels) => `Helix AI approved ${names(labels)}`,
  },

  cancel_orders: {
    name: "cancel_orders",
    assess: async () => ({ level: "confirm", reasons: ["Cancelling voids the payment and cannot be undone on Shopify"] }),
    snapshot: (id) => orderSnapshot(id),
    apply: async (id, _p, ctx) => {
      const r = await decideOrder(id, "cancelled", ctx.actor);
      if (!r.ok) throw new Error(r.error);
      return true;
    },
    restore: (id, data) => restoreOrder(id, data),
    resultText: (done, failed) => `Cancelled ${plural(done.length, "order")} and voided payment.${failed ? ` ${failed} failed.` : ""}`,
    announce: (labels) => `Helix AI cancelled ${names(labels)}`,
  },

  create_reorders: {
    name: "create_reorders",
    assess: async (ids) => {
      const reasons: string[] = [];
      if (ids.length > 5) reasons.push(`Bulk reorder (${ids.length} products)`);
      return reasons.length ? { level: "confirm", reasons } : { level: "auto", reasons };
    },
    snapshot: async (id) => ((await getProduct(id)) ? { productId: id } : null),
    apply: async (id) => (await createReorderRequest(id)) !== null,
    // A reorder is only a draft: undoing it cancels the newest draft for that product.
    restore: async (id) => {
      const drafts = (await listReorders()).filter((r) => r.productId === id && r.status === "draft");
      const newest = drafts.sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
      if (!newest) return false;
      return (await patchReorderRequest(newest.id, { status: "cancelled", notes: "Undone from Helix AI" })) !== null;
    },
    resultText: (done, failed) => `Drafted ${plural(done.length, "reorder request")} — nothing was sent to a supplier.${failed ? ` ${failed} failed.` : ""}`,
    announce: (labels) => `Helix AI drafted a reorder for ${names(labels)}`,
  },
};
