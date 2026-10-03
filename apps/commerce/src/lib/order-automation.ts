import { timingSafeEqual } from "node:crypto";
import { getSecret, type RiskLevel, type StoredOrder } from "@helix/core";
import { commerceActions } from "@/lib/ai-actions";
import { isDemoShopifyId } from "@/lib/order-decision";
import { getLiveShopifyClient } from "@/lib/shopify";
import { notifySlackOrderAlert } from "@/lib/slack";
import { listOrders, markShopifySync, upsertOrderFromInput } from "@/lib/store";

/** The cron runs once a day (Vercel Hobby limit), so look back a bit more than a day. */
export const DEFAULT_LOOKBACK_HOURS = 26;

export type CronAuth = { ok: true } | { ok: false; status: 401 | 503; error: string };

/** Fail closed: without CRON_SECRET configured the poll route refuses every caller. */
export function checkCronAuth(req: Request): CronAuth {
  const secret = getSecret("CRON_SECRET");
  if (!secret) return { ok: false, status: 503, error: "CRON_SECRET is not configured; the poll route is disabled." };
  const header = req.headers.get("authorization") ?? "";
  const a = Buffer.from(header);
  const b = Buffer.from(`Bearer ${secret}`);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return { ok: false, status: 401, error: "Unauthorized" };
  return { ok: true };
}

export type QueuedProposal = {
  orderId: string;
  label: string;
  action: "hold_orders" | "approve_orders";
  /** What the shared risk policy says. The queue never executes either way: a human confirms in the desk. */
  policyLevel: "auto" | "confirm";
  reasons: string[];
  fraudScore: number;
  riskLevel: RiskLevel;
  totalPrice: number;
  currency: string;
  source: "shopify" | "demo";
  /** Approving a real order fulfils it in Shopify; Helix cannot undo that. */
  irreversibleOnShopify: boolean;
};

function isOpen(o: StoredOrder): boolean {
  return !o.reviewDecision && o.fulfillmentStatus !== "fulfilled" && o.fulfillmentStatus !== "cancelled";
}

export function orderLabel(o: StoredOrder): string {
  return `#${o.shopifyOrderId.split("/").pop()} ${o.customerName}`;
}

/** Proposals for open orders: hold when flagged for review, otherwise approve. Nothing is applied here. */
export async function buildOrderProposals(orders: StoredOrder[]): Promise<QueuedProposal[]> {
  const ctx = { actor: "Helix automation (proposal only)" };
  const out: QueuedProposal[] = [];
  for (const o of orders.filter(isOpen)) {
    const action = o.requiresReview ? "hold_orders" : "approve_orders";
    let policyLevel: "auto" | "confirm" = "confirm";
    let reasons: string[] = [];
    try {
      const r = await commerceActions[action].assess([o.id], {}, ctx);
      policyLevel = r.level;
      reasons = r.reasons;
    } catch (err) {
      reasons = [`Risk check failed: ${err instanceof Error ? err.message : String(err)}`];
    }
    const demo = isDemoShopifyId(o.shopifyOrderId);
    out.push({
      orderId: o.id,
      label: orderLabel(o),
      action,
      policyLevel,
      reasons,
      fraudScore: o.fraudScore,
      riskLevel: o.riskLevel,
      totalPrice: o.totalPrice,
      currency: o.currency,
      source: demo ? "demo" : "shopify",
      irreversibleOnShopify: action === "approve_orders" && !demo,
    });
  }
  return out.sort((a, b) => b.fraudScore - a.fraudScore);
}

export type PollRun = {
  at: string;
  ok: boolean;
  skipped?: string;
  error?: string;
  fetched: number;
  newOrders: number;
  proposals: QueuedProposal[];
  postedToSlack: boolean;
};

const g = globalThis as { __helixCommerceLastPoll?: PollRun };

export function lastPollRun(): PollRun | null {
  return g.__helixCommerceLastPoll ?? null;
}

function deskUrl(): string | undefined {
  const explicit = process.env.HELIX_COMMERCE_URL?.trim();
  if (explicit) return `${explicit.replace(/\/$/, "")}/risk`;
  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  return vercel ? `https://${vercel}/risk` : undefined;
}

/**
 * Polls Shopify for orders Helix has not seen, scores them with the existing pipeline, and queues
 * hold/approve proposals. It never approves, fulfils, holds or cancels anything by itself.
 */
export async function pollNewOrders(now = Date.now()): Promise<PollRun> {
  const at = new Date(now).toISOString();
  const done = (run: Omit<PollRun, "at">): PollRun => {
    g.__helixCommerceLastPoll = { at, ...run };
    return g.__helixCommerceLastPoll;
  };
  const empty = { fetched: 0, newOrders: 0, proposals: [], postedToSlack: false };

  const client = getLiveShopifyClient();
  if (!client) return done({ ok: true, skipped: "Shopify is not configured (SHOPIFY_STORE_DOMAIN + SHOPIFY_ACCESS_TOKEN).", ...empty });

  const lookbackHours = Number(process.env.CRON_LOOKBACK_HOURS) > 0 ? Number(process.env.CRON_LOOKBACK_HOURS) : DEFAULT_LOOKBACK_HOURS;
  const since = new Date(now - lookbackHours * 3_600_000).toISOString();

  // Read the desk first: it settles demo/live mode, which resets the sync marker if the mode flips.
  const known = new Set((await listOrders()).map((o) => o.shopifyOrderId));

  let fetched;
  try {
    fetched = await client.fetchOrdersCreatedSince(since);
  } catch (err) {
    return done({ ok: false, error: err instanceof Error ? err.message : String(err), ...empty });
  }
  markShopifySync(at);

  const fresh = fetched.filter((o) => !known.has(o.shopifyOrderId));
  const stored: StoredOrder[] = [];
  for (const input of fresh) {
    const numeric = input.shopifyOrderId.split("/").pop() ?? "";
    const shopifyRisks = await client.fetchOrderRisks(numeric);
    stored.push(await upsertOrderFromInput({ ...input, shopifyRisks }));
  }

  const proposals = await buildOrderProposals(stored);
  const postedToSlack = await notifySlackOrderAlert(
    proposals.map((p) => ({
      label: p.label,
      usd: p.totalPrice,
      currency: p.currency,
      fraudScore: p.fraudScore,
      action: p.action === "hold_orders" ? "hold for review" : "approve (needs confirmation)",
    })),
    deskUrl()
  );

  return done({ ok: true, fetched: fetched.length, newOrders: stored.length, proposals, postedToSlack });
}
