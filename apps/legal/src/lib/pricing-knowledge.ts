import { getSupabase } from "@/lib/supabase";
import { memoryPricingBook } from "@/lib/pricing-memory";
import { isPracticeArea, type HistoricalPrice, type PricingBook, type PricingRule } from "@/lib/pricing-types";

function asPractice(value: string | null | undefined): HistoricalPrice["practiceArea"] {
  return isPracticeArea(String(value ?? "")) ? (value as HistoricalPrice["practiceArea"]) : "Litigation";
}

function num(value: unknown, fallback = 0): number {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : fallback;
}

export async function loadPricingBook(): Promise<PricingBook> {
  const db = getSupabase();
  if (!db) return memoryPricingBook();
  try {
    const { data: histRows, error: histErr } = await db
      .from("historical_pricing")
      .select(
        "id, rfp_title, practice_area, jurisdiction, complexity_score, estimated_hours, actual_hours, proposed_amount, won_amount, win_rate, created_at"
      );
    if (histErr || !histRows?.length) return memoryPricingBook();
    const { data: ruleRows, error: ruleErr } = await db
      .from("pricing_rules")
      .select("id, practice_area, min_rate, max_rate, avg_rate, jurisdiction");
    if (ruleErr || !ruleRows?.length) return memoryPricingBook();

    const historical: HistoricalPrice[] = histRows.map((row) => ({
      id: String(row.id),
      rfpTitle: String(row.rfp_title ?? ""),
      practiceArea: asPractice(row.practice_area),
      jurisdiction: String(row.jurisdiction ?? "US"),
      complexityScore: num(row.complexity_score, 5),
      estimatedHours: num(row.estimated_hours, 80),
      actualHours: row.actual_hours == null ? null : num(row.actual_hours),
      proposedAmount: num(row.proposed_amount),
      wonAmount: row.won_amount == null ? null : num(row.won_amount),
      winRate: num(row.win_rate),
      createdAt: String(row.created_at ?? new Date().toISOString()),
    }));
    const rules: PricingRule[] = ruleRows.map((row) => ({
      id: String(row.id),
      practiceArea: asPractice(row.practice_area),
      minRate: num(row.min_rate),
      maxRate: num(row.max_rate),
      avgRate: num(row.avg_rate),
      jurisdiction: String(row.jurisdiction ?? "US"),
    }));
    return { historical, rules, source: "supabase" };
  } catch {
    return memoryPricingBook();
  }
}
