import { completeWithClaude, isClaudeConfigured, parseJsonObject, type StoredRfp } from "@helix/core";
import { formatUsdNumber } from "@/lib/money";
import { loadPricingBook } from "@/lib/pricing-knowledge";
import type {
  BudgetFit,
  HistoricalPrice,
  PricingBook,
  PricingOverrides,
  PricingQuote,
  PracticeArea,
} from "@/lib/pricing-types";
import { isPracticeArea } from "@/lib/pricing-types";

const HAIKU = "claude-3-5-haiku-20241022";

export function parseBudget(amount: string): number | null {
  const t = amount.trim();
  if (!t || /unspecified|tbd|n\/a|not stated/i.test(t)) return null;
  const k = t.match(/\$?\s*([\d,.]+)\s*k\b/i);
  if (k) {
    const n = parseFloat(k[1].replace(/,/g, "")) * 1000;
    return Number.isFinite(n) ? n : null;
  }
  const n = Number(t.replace(/[^0-9.]/g, ""));
  return Number.isFinite(n) && n > 0 ? n : null;
}

export function inferPracticeArea(rfp: StoredRfp): PracticeArea {
  const blob = `${rfp.title} ${rfp.body} ${rfp.method}`.toLowerCase();
  if (/worker|employment|occupational|spi coding|\bcomp\b/.test(blob)) return "Employment";
  if (/medical|healthcare|clinical|bear|chart review|ime|nlp/.test(blob)) return "Healthcare";
  if (/tort|litigation|plaintiff|docket|pi consortium/.test(blob)) return "Litigation";
  if (rfp.method === "SPI") return "Employment";
  if (rfp.method === "BEAR") return "Healthcare";
  return "Litigation";
}

export function heuristicComplexity(rfp: StoredRfp): number {
  let c = 5;
  if (rfp.unverifiedCount > 0) c += 1;
  if (rfp.needsReview) c += 1;
  if (rfp.method === "BEAR") c += 1;
  const budget = parseBudget(rfp.amount);
  if (budget != null && budget >= 150_000) c += 1;
  if (budget != null && budget >= 200_000) c += 1;
  return Math.max(1, Math.min(10, c));
}

function roundMoney(n: number): number {
  return Math.max(0, Math.round(n / 1000) * 1000);
}

function pickComparable(book: PricingBook, practice: PracticeArea): HistoricalPrice | null {
  const same = book.historical.filter((h) => h.practiceArea === practice);
  const pool = same.length ? same : book.historical;
  return pool.slice().sort((a, b) => b.winRate - a.winRate)[0] ?? null;
}

function vsBudget(target: number, budget: number | null): BudgetFit {
  if (budget == null) return "unknown";
  const delta = Math.abs(target - budget) / budget;
  if (delta <= 0.08) return "at";
  return target > budget ? "over" : "under";
}

function buildQuote(
  rfp: StoredRfp,
  book: PricingBook,
  practice: PracticeArea,
  complexity: number,
  hours: number,
  engine: PricingQuote["engine"],
  claudeFailed: boolean,
  why?: string
): PricingQuote {
  const rule =
    book.rules.find((r) => r.practiceArea === practice) ??
    book.rules[0] ?? {
      id: "fallback",
      practiceArea: practice,
      minRate: 1400,
      maxRate: 2200,
      avgRate: 1800,
      jurisdiction: "US",
    };
  const comparable = pickComparable(book, practice);
  const target = roundMoney(hours * rule.avgRate);
  const floor = roundMoney(hours * rule.minRate);
  const ceiling = roundMoney(hours * rule.maxRate);
  const rfpBudget = parseBudget(rfp.amount);
  const fit = vsBudget(target, rfpBudget);
  const defaultWhy = comparable
    ? `Priced off ${comparable.rfpTitle} (${comparable.winRate}% modeled win) at ${formatUsdNumber(rule.avgRate)}/hr × ${hours}h.`
    : `Rate card ${practice}: ${formatUsdNumber(rule.minRate)}–${formatUsdNumber(rule.maxRate)}/hr.`;
  return {
    rfpId: rfp.id,
    practiceArea: practice,
    jurisdiction: rule.jurisdiction,
    complexityScore: complexity,
    estimatedHours: hours,
    hourlyRate: rule.avgRate,
    floor,
    target,
    ceiling,
    rfpBudget,
    vsBudget: fit,
    comparableTitle: comparable?.rfpTitle ?? null,
    comparableWinRate: comparable?.winRate ?? null,
    why: why ?? defaultWhy,
    engine,
    claudeFailed,
    checkedAt: new Date().toISOString(),
  };
}

function hoursFromBook(book: PricingBook, practice: PracticeArea, complexity: number): number {
  const comparable = pickComparable(book, practice);
  if (!comparable || comparable.complexityScore <= 0) return 100;
  return Math.max(20, Math.round((comparable.estimatedHours * complexity) / comparable.complexityScore));
}

type ClaudePayload = {
  practiceArea?: string;
  complexityScore?: number;
  estimatedHours?: number;
  why?: string;
};

export async function heuristicPricingQuote(rfp: StoredRfp, overrides?: PricingOverrides): Promise<PricingQuote> {
  const book = await loadPricingBook();
  const practice = overrides?.practiceArea ?? inferPracticeArea(rfp);
  const complexity = overrides?.complexityScore ?? heuristicComplexity(rfp);
  const hours = overrides?.estimatedHours ?? hoursFromBook(book, practice, complexity);
  return buildQuote(rfp, book, practice, complexity, hours, "heuristic", false);
}

export async function runPricingQuote(rfp: StoredRfp, overrides?: PricingOverrides): Promise<PricingQuote> {
  const book = await loadPricingBook();
  const practice = overrides?.practiceArea ?? inferPracticeArea(rfp);
  const complexity = Math.max(1, Math.min(10, overrides?.complexityScore ?? heuristicComplexity(rfp)));
  const hours = Math.max(8, overrides?.estimatedHours ?? hoursFromBook(book, practice, complexity));
  let quote = buildQuote(rfp, book, practice, complexity, hours, "heuristic", !isClaudeConfigured());

  if (!isClaudeConfigured()) return quote;

  const raw = await completeWithClaude(
    [
      `You are a law-firm pricing analyst. Return JSON only.`,
      `Schema: {"practiceArea":"Litigation"|"Employment"|"Healthcare","complexityScore":1-10,"estimatedHours":number,"why":"string"}`,
      `Do not invent historical matters. Stay inside the rate card and comps.`,
      `RFP title: ${rfp.title}`,
      `Issuer: ${rfp.issuer}`,
      `Stated amount: ${rfp.amount}`,
      `Method: ${rfp.method}`,
      `Body: ${rfp.body.slice(0, 1800)}`,
      `Heuristic: ${JSON.stringify({ practice, complexity, hours, target: quote.target })}`,
      `Comps: ${JSON.stringify(book.historical)}`,
      `Rules: ${JSON.stringify(book.rules)}`,
    ].join("\n"),
    500,
    HAIKU
  );
  const parsed = raw ? parseJsonObject<ClaudePayload>(raw) : null;
  if (!raw || !parsed) {
    return { ...quote, claudeFailed: true };
  }
  const nextPractice = parsed.practiceArea && isPracticeArea(parsed.practiceArea) ? parsed.practiceArea : practice;
  const nextComplexity =
    typeof parsed.complexityScore === "number"
      ? Math.max(1, Math.min(10, Math.round(parsed.complexityScore)))
      : complexity;
  const nextHours =
    typeof parsed.estimatedHours === "number" ? Math.max(8, Math.round(parsed.estimatedHours)) : hours;
  quote = buildQuote(
    rfp,
    book,
    overrides?.practiceArea ?? nextPractice,
    overrides?.complexityScore ?? nextComplexity,
    overrides?.estimatedHours ?? nextHours,
    "claude",
    false,
    parsed.why
  );
  return quote;
}
