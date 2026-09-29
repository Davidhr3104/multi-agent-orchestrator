import { askAi, askAiWithProposal, isClaudeConfigured, type AskAiMessage } from "@helix/core";
import type { StoredOrder } from "@helix/core";
import { applyRiskPolicy } from "@/lib/ai-desk";
import { buildDemoReply } from "@/lib/demo-assistant";
import { currentDeskMode, getOrder, listOrders, listProducts } from "@/lib/store";

const PROPOSAL_INSTRUCTION = `Only when the operator explicitly asks you to act, respond with ONLY a fenced json block (no other text) matching this exact shape:
\`\`\`json
{"type":"action_proposal","action":"<action>","summary":"<one sentence>","targets":[{"id":"<id>","label":"<name>"}]}
\`\`\`
Supported actions — targets must be ids copied from the desk snapshot below, never invented:
- "hold_orders": hold an order for human review (order ids).
- "approve_orders": approve and fulfil an order (order ids).
- "cancel_orders": cancel an order (order ids).
- "create_reorders": draft a reorder request (product ids).
For any other question, answer normally in plain text; do not emit a json block.`;

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

async function buildSnapshotContext(): Promise<string> {
  const [orders, products] = await Promise.all([listOrders(), listProducts()]);
  const byRisk: Record<string, number> = {};
  for (const o of orders) byRisk[o.riskLevel] = (byRisk[o.riskLevel] ?? 0) + 1;
  const risky = [...orders]
    .sort((a, b) => b.fraudScore - a.fraudScore)
    .slice(0, 8)
    .map(
      (o) =>
        `- Order ${o.shopifyOrderId} [id: ${o.id}] (${o.customerName}, ${o.currency} ${o.totalPrice}): fraud score ${o.fraudScore}, risk ${o.riskLevel}, review decision ${o.reviewDecision ?? "pending"}`
    )
    .join("\n");
  const low = products
    .filter((p) => p.currentInventory <= p.reorderPoint)
    .slice(0, 8)
    .map((p) => `- ${p.title} [id: ${p.id}] (${p.sku}): ${p.currentInventory} in stock, reorder point ${p.reorderPoint}`)
    .join("\n");
  return [
    `Desk snapshot — orders: ${orders.length}, awaiting review: ${orders.filter((o) => o.requiresReview && !o.reviewDecision).length}`,
    `Orders by risk level: ${Object.entries(byRisk).map(([k, v]) => `${k}=${v}`).join(", ") || "none"}`,
    `Highest-risk orders:`,
    risky || "None.",
    `Products at or below reorder point:`,
    low || "None.",
  ].join("\n");
}

export async function POST(req: Request) {
  const body = (await req.json()) as { orderId?: string; history?: AskAiMessage[]; mode?: "card" | "drawer" };

  if (!Array.isArray(body.history) || body.history.length === 0) {
    return Response.json({ error: "history must be a non-empty array" }, { status: 400 });
  }

  let recordContext: string | undefined;
  if (body.orderId) {
    const order = await getOrder(body.orderId);
    if (!order) return Response.json({ error: "Order not found" }, { status: 404 });
    recordContext = buildRecordContext(order);
  } else if (body.mode === "drawer") {
    recordContext = await buildSnapshotContext();
  }

  if (body.mode === "drawer") {
    // Demo desk without a Claude key: answer from the real records with the deterministic assistant.
    if (!isClaudeConfigured() && currentDeskMode() === "demo") {
      const last = body.history[body.history.length - 1];
      if (last.attachments?.length) {
        return Response.json({
          answer: "I can't read attachments in demo mode. Connect an ANTHROPIC_API_KEY and I'll analyze images alongside your orders.",
          engine: "fallback",
          demo: true,
        });
      }
      const reply = buildDemoReply(last.content, await listOrders(), await listProducts());
      return Response.json({ ...(await applyRiskPolicy(req, reply)), engine: "fallback", demo: true });
    }
    const result = await askAiWithProposal({
      systemPrompt: SYSTEM_PROMPT,
      recordContext,
      history: body.history,
      proposalInstruction: PROPOSAL_INSTRUCTION,
    });
    // Claude only emits a proposal when the operator explicitly asked to act, so treat it as a command.
    return Response.json(await applyRiskPolicy(req, { ...result, command: Boolean(result.proposal) }));
  }

  const result = await askAi({
    systemPrompt: SYSTEM_PROMPT,
    recordContext,
    history: body.history,
  });

  return Response.json(result);
}
