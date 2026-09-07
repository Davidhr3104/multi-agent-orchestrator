import { describe, expect, it } from "vitest";
import { classifyInquiryHeuristic } from "./inquiryHeuristic";

describe("classifyInquiryHeuristic", () => {
  it("classifies order status questions", () => {
    const result = classifyInquiryHeuristic({
      customerEmail: "a@example.com",
      inquiryText: "Hi, where is my order? It's been a week since I placed it.",
    });
    expect(result.inquiryType).toBe("order_status");
    expect(result.demoMode).toBe(true);
    expect(result.engine).toBe("heuristic");
  });

  it("classifies refund requests and flags negative sentiment", () => {
    const result = classifyInquiryHeuristic({
      customerEmail: "b@example.com",
      inquiryText: "This product is broken, I want a refund immediately, terrible experience.",
    });
    expect(result.inquiryType).toBe("return_refund");
    expect(result.sentiment).toBe("negative");
    expect(result.requiresHuman).toBe(true);
  });

  it("classifies product questions as low-risk and not requiring human", () => {
    const result = classifyInquiryHeuristic({
      customerEmail: "c@example.com",
      inquiryText: "Does this shirt come in size XL?",
    });
    expect(result.inquiryType).toBe("product_question");
    expect(result.requiresHuman).toBe(false);
  });

  it("always routes complaints to human review regardless of sentiment wording", () => {
    const result = classifyInquiryHeuristic({
      customerEmail: "d@example.com",
      inquiryText: "I am extremely unhappy and will report this to my bank / dispute the charge.",
    });
    expect(result.inquiryType).toBe("complaint");
    expect(result.requiresHuman).toBe(true);
  });

  it("falls back to other for unrecognized text without crashing", () => {
    const result = classifyInquiryHeuristic({
      customerEmail: "e@example.com",
      inquiryText: "asdkfj qwoeiru",
    });
    expect(result.inquiryType).toBe("other");
  });
});
