import {
  citeSpan,
  hydrateScoredField,
  parseJsonObject,
  rfpScoringPrompt,
  scoreRfpHeuristic,
  type PartnerVerdict,
  type RfpIngestInput,
  type RfpScoreResult,
  type ScoredField,
} from "@helix/core";
import type { AiUsageEntry } from "@/lib/ai-cost";
import { callClaudeMetered } from "@/lib/claude-metered";
import type { ConflictReport } from "@/lib/conflict-types";
import type { CitedPoint, ExtractionMeta, GoNoGoProposal, LegalRfp } from "@/lib/legal-rfp";
import { goNoGo } from "@/lib/rfp-intel";

export const EXTRACTION_PROMPT_ID = "rfp-extract-cited-v1";
export const GO_NO_GO_PROMPT_ID = "go-no-go-proposal-v1";

type ClaudeExtraction = {
  method?: string;
  amount?: string;
  deadline?: string;
  matchScore?: number;
  tier?: string;
  confidence?: number;
  reasoning?: string;
  fields?: { key?: string; label?: string; value?: string; confidence?: number; quote?: string; evidence?: string }[];
};

export function sourceDocument(input: { title: string; issuer?: string; body: string }): string {
  return `${input.title}\n${input.issuer ?? ""}\n${input.body}`;
}

/**
 * Claude's spans are relative to the JSON it was shown, not to our text, so they are dropped and every
 * quote is located again in the source: a field only counts as cited when its quote is really there.
 */
export function normalizeExtraction(raw: ClaudeExtraction, fallback: RfpScoreResult, document: string): RfpScoreResult {
  const method = raw.method === "BEAR" || raw.method === "SPI" || raw.method === "other" ? raw.method : fallback.method;
  const matchScore = Math.max(0, Math.min(100, Math.round(Number(raw.matchScore ?? fallback.matchScore))));
  const tier =
    raw.tier === "hot" || raw.tier === "warm" || raw.tier === "cold"
      ? raw.tier
      : matchScore >= 75
        ? "hot"
        : matchScore >= 50
          ? "warm"
          : "cold";
  const confidence = Math.max(0.15, Math.min(0.98, Number(raw.confidence) || fallback.confidence));
  const fields: ScoredField[] =
    Array.isArray(raw.fields) && raw.fields.length > 0
      ? raw.fields.map((f, i) =>
          hydrateScoredField(document, { key: f.key, label: f.label, value: f.value, confidence: f.confidence, quote: f.quote ?? "" }, i)
        )
      : fallback.fields;
  const unverifiedCount = fields.filter((f) => !f.verified).length;
  return {
    matchScore,
    tier,
    method,
    amount: String(raw.amount ?? fallback.amount),
    deadline: String(raw.deadline ?? fallback.deadline),
    confidence,
    reasoning: String(raw.reasoning || fallback.reasoning).trim(),
    fields,
    unverifiedCount,
    needsReview: true,
    engine: "claude",
  };
}

export async function extractRfpWithAi(
  input: RfpIngestInput & { clientProfile: string },
  opts: { rfpId?: string; fetchImpl?: typeof fetch } = {}
): Promise<{ scored: RfpScoreResult; extraction: ExtractionMeta; usage: AiUsageEntry[] }> {
  const heuristic = { ...scoreRfpHeuristic(input), needsReview: true };
  const document = sourceDocument(input);
  const at = new Date().toISOString();
  const heuristicMeta = (note: string): ExtractionMeta => ({
    engine: "heuristic",
    prompt: "rfp-heuristic",
    at,
    note,
    verifiedFields: heuristic.fields.filter((f) => f.verified).length,
    totalFields: heuristic.fields.length,
  });

  const res = await callClaudeMetered({
    prompt: rfpScoringPrompt(input),
    purpose: "extraction",
    maxTokens: 1600,
    rfpId: opts.rfpId,
    fetchImpl: opts.fetchImpl,
  });
  const usage = res.usage ? [res.usage] : [];
  if (!res.ok) {
    const note =
      res.reason === "not_configured"
        ? "Heuristic extraction (pattern matching, not AI): ANTHROPIC_API_KEY is not set."
        : `Heuristic extraction (pattern matching, not AI): Claude call failed — ${res.message}`;
    return { scored: heuristic, extraction: heuristicMeta(note), usage };
  }
  const parsed = parseJsonObject<ClaudeExtraction>(res.text);
  if (!parsed) {
    return {
      scored: heuristic,
      extraction: heuristicMeta("Heuristic extraction (pattern matching, not AI): Claude answered without valid JSON."),
      usage,
    };
  }
  const scored = normalizeExtraction(parsed, heuristic, document);
  const verified = scored.fields.filter((f) => f.verified).length;
  return {
    scored,
    extraction: {
      engine: "claude",
      prompt: EXTRACTION_PROMPT_ID,
      at,
      note: `Claude extraction · ${verified}/${scored.fields.length} quotes found verbatim in the source text.`,
      verifiedFields: verified,
      totalFields: scored.fields.length,
    },
    usage,
  };
}

function cite(document: string, point: unknown, quote: unknown): CitedPoint | null {
  const p = String(point ?? "").trim();
  if (!p) return null;
  const q = String(quote ?? "").trim();
  const span = q ? citeSpan(document, q) : null;
  return span?.verified
    ? { point: p, quote: span.quote, verified: true, spanStart: span.spanStart, spanEnd: span.spanEnd }
    : { point: p, quote: q, verified: false, spanStart: -1, spanEnd: -1 };
}

type ClaudeProposal = {
  recommendation?: string;
  confidence?: number;
  rationale?: string;
  reasons?: { point?: string; quote?: string }[];
  risks?: { point?: string; quote?: string }[];
  conditions?: string[];
};

const VERDICTS: PartnerVerdict[] = ["GO", "CONDITIONAL", "NO-GO"];

export function goNoGoPrompt(rfp: LegalRfp, profile: string, coi?: ConflictReport, noBidRuleHit?: string): string {
  return [
    "You advise a US law firm's bid partner on whether to pursue an RFP. You recommend; the partner decides.",
    "Return ONLY JSON:",
    '{"recommendation":"GO"|"CONDITIONAL"|"NO-GO","confidence":0-1,"rationale":"2-4 sentences","reasons":[{"point":"why it fits","quote":"exact substring of the RFP"}],"risks":[{"point":"risk or gap","quote":"exact substring of the RFP"}],"conditions":["what must be true to bid"]}',
    "Every quote must be copied verbatim from the RFP text below; use an empty quote if the point is not in the text. Do not invent budgets, deadlines, or clients.",
    "A NO-GO conflict check or a matched no-bid rule should weigh heavily toward NO-GO or CONDITIONAL.",
    `Firm profile:\n${profile}`,
    `Conflict check: ${coi ? `${coi.verdict} (${coi.score}) via ${coi.engine} — ${coi.why}` : "not run"}`,
    `No-bid rule: ${noBidRuleHit ?? "none matched"}`,
    `RFP title: ${rfp.title}`,
    `RFP issuer: ${rfp.issuer}`,
    `RFP text:\n${rfp.body.slice(0, 9000)}`,
  ].join("\n\n");
}

export function heuristicProposal(rfp: LegalRfp, coi?: ConflictReport, noBidRuleHit?: string, note?: string): GoNoGoProposal {
  const fit = goNoGo({ ...rfp, partnerDecision: undefined });
  let recommendation: PartnerVerdict = fit.verdict;
  if (coi?.verdict === "NO-GO" || noBidRuleHit) recommendation = "NO-GO";
  else if (coi?.verdict === "CONDITIONAL" && recommendation === "GO") recommendation = "CONDITIONAL";
  const risks: CitedPoint[] = [];
  if (coi && coi.verdict !== "GO") risks.push({ point: `Conflict check ${coi.verdict}: ${coi.why}`, quote: "", verified: false, spanStart: -1, spanEnd: -1 });
  if (noBidRuleHit) risks.push({ point: `No-bid rule matched: ${noBidRuleHit}`, quote: "", verified: false, spanStart: -1, spanEnd: -1 });
  return {
    engine: "heuristic",
    recommendation,
    confidence: rfp.confidence,
    rationale: `Rule-based fit check (not AI): ${fit.why}`,
    reasons: [],
    risks,
    conditions: [],
    coiVerdict: coi?.verdict,
    coiEngine: coi?.engine,
    noBidRuleHit,
    generatedAt: new Date().toISOString(),
    prompt: "go-no-go-heuristic",
    note: note ?? "ANTHROPIC_API_KEY is not set, so this is the rule-based fit check.",
  };
}

export async function proposeGoNoGo(
  rfp: LegalRfp,
  opts: { profile: string; coi?: ConflictReport; noBidRuleHit?: string; fetchImpl?: typeof fetch }
): Promise<{ proposal: GoNoGoProposal; usage: AiUsageEntry[] }> {
  const res = await callClaudeMetered({
    prompt: goNoGoPrompt(rfp, opts.profile, opts.coi, opts.noBidRuleHit),
    purpose: "go-no-go",
    maxTokens: 1000,
    rfpId: rfp.id,
    fetchImpl: opts.fetchImpl,
  });
  const usage = res.usage ? [res.usage] : [];
  if (!res.ok) {
    const note = res.reason === "not_configured" ? undefined : `Claude call failed (${res.message}); showing the rule-based fit check.`;
    return { proposal: heuristicProposal(rfp, opts.coi, opts.noBidRuleHit, note), usage };
  }
  const parsed = parseJsonObject<ClaudeProposal>(res.text);
  const recommendation = VERDICTS.find((v) => v === parsed?.recommendation);
  if (!parsed || !recommendation) {
    return {
      proposal: heuristicProposal(rfp, opts.coi, opts.noBidRuleHit, "Claude answered without a valid recommendation; showing the rule-based fit check."),
      usage,
    };
  }
  const document = sourceDocument(rfp);
  const points = (list: ClaudeProposal["reasons"]) =>
    (Array.isArray(list) ? list : []).map((r) => cite(document, r?.point, r?.quote)).filter((p): p is CitedPoint => p !== null).slice(0, 6);
  return {
    proposal: {
      engine: "claude",
      recommendation,
      confidence: Math.max(0, Math.min(1, Number(parsed.confidence) || 0.5)),
      rationale: String(parsed.rationale ?? "").trim() || "No rationale returned.",
      reasons: points(parsed.reasons),
      risks: points(parsed.risks),
      conditions: (Array.isArray(parsed.conditions) ? parsed.conditions : []).map((c) => String(c).trim()).filter(Boolean).slice(0, 6),
      coiVerdict: opts.coi?.verdict,
      coiEngine: opts.coi?.engine,
      noBidRuleHit: opts.noBidRuleHit,
      generatedAt: new Date().toISOString(),
      prompt: GO_NO_GO_PROMPT_ID,
    },
    usage,
  };
}
