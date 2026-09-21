import { mapShopifyOrderRow, verifyShopifyWebhook, isShopifyWebhookConfigured, getLiveShopifyClient } from "@/lib/shopify";
import { upsertOrderFromInput } from "@/lib/store";

export const runtime = "nodejs";

const ORDER_TOPICS = new Set(["orders/create", "orders/updated", "orders/cancelled"]);
const REFETCH_TOPICS = new Set(["fulfillments/create", "fulfillments/update", "refunds/create"]);

/**
 * Live Shopify webhook receiver. Auth is Shopify's own HMAC scheme (see
 * verifyShopifyWebhook), not requireOperator — Shopify calls this
 * server-to-server with no operator session, same reasoning as the GHL/Gmail
 * webhooks in the other Helix desks.
 */
export async function POST(req: Request) {
  if (!isShopifyWebhookConfigured()) {
    return Response.json({ error: "SHOPIFY_WEBHOOK_SECRET required. Paste it in Settings." }, { status: 409 });
  }

  const rawBody = await req.text();
  const hmac = req.headers.get("x-shopify-hmac-sha256");
  if (!verifyShopifyWebhook(rawBody, hmac)) {
    return Response.json({ error: "Invalid webhook signature." }, { status: 401 });
  }

  const topic = req.headers.get("x-shopify-topic") ?? "";
  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  try {
    if (ORDER_TOPICS.has(topic)) {
      const input = mapShopifyOrderRow(payload);
      const order = await upsertOrderFromInput(input);
      return Response.json({ ok: true, orderId: order.id });
    }

    if (REFETCH_TOPICS.has(topic)) {
      // fulfillments/* and refunds/* payloads carry order_id but not the
      // full order — re-fetch current order state from Shopify rather than
      // guessing at what changed from a partial payload.
      const orderId = String((payload as Record<string, unknown>).order_id ?? "");
      if (!orderId) {
        return Response.json({ error: `${topic} payload missing order_id` }, { status: 400 });
      }
      const client = getLiveShopifyClient();
      if (!client) {
        return Response.json({ error: "Shopify not configured for refetch." }, { status: 409 });
      }
      const input = await client.fetchOrderById(orderId);
      if (!input) {
        return Response.json({ error: `Could not refetch order ${orderId} from Shopify.` }, { status: 502 });
      }
      const order = await upsertOrderFromInput(input);
      return Response.json({ ok: true, orderId: order.id });
    }

    // Unrecognized topic: acknowledge rather than 4xx/5xx (Shopify retries
    // failed webhooks and can disable the subscription after repeated
    // failures) — but say so explicitly, don't silently pretend it mattered.
    return Response.json({ ok: true, ignored: topic });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return Response.json({ error: message }, { status: 500 });
  }
}
