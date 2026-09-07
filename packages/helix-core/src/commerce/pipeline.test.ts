import { describe, it, expect, vi, beforeEach } from "vitest";
import type { InquiryInput, OrderInput, ProductInput } from "./types";

vi.mock("../claude", () => ({
  isClaudeConfigured: vi.fn(),
  completeWithClaude: vi.fn(),
  parseJsonObject: vi.fn((raw: string) => {
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }),
}));

const { isClaudeConfigured, completeWithClaude } = await import("../claude");
const { runFraudScoring, runInventoryPrediction, runInquiryClassification } = await import(
  "./pipeline"
);

const ORDER: OrderInput = {
  shopifyOrderId: "1001",
  customerName: "Jane Doe",
  customerEmail: "jane@example.com",
  totalPrice: 85,
  currency: "USD",
  financialStatus: "paid",
  fulfillmentStatus: "unfulfilled",
  items: [{ title: "T-Shirt", quantity: 1, price: 85 }],
  shippingAddress: { name: "Jane Doe", address1: "123 Main St", city: "Austin", country: "US" },
  createdAt: new Date().toISOString(),
  customerOrderCount: 3,
};

const PRODUCT: ProductInput = {
  shopifyProductId: "gid://shopify/Product/1",
  title: "Classic Tee",
  sku: "TEE-001",
  currentInventory: 100,
  reorderPoint: 20,
  price: 25,
  salesVelocity: 2,
};

const INQUIRY: InquiryInput = {
  customerEmail: "a@example.com",
  inquiryText: "Where is my order?",
};

beforeEach(() => {
  vi.mocked(isClaudeConfigured).mockReset();
  vi.mocked(completeWithClaude).mockReset();
});

describe("runFraudScoring", () => {
  it("falls back to heuristic when Claude isn't configured", async () => {
    vi.mocked(isClaudeConfigured).mockReturnValue(false);
    const result = await runFraudScoring(ORDER);
    expect(result.engine).toBe("heuristic");
    expect(result.demoMode).toBe(true);
  });

  it("falls back to heuristic on invalid JSON", async () => {
    vi.mocked(isClaudeConfigured).mockReturnValue(true);
    vi.mocked(completeWithClaude).mockResolvedValue("not json");
    const result = await runFraudScoring(ORDER);
    expect(result.engine).toBe("heuristic");
  });

  it("ignores a self-reported risk level that contradicts Claude's own score", async () => {
    // Claude claims "low" risk but gives a score of 90 — the derived level from score
    // must win, never the model's possibly-inconsistent label.
    vi.mocked(isClaudeConfigured).mockReturnValue(true);
    vi.mocked(completeWithClaude).mockResolvedValue(
      JSON.stringify({ fraudScore: 90, riskLevel: "low", reasoning: "test" })
    );
    const result = await runFraudScoring(ORDER);
    expect(result.riskLevel).toBe("critical");
    expect(result.requiresReview).toBe(true);
  });

  it("uses Claude's real score of 0 instead of falling back", async () => {
    vi.mocked(isClaudeConfigured).mockReturnValue(true);
    vi.mocked(completeWithClaude).mockResolvedValue(
      JSON.stringify({ fraudScore: 0, riskLevel: "low", reasoning: "clean order" })
    );
    const result = await runFraudScoring(ORDER);
    expect(result.fraudScore).toBe(0);
    expect(result.engine).toBe("claude");
  });
});

describe("runInventoryPrediction", () => {
  it("falls back to heuristic when Claude isn't configured", async () => {
    vi.mocked(isClaudeConfigured).mockReturnValue(false);
    const result = await runInventoryPrediction(PRODUCT);
    expect(result.engine).toBe("heuristic");
  });

  it("falls back to heuristic on invalid JSON", async () => {
    vi.mocked(isClaudeConfigured).mockReturnValue(true);
    vi.mocked(completeWithClaude).mockResolvedValue(null);
    const result = await runInventoryPrediction(PRODUCT);
    expect(result.engine).toBe("heuristic");
  });

  it("accepts Claude's prediction when JSON is valid", async () => {
    vi.mocked(isClaudeConfigured).mockReturnValue(true);
    vi.mocked(completeWithClaude).mockResolvedValue(
      JSON.stringify({ predictedStockoutDays: 5, restockRecommended: true, reasoning: "test" })
    );
    const result = await runInventoryPrediction(PRODUCT);
    expect(result.predictedStockoutDays).toBe(5);
    expect(result.restockRecommended).toBe(true);
    expect(result.engine).toBe("claude");
  });
});

describe("runInquiryClassification", () => {
  it("falls back to heuristic when Claude isn't configured", async () => {
    vi.mocked(isClaudeConfigured).mockReturnValue(false);
    const result = await runInquiryClassification(INQUIRY);
    expect(result.engine).toBe("heuristic");
  });

  it("keeps requiresHuman true if the heuristic flagged it, even if Claude says false", async () => {
    const complaint: InquiryInput = {
      customerEmail: "b@example.com",
      inquiryText: "I will dispute this charge with my bank, unacceptable.",
    };
    vi.mocked(isClaudeConfigured).mockReturnValue(true);
    vi.mocked(completeWithClaude).mockResolvedValue(
      JSON.stringify({
        inquiryType: "complaint",
        sentiment: "negative",
        aiResponse: "Sorry about that.",
        requiresHuman: false,
      })
    );
    const result = await runInquiryClassification(complaint);
    expect(result.requiresHuman).toBe(true);
  });

  it("falls back to heuristic on invalid JSON", async () => {
    vi.mocked(isClaudeConfigured).mockReturnValue(true);
    vi.mocked(completeWithClaude).mockResolvedValue("not json");
    const result = await runInquiryClassification(INQUIRY);
    expect(result.engine).toBe("heuristic");
  });
});
