import type { FraudScoreResult, OrderInput, RiskLevel } from "./types";

function normalizeName(name: string): string {
  return name.toLowerCase().replace(/[^a-z\s]/g, "").trim();
}

function namesMismatch(customerName: string, shippingName?: string): boolean {
  if (!shippingName) return false;
  const a = normalizeName(customerName);
  const b = normalizeName(shippingName);
  if (!a || !b) return false;
  return a !== b && !a.includes(b) && !b.includes(a);
}

function addressIncomplete(address: OrderInput["shippingAddress"]): boolean {
  return !address.address1 || !address.city || !address.country;
}

export function scoreFraudHeuristic(input: OrderInput): FraudScoreResult {
  const reasons: string[] = [];
  let score = 8;

  const isFirstOrder = input.customerOrderCount === 0;
  if (isFirstOrder) {
    score += 15;
    reasons.push("First-time customer (no prior order history).");
  }

  if (input.totalPrice >= 2000) {
    score += 30;
    reasons.push(`High order value ($${input.totalPrice.toFixed(2)}).`);
  } else if (input.totalPrice >= 500) {
    score += 12;
    reasons.push(`Elevated order value ($${input.totalPrice.toFixed(2)}).`);
  }

  if (addressIncomplete(input.shippingAddress)) {
    score += 25;
    reasons.push("Shipping address is incomplete or missing.");
  }

  if (namesMismatch(input.customerName, input.shippingAddress.name)) {
    score += 20;
    reasons.push("Billing name and shipping name do not match.");
  }

  if (input.financialStatus === "pending" && input.totalPrice >= 500) {
    score += 10;
    reasons.push("Payment still pending on a high-value order.");
  }

  if (isFirstOrder && input.totalPrice >= 2000) {
    score += 10;
    reasons.push("Combination of first order and high value compounds risk.");
  }

  score = Math.max(0, Math.min(100, Math.round(score)));

  let riskLevel: RiskLevel = "low";
  if (score >= 75) riskLevel = "critical";
  else if (score >= 50) riskLevel = "high";
  else if (score >= 25) riskLevel = "medium";

  const requiresReview = riskLevel === "high" || riskLevel === "critical";

  const reasoning =
    reasons.length > 0
      ? `Heuristic fraud score ${score} (${riskLevel}). ${reasons.join(" ")}`
      : `Heuristic fraud score ${score} (${riskLevel}). No risk signals detected.`;

  return {
    fraudScore: score,
    fraudReasoning: reasoning,
    riskLevel,
    requiresReview,
    engine: "heuristic",
    demoMode: true,
  };
}
