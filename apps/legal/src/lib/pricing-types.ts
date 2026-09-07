export const PRACTICE_AREAS = ["Litigation", "Employment", "Healthcare"] as const;
export type PracticeArea = (typeof PRACTICE_AREAS)[number];

export type HistoricalPrice = {
  id: string;
  rfpTitle: string;
  practiceArea: PracticeArea;
  jurisdiction: string;
  complexityScore: number;
  estimatedHours: number;
  actualHours: number | null;
  proposedAmount: number;
  wonAmount: number | null;
  winRate: number;
  createdAt: string;
};

export type PricingRule = {
  id: string;
  practiceArea: PracticeArea;
  minRate: number;
  maxRate: number;
  avgRate: number;
  jurisdiction: string;
};

export type PricingBook = {
  historical: HistoricalPrice[];
  rules: PricingRule[];
  source: "supabase" | "memory";
};

export type BudgetFit = "under" | "at" | "over" | "unknown";

export type PricingQuote = {
  rfpId: string;
  practiceArea: PracticeArea;
  jurisdiction: string;
  complexityScore: number;
  estimatedHours: number;
  hourlyRate: number;
  floor: number;
  target: number;
  ceiling: number;
  rfpBudget: number | null;
  vsBudget: BudgetFit;
  comparableTitle: string | null;
  comparableWinRate: number | null;
  why: string;
  engine: "claude" | "heuristic";
  claudeFailed: boolean;
  checkedAt: string;
};

export type PricingOverrides = {
  practiceArea?: PracticeArea;
  complexityScore?: number;
  estimatedHours?: number;
};

export function isPracticeArea(value: string): value is PracticeArea {
  return (PRACTICE_AREAS as readonly string[]).includes(value);
}
