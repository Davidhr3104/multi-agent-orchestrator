import { describe, expect, it } from "vitest";
import { DEFAULT_LEGAL_PROFILE } from "./prompts";
import { scoreRfpHeuristic } from "./heuristic";

const PI_BODY =
  "Due: 2026-09-18. Budget $85k. Method: BEAR. Need clinical chart review and IME summarization for personal injury files.";

describe("rfp heuristic", () => {
  it("extracts BEAR, dollar amount, and cites the spans", () => {
    const scored = scoreRfpHeuristic({
      title: "Medical record abstraction",
      issuer: "Northstar PI Consortium",
      body: PI_BODY,
      clientProfile: DEFAULT_LEGAL_PROFILE,
    });
    expect(scored.method).toBe("BEAR");
    expect(scored.amount).toMatch(/85/i);
    expect(scored.tier).toBe("hot");
    const amount = scored.fields.find((f) => f.key === "amount");
    expect(amount?.verified).toBe(true);
    expect(amount?.quote).toMatch(/\$\s?85/i);
    expect(PI_BODY.includes(amount?.quote ?? "")).toBe(true);
    const method = scored.fields.find((f) => f.key === "method");
    expect(method?.quote.toUpperCase()).toBe("BEAR");
  });

  it("FACT-unverified when amount and method are missing", () => {
    const scored = scoreRfpHeuristic({
      title: "Thin posting",
      body: "Looking for AI help with documents. Timeline TBD.",
    });
    expect(scored.unverifiedCount).toBeGreaterThanOrEqual(2);
    expect(scored.needsReview).toBe(true);
    const amount = scored.fields.find((f) => f.key === "amount");
    expect(amount?.verified).toBe(false);
    expect(amount?.evidence.startsWith("FACT:")).toBe(true);
  });

  it("HITL on mid-confidence thin RFPs", () => {
    const scored = scoreRfpHeuristic({
      title: "Clinical NLP RFP (thin posting)",
      issuer: "Unspecified",
      body: "Looking for AI help with documents. Timeline TBD. Method not stated.",
    });
    expect(scored.needsReview).toBe(true);
  });

  it("changes match when the client profile changes", () => {
    const shopifyRfp = {
      title: "Shopify catalog sync",
      issuer: "Retail Co",
      body: "Due 2026-11-01. $210k Shopify Admin GraphQL catalog enrichment. Kubernetes later.",
    };
    const asInjury = scoreRfpHeuristic({ ...shopifyRfp, clientProfile: DEFAULT_LEGAL_PROFILE });
    const asCommerce = scoreRfpHeuristic({
      ...shopifyRfp,
      clientProfile:
        "Ecommerce agency. We bid on Shopify catalog sync, GraphQL Admin API, and product enrichment RFPs.",
    });
    expect(asCommerce.matchScore).toBeGreaterThan(asInjury.matchScore);
    expect(asCommerce.matchScore).toBeGreaterThanOrEqual(50);
  });
});
