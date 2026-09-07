import { completeWithClaude, isClaudeConfigured, parseJsonObject } from "../claude";
import { scoreFraudHeuristic } from "./fraudHeuristic";
import { predictInventoryHeuristic } from "./inventoryHeuristic";
import { classifyInquiryHeuristic } from "./inquiryHeuristic";
import {
  fraudScoringPrompt,
  inquiryClassificationPrompt,
  inventoryPredictionPrompt,
} from "./prompts";
import type {
  FraudScoreResult,
  InquiryClassificationResult,
  InquiryInput,
  InquiryType,
  InventoryPredictionResult,
  OrderInput,
  ProductInput,
  RiskLevel,
  Sentiment,
} from "./types";

function numberOr(value: unknown, fallback: number): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

type ClaudeFraudJson = {
  fraudScore?: number;
  riskLevel?: string;
  reasoning?: string;
};

function normalizeFraud(raw: ClaudeFraudJson, fallback: FraudScoreResult): FraudScoreResult {
  const fraudScore = Math.max(0, Math.min(100, Math.round(numberOr(raw.fraudScore, fallback.fraudScore))));
  const validLevels: RiskLevel[] = ["low", "medium", "high", "critical"];
  const scoreImpliedLevel: RiskLevel =
    fraudScore >= 75 ? "critical" : fraudScore >= 50 ? "high" : fraudScore >= 25 ? "medium" : "low";
  // Trust the model's stated level only if it's a valid enum value AND consistent with its own
  // score — otherwise derive from score, the same rule the heuristic engine uses.
  const riskLevel =
    raw.riskLevel && validLevels.includes(raw.riskLevel as RiskLevel) && raw.riskLevel === scoreImpliedLevel
      ? (raw.riskLevel as RiskLevel)
      : scoreImpliedLevel;
  const requiresReview = riskLevel === "high" || riskLevel === "critical";

  return {
    fraudScore,
    riskLevel,
    requiresReview,
    fraudReasoning: (raw.reasoning || fallback.fraudReasoning).trim(),
    engine: "claude",
    demoMode: false,
  };
}

export async function runFraudScoring(input: OrderInput): Promise<FraudScoreResult> {
  const heuristic = scoreFraudHeuristic(input);
  if (!isClaudeConfigured()) return heuristic;

  const text = await completeWithClaude(fraudScoringPrompt(input));
  const parsed = text ? parseJsonObject<ClaudeFraudJson>(text) : null;
  if (!parsed) return heuristic;
  return normalizeFraud(parsed, heuristic);
}

type ClaudeInventoryJson = {
  predictedStockoutDays?: number;
  restockRecommended?: boolean;
  reasoning?: string;
};

function normalizeInventory(
  raw: ClaudeInventoryJson,
  fallback: InventoryPredictionResult
): InventoryPredictionResult {
  const predictedStockoutDays = Math.max(
    0,
    Math.round(numberOr(raw.predictedStockoutDays, fallback.predictedStockoutDays))
  );
  const restockRecommended =
    typeof raw.restockRecommended === "boolean" ? raw.restockRecommended : fallback.restockRecommended;

  return {
    predictedStockoutDays,
    restockRecommended,
    reasoning: (raw.reasoning || fallback.reasoning).trim(),
    engine: "claude",
    demoMode: false,
  };
}

export async function runInventoryPrediction(input: ProductInput): Promise<InventoryPredictionResult> {
  const heuristic = predictInventoryHeuristic(input);
  if (!isClaudeConfigured()) return heuristic;

  const text = await completeWithClaude(inventoryPredictionPrompt(input));
  const parsed = text ? parseJsonObject<ClaudeInventoryJson>(text) : null;
  if (!parsed) return heuristic;
  return normalizeInventory(parsed, heuristic);
}

type ClaudeInquiryJson = {
  inquiryType?: string;
  sentiment?: string;
  aiResponse?: string;
  requiresHuman?: boolean;
};

const VALID_INQUIRY_TYPES: InquiryType[] = [
  "order_status",
  "return_refund",
  "product_question",
  "shipping_issue",
  "complaint",
  "other",
];
const VALID_SENTIMENTS: Sentiment[] = ["positive", "neutral", "negative"];

function normalizeInquiry(
  raw: ClaudeInquiryJson,
  fallback: InquiryClassificationResult
): InquiryClassificationResult {
  const inquiryType =
    raw.inquiryType && VALID_INQUIRY_TYPES.includes(raw.inquiryType as InquiryType)
      ? (raw.inquiryType as InquiryType)
      : fallback.inquiryType;
  const sentiment =
    raw.sentiment && VALID_SENTIMENTS.includes(raw.sentiment as Sentiment)
      ? (raw.sentiment as Sentiment)
      : fallback.sentiment;

  // Never trust Claude's own claim that human review is unnecessary for a complaint/dispute —
  // the heuristic's safety-critical routing always wins when it says a human is required.
  const requiresHuman =
    fallback.requiresHuman || (typeof raw.requiresHuman === "boolean" ? raw.requiresHuman : false);

  return {
    inquiryType,
    sentiment,
    aiResponse: (raw.aiResponse || fallback.aiResponse).trim(),
    requiresHuman,
    engine: "claude",
    demoMode: false,
  };
}

export async function runInquiryClassification(
  input: InquiryInput
): Promise<InquiryClassificationResult> {
  const heuristic = classifyInquiryHeuristic(input);
  if (!isClaudeConfigured()) return heuristic;

  const text = await completeWithClaude(inquiryClassificationPrompt(input));
  const parsed = text ? parseJsonObject<ClaudeInquiryJson>(text) : null;
  if (!parsed) return heuristic;
  return normalizeInquiry(parsed, heuristic);
}
