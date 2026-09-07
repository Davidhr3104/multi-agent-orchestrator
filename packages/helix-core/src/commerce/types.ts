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
};

export type FraudScoreResult = {
  fraudScore: number;
  fraudReasoning: string;
  riskLevel: RiskLevel;
  requiresReview: boolean;
  engine: "claude" | "heuristic";
  /** True when ANTHROPIC_API_KEY isn't configured (or Claude's response was rejected) — always shown explicitly, never indistinguishable from a live Claude run. */
  demoMode: boolean;
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
