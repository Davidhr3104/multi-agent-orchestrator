import type { RiskLevel, StoredOrder } from "@helix/core";
import { claudeText, unsupportedNumbers, type ClaudeUsage } from "@/lib/claude-usage";
import { isDemoShopifyId } from "@/lib/order-decision";
import { getLiveShopifyClient, numericIdFromGid } from "@/lib/shopify";

export type FraudSignal = {
  /** Shopify field path the signal was read from, e.g. "billing_address.country_code". */
  field: string;
  value: string | number | boolean | null;
  note: string;
  kind: "risk" | "neutral" | "reassuring";
};

export type FraudExplanation = {
  orderId: string;
  shopifyOrderId: string;
  source: "shopify" | "demo";
  /** True only when Shopify's Admin API answered for this order just now. */
  fetchedFromShopify: boolean;
  generatedAt: string;
  fraudScore: number;
  riskLevel: RiskLevel;
  signals: FraudSignal[];
  explanation: string;
  engine: "claude" | "deterministic";
  engineNote?: string;
  usage?: ClaudeUsage;
};

type Rec = Record<string, unknown>;

function rec(v: unknown): Rec | null {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Rec) : null;
}

function str(v: unknown): string | null {
  return v == null || v === "" ? null : String(v);
}

function norm(v: string | null): string {
  return (v ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

function emailDomain(email: string | null): string | null {
  const at = email?.lastIndexOf("@") ?? -1;
  return email && at >= 0 ? email.slice(at + 1).toLowerCase() : null;
}

function compareAddressField(signals: FraudSignal[], billing: Rec, shipping: Rec, key: string) {
  const b = str(billing[key]);
  const s = str(shipping[key]);
  if (!b || !s) return;
  const differs = norm(b) !== norm(s);
  signals.push({
    field: `billing_address.${key} vs shipping_address.${key}`,
    value: differs ? `${b} ≠ ${s}` : b,
    note: differs ? `Billing ${key} (${b}) differs from shipping ${key} (${s}).` : `Billing and shipping ${key} match (${b}).`,
    kind: differs ? "risk" : "reassuring",
  });
}

/**
 * Signals read straight from order fields. Names and emails are compared here and only the
 * outcome (match / no match, email domain) is passed on, so customer PII is not sent to the model.
 */
export function extractFraudSignals(order: StoredOrder, raw?: Rec | null): FraudSignal[] {
  const signals: FraudSignal[] = [];
  const shipping = rec(raw?.shipping_address) ?? (order.shippingAddress as Rec);
  const billing = rec(raw?.billing_address);
  const customer = rec(raw?.customer);

  signals.push({
    field: "total_price",
    value: order.totalPrice,
    note: `Order total ${order.totalPrice.toFixed(2)} ${order.currency}.`,
    kind: order.totalPrice >= 500 ? "risk" : "neutral",
  });

  const ordersCount = customer?.orders_count != null ? Number(customer.orders_count) : order.customerOrderCount;
  signals.push({
    field: "customer.orders_count",
    value: ordersCount,
    note: ordersCount === 0 ? "No prior orders from this customer." : `Customer has ${ordersCount} prior orders.`,
    kind: ordersCount === 0 ? "risk" : "reassuring",
  });

  if (customer?.total_spent != null) {
    signals.push({
      field: "customer.total_spent",
      value: Number(customer.total_spent),
      note: `Customer lifetime spend ${Number(customer.total_spent).toFixed(2)}.`,
      kind: "neutral",
    });
  }

  signals.push({
    field: "financial_status",
    value: order.financialStatus || null,
    note: `Payment status is "${order.financialStatus || "unknown"}".`,
    kind: order.financialStatus === "pending" ? "risk" : "neutral",
  });

  const missing = ["address1", "city", "country"].filter((k) => !str(shipping[k]));
  signals.push({
    field: "shipping_address",
    value: missing.length ? `missing ${missing.join(", ")}` : "complete",
    note: missing.length ? `Shipping address is missing ${missing.join(", ")}.` : "Shipping address is complete.",
    kind: missing.length ? "risk" : "reassuring",
  });

  if (billing) {
    compareAddressField(signals, billing, shipping, "country_code");
    compareAddressField(signals, billing, shipping, "zip");
    const bn = norm(str(billing.name));
    const sn = norm(str(shipping.name));
    if (bn && sn) {
      const match = bn === sn || bn.includes(sn) || sn.includes(bn);
      signals.push({
        field: "billing_address.name vs shipping_address.name",
        value: match,
        note: match ? "Billing and shipping names match." : "Billing and shipping names do not match.",
        kind: match ? "reassuring" : "risk",
      });
    }
  } else {
    const cn = norm(order.customerName);
    const sn = norm(str(shipping.name));
    if (cn && sn && cn !== sn && !cn.includes(sn) && !sn.includes(cn)) {
      signals.push({
        field: "customer.first_name vs shipping_address.name",
        value: false,
        note: "Customer name and shipping name do not match.",
        kind: "risk",
      });
    }
  }

  const domain = emailDomain(str(raw?.email) ?? order.customerEmail);
  if (domain) {
    const disposable = /(tempmail|mailinator|guerrillamail|10minutemail|yopmail|trashmail)/.test(domain);
    signals.push({
      field: "email (domain only)",
      value: domain,
      note: disposable ? `Email domain ${domain} looks disposable.` : `Email domain ${domain}.`,
      kind: disposable ? "risk" : "neutral",
    });
  }

  const gateways = Array.isArray(raw?.payment_gateway_names) ? (raw.payment_gateway_names as unknown[]).map(String) : [];
  if (gateways.length) {
    signals.push({ field: "payment_gateway_names", value: gateways.join(", "), note: `Paid via ${gateways.join(", ")}.`, kind: "neutral" });
  }

  const discounts = Array.isArray(raw?.discount_codes) ? raw.discount_codes.length : 0;
  if (discounts > 0) {
    signals.push({ field: "discount_codes", value: discounts, note: `${discounts} discount code(s) applied.`, kind: "neutral" });
  }

  for (const r of order.shopifyRisks ?? []) {
    signals.push({
      field: "risks[].recommendation",
      value: r.recommendation,
      note: `Shopify risk analysis (${r.source}) recommends "${r.recommendation}" (score ${r.score}): ${r.message}`,
      kind: r.recommendation === "accept" ? "reassuring" : "risk",
    });
  }

  return signals;
}

export function deterministicExplanation(order: StoredOrder, signals: FraudSignal[]): string {
  const risks = signals.filter((s) => s.kind === "risk");
  const head = `Fraud score ${order.fraudScore}/100 (${order.riskLevel}).`;
  if (risks.length === 0) return `${head} No risk signals in the order fields.`;
  return `${head} ${risks.map((s) => `[${s.field}] ${s.note}`).join(" ")}`;
}

const SYSTEM = `You explain e-commerce fraud scores to a store operator.
Rules:
- Use ONLY the signals provided. Never invent facts, numbers, or fields.
- Cite each fact with its field name in square brackets, e.g. [billing_address.country_code vs shipping_address.country_code].
- Do not change or re-estimate the score; it was computed elsewhere.
- Do not recommend approving or cancelling automatically: a human decides.
- 2 to 4 short sentences, plain text, no markdown headings, no bullet lists.`;

/** Claude explains the real order fields; without a key (or if the model invents a number) the deterministic text is used and labelled. */
export async function explainOrderFraud(order: StoredOrder): Promise<FraudExplanation> {
  const demo = isDemoShopifyId(order.shopifyOrderId);
  const live = demo ? null : getLiveShopifyClient();
  const raw = live ? await live.fetchRawOrder(numericIdFromGid(order.shopifyOrderId)) : null;
  const signals = extractFraudSignals(order, raw);

  const base = {
    orderId: order.id,
    shopifyOrderId: order.shopifyOrderId,
    source: demo ? ("demo" as const) : ("shopify" as const),
    fetchedFromShopify: Boolean(raw),
    generatedAt: new Date().toISOString(),
    fraudScore: order.fraudScore,
    riskLevel: order.riskLevel,
    signals,
  };
  const fallback = deterministicExplanation(order, signals);

  const payload = { fraudScore: order.fraudScore, riskLevel: order.riskLevel, signals };
  const ai = await claudeText({
    feature: "fraud_explanation",
    system: SYSTEM,
    prompt: `Order signals (JSON):\n${JSON.stringify(payload)}\n\nExplain why this order got this score.`,
    maxTokens: 350,
  });
  if (ai.text === null) {
    return { ...base, explanation: fallback, engine: "deterministic", engineNote: `Deterministic explanation — ${ai.error}.` };
  }
  const invented = unsupportedNumbers(ai.text, payload);
  if (invented.length) {
    return {
      ...base,
      explanation: fallback,
      engine: "deterministic",
      engineNote: `Claude's text was discarded: it cited numbers not in the order data (${invented.join(", ")}).`,
      usage: ai.usage,
    };
  }
  return { ...base, explanation: ai.text, engine: "claude", usage: ai.usage };
}
