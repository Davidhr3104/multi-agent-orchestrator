import type { NoBidRule } from "@/lib/pricing-types";

/** Demo fallback — mirrors the old free-text corpus policy, now structured. */
export function memoryNoBidRules(): NoBidRule[] {
  return [
    {
      id: "nb-1",
      pattern: "kubernetes",
      reason: "Pure Kubernetes / SaaS catalog work is outside the firm's practice areas.",
      enabled: true,
      createdAt: new Date().toISOString(),
    },
    {
      id: "nb-2",
      pattern: "shopify",
      reason: "Shopify-adjacent vendor portal work is outside the firm's practice areas.",
      enabled: true,
      createdAt: new Date().toISOString(),
    },
  ];
}
