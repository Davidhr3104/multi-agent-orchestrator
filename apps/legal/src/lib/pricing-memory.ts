import type { HistoricalPrice, PricingBook, PricingRule } from "@/lib/pricing-types";

const HISTORICAL: HistoricalPrice[] = [
  {
    id: "hp-mass-tort",
    rfpTitle: "Mass Tort Defense 2024",
    practiceArea: "Litigation",
    jurisdiction: "US",
    complexityScore: 8,
    estimatedHours: 200,
    actualHours: null,
    proposedAmount: 400_000,
    wonAmount: 380_000,
    winRate: 75,
    createdAt: "2026-03-12T00:00:00.000Z",
  },
  {
    id: "hp-workers",
    rfpTitle: "Workers Comp Audit",
    practiceArea: "Employment",
    jurisdiction: "US",
    complexityScore: 5,
    estimatedHours: 80,
    actualHours: null,
    proposedAmount: 160_000,
    wonAmount: 150_000,
    winRate: 80,
    createdAt: "2026-04-02T00:00:00.000Z",
  },
  {
    id: "hp-med-review",
    rfpTitle: "Medical Record Review",
    practiceArea: "Healthcare",
    jurisdiction: "US",
    complexityScore: 6,
    estimatedHours: 120,
    actualHours: null,
    proposedAmount: 240_000,
    wonAmount: 220_000,
    winRate: 70,
    createdAt: "2026-05-18T00:00:00.000Z",
  },
];

const RULES: PricingRule[] = [
  { id: "pr-lit", practiceArea: "Litigation", minRate: 1500, maxRate: 2500, avgRate: 2000, jurisdiction: "US" },
  { id: "pr-emp", practiceArea: "Employment", minRate: 1200, maxRate: 2000, avgRate: 1600, jurisdiction: "US" },
  { id: "pr-hc", practiceArea: "Healthcare", minRate: 1400, maxRate: 2200, avgRate: 1800, jurisdiction: "US" },
];

export function memoryPricingBook(): PricingBook {
  return { historical: HISTORICAL, rules: RULES, source: "memory" };
}
