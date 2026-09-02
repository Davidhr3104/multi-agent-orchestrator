import { citeSpan, missingCite } from "../fact";
import type {
  LeadClassification,
  LeadIngestInput,
  LeadScoreResult,
  LeadTier,
  ScoredField,
} from "../types";

const SPAM_RE =
  /crypto|nft|seo blast|buy followers|unsubscribe|viagra|casino|click here|free money/i;
const INFO_RE = /\b(just looking|research|curious|how (does|do) it work|pricing page)\b/i;

function clamp01(n: number): number {
  return Math.max(0.15, Math.min(0.98, Math.round(n * 100) / 100));
}

function emailOk(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && !/test|fake|spam/i.test(email);
}

function budgetPoints(budget?: string): number {
  if (!budget) return 4;
  const n = Number(String(budget).replace(/[^0-9.]/g, ""));
  if (Number.isFinite(n) && n >= 10000) return 22;
  if (Number.isFinite(n) && n >= 2500) return 16;
  if (/\b(asap|ready|approved)\b/i.test(budget)) return 14;
  return 8;
}

function timelinePoints(timeline?: string): number {
  if (!timeline) return 4;
  if (/\b(this week|asap|immediately|urgent)\b/i.test(timeline)) return 18;
  if (/\b(this month|30 days|soon)\b/i.test(timeline)) return 12;
  if (/\b(next year|someday|eventually)\b/i.test(timeline)) return 3;
  return 8;
}

function field(
  key: string,
  label: string,
  value: string,
  confidence: number,
  hitl: number,
  document: string,
  needle: string | RegExp | null
): ScoredField {
  const cite = needle == null ? missingCite("no span to cite") : citeSpan(document, needle);
  return {
    key,
    label,
    value,
    confidence: clamp01(confidence),
    ...cite,
    needsHuman: confidence < hitl || !cite.verified,
  };
}

export function scoreLeadHeuristic(
  input: LeadIngestInput,
  opts?: { hitl?: number }
): LeadScoreResult {
  const hitl = opts?.hitl ?? 0.65;
  const message = (input.message ?? "").trim();
  const source = (input.source ?? "unknown").trim() || "unknown";
  const spamHint = SPAM_RE.test(message) || SPAM_RE.test(input.email);
  const thin = message.length < 24;
  const infoHint = INFO_RE.test(message) || (thin && !input.budget);

  let classification: LeadClassification = "lead";
  if (!emailOk(input.email) || spamHint) classification = "spam";
  else if (infoHint) classification = "info";

  let score = 28;
  score += emailOk(input.email) ? 12 : -20;
  score += message.length > 80 ? 14 : message.length > 24 ? 8 : 0;
  score += budgetPoints(input.budget);
  score += timelinePoints(input.timeline);
  score += /form|ghl|hubspot|referral|google/i.test(source) ? 8 : 2;
  if (classification === "spam") score = Math.min(score, 18);
  if (classification === "info") score = Math.min(score, 42);
  score = Math.max(0, Math.min(100, Math.round(score)));

  let tier: LeadTier = "cold";
  if (score >= 75) tier = "hot";
  else if (score >= 50) tier = "warm";

  const confidence = clamp01(
    classification === "spam"
      ? 0.82
      : thin
        ? 0.52
        : Boolean(input.budget && input.timeline)
          ? 0.78
          : 0.64
  );

  const doc = [input.name, input.email, source, message, input.budget, input.timeline]
    .filter(Boolean)
    .join("\n");

  const fields: ScoredField[] = [
    field(
      "contact_quality",
      "Contact quality",
      emailOk(input.email) ? "valid email" : "weak email",
      emailOk(input.email) ? 0.9 : 0.35,
      hitl,
      doc,
      input.email
    ),
    field(
      "intent",
      "Intent",
      classification,
      classification === "lead" ? 0.72 : 0.8,
      hitl,
      doc,
      message ? message.slice(0, 80) : null
    ),
    field(
      "budget_signal",
      "Budget",
      input.budget?.trim() || "unspecified",
      input.budget ? 0.7 : 0.4,
      hitl,
      doc,
      input.budget?.trim() || null
    ),
    field(
      "timeline_signal",
      "Timeline",
      input.timeline?.trim() || "unspecified",
      input.timeline ? 0.7 : 0.4,
      hitl,
      doc,
      input.timeline?.trim() || null
    ),
    field(
      "source_quality",
      "Source",
      source,
      /unknown/i.test(source) ? 0.45 : 0.75,
      hitl,
      doc,
      source === "unknown" ? null : source
    ),
  ];

  const needsReview = confidence < hitl || (score >= 40 && score <= 60);

  const reasoning = [
    `Heuristic engine classified this as ${classification} (score ${score}, ${tier}).`,
    message
      ? `Message snippet: "${message.slice(0, 160)}"`
      : "No message body; scoring relies on contact and source.",
    input.budget || input.timeline
      ? `Budget/timeline: ${input.budget ?? "n/a"} / ${input.timeline ?? "n/a"}.`
      : "Budget and timeline were empty, so fit is conservative.",
  ].join(" ");

  return {
    classification,
    score,
    tier,
    confidence,
    reasoning,
    fields,
    needsReview,
    engine: "heuristic",
  };
}
