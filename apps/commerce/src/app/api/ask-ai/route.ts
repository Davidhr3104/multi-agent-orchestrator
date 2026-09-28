import { askAi, type AskAiMessage } from "@helix/core";
import type { StoredOrder } from "@helix/core";
import { getOrder } from "@/lib/store";

export const runtime = "nodejs";

const SYSTEM_PROMPT = `You are Ask AI inside Helix for Commerce, an e-commerce fraud and operations tool.

How the app works:
- Every incoming order is given a fraud score 0-100 and a risk level (low, medium, high, critical) based on order and customer signals.
- "Fraud reasoning" is the engine's explanation for why it scored the order the way it did.
- Orders can also carry native Shopify risk signals (Shopify Protect) alongside Helix's own heuristic — "shopifySignalApplied" tells you whether that native signal contributed to the score.
- Orders flagged "requires review" are held for a human operator to approve, flag, or cancel before fulfillment.
- The app also predicts inventory stockouts and drafts reorder requests, and triages customer inquiries.

When a specific order's data is provided below, answer using that data — do not invent facts not present in it. When no order data is provided, answer only using the description above.`;

function buildRecordContext(order: StoredOrder): string {
  return [
    `Customer: ${order.customerName} (${order.customerEmail})`,
    `Total: ${order.totalPrice} ${order.currency}`,
    `Fraud score: ${order.fraudScore}`,
    `Risk level: ${order.riskLevel}`,
    `Requires review: ${order.requiresReview}`,
    `Shopify signal applied: ${order.shopifySignalApplied}`,
    `Reasoning: ${order.fraudReasoning}`,
  ].join("\n");
}

export async function POST(req: Request) {
  const body = (await req.json()) as { orderId?: string; history?: AskAiMessage[] };

  if (!Array.isArray(body.history) || body.history.length === 0) {
    return Response.json({ error: "history must be a non-empty array" }, { status: 400 });
  }

  let recordContext: string | undefined;
  if (body.orderId) {
    const order = await getOrder(body.orderId);
    if (!order) return Response.json({ error: "Order not found" }, { status: 404 });
    recordContext = buildRecordContext(order);
  }

  const result = await askAi({
    systemPrompt: SYSTEM_PROMPT,
    recordContext,
    history: body.history,
  });

  return Response.json(result);
}
