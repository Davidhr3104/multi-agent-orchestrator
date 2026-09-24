export type RiskLevel = "low" | "medium" | "high" | "critical";

export type OrderItem = {
  title: string;
  sku?: string;
  quantity: number;
  price: number;
};

export type ShippingAddress = {
  name?: string;
  address1?: string;
  city?: string;
  province?: string;
  country?: string;
  zip?: string;
};

export type ShopifyRiskRecommendation = "accept" | "investigate" | "cancel";

/** One risk assessment from Shopify's own fraud analysis (orders/{id}/risks.json) — e.g. Shopify Protect. Not Helix's heuristic. */
export type ShopifyRiskSignal = {
  recommendation: ShopifyRiskRecommendation;
  /** 0–1 as reported by Shopify. */
  score: number;
  message: string;
  source: string;
};

export type OrderInput = {
  shopifyOrderId: string;
  customerName: string;
  customerEmail: string;
  totalPrice: number;
  currency: string;
  financialStatus: string;
  fulfillmentStatus: string;
  items: OrderItem[];
  shippingAddress: ShippingAddress;
  createdAt: string;
  /** Number of prior orders from this same customer email — proxy for account history. */
  customerOrderCount: number;
  /** Native Shopify fraud signals for this order, when available (requires an extra API call). Empty array if none reported. */
  shopifyRisks?: ShopifyRiskSignal[];
};

export type FraudScoreResult = {
  fraudScore: number;
  fraudReasoning: string;
  riskLevel: RiskLevel;
  requiresReview: boolean;
  engine: "claude" | "heuristic";
  /** True when ANTHROPIC_API_KEY isn't configured (or Claude's response was rejected) — always shown explicitly, never indistinguishable from a live Claude run. */
  demoMode: boolean;
  /** True when a Shopify-native risk signal (e.g. Shopify Protect "cancel"/"investigate") contributed to fraudScore/requiresReview — not just Helix's own heuristic. */
  shopifySignalApplied: boolean;
};

export type StoredOrder = OrderInput &
  FraudScoreResult & {
    id: string;
    reviewedBy?: string;
    reviewedAt?: string;
    reviewDecision?: "approved" | "flagged" | "cancelled";
  };

export type ProductInput = {
  shopifyProductId: string;
  title: string;
  sku: string;
  currentInventory: number;
  reorderPoint: number;
  price: number;
  imageUrl?: string;
  /** Units sold per day, trailing average. */
  salesVelocity: number;
};

export type InventoryPredictionResult = {
  predictedStockoutDays: number;
  restockRecommended: boolean;
  reasoning: string;
  engine: "claude" | "heuristic";
  demoMode: boolean;
};

export type StoredProduct = ProductInput & InventoryPredictionResult & { id: string };

export type ReturnStatus = "requested" | "approved" | "refunded" | "rejected";

/**
 * A lightweight returns/RMA record tied to one order. Unlike reorder
 * requests, refunding IS a real Shopify write (POST /orders/{id}/refunds.json)
 * — "approved" triggers the live refund when the order isn't a demo order.
 */
export type ReturnRequest = {
  id: string;
  orderId: string;
  shopifyOrderId: string;
  customerEmail: string;
  reason: string;
  refundAmount: number;
  restock: boolean;
  status: ReturnStatus;
  createdAt: string;
  resolvedBy?: string;
  resolvedAt?: string;
  shopifyRefundId?: string;
};

export type ReorderStatus = "draft" | "ordered" | "received" | "cancelled";

/**
 * An internal reorder request — the write-back action for a low-stock
 * product. Shopify's Admin REST API has no native purchase-order endpoint
 * (that's third-party app territory, e.g. Stocky), so this is a Helix-owned
 * record the operator tracks through draft → ordered → received, not a
 * write to Shopify itself.
 */
export type ReorderRequest = {
  id: string;
  productId: string;
  sku: string;
  title: string;
  quantitySuggested: number;
  status: ReorderStatus;
  notes?: string;
  createdAt: string;
  orderedAt?: string;
  receivedAt?: string;
};

export type InquiryType =
  | "order_status"
  | "return_refund"
  | "product_question"
  | "shipping_issue"
  | "complaint"
  | "other";

export type Sentiment = "positive" | "neutral" | "negative";

export type InquiryInput = {
  customerEmail: string;
  inquiryText: string;
};

export type InquiryClassificationResult = {
  inquiryType: InquiryType;
  sentiment: Sentiment;
  aiResponse: string;
  requiresHuman: boolean;
  engine: "claude" | "heuristic";
  demoMode: boolean;
};

export type StoredInquiry = InquiryInput &
  InquiryClassificationResult & {
    id: string;
    createdAt: string;
    status: "pending" | "resolved";
  };

export type AiActionLog = {
  id: string;
  actionType: string;
  entityType: "order" | "product" | "inquiry";
  entityId: string;
  aiDecision: string;
  confidenceScore: number;
  humanOverride: boolean;
  createdAt: string;
};
