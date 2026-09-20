import type { MatterOutcome, PartnerVerdict, StoredRfp } from "../types";

function round(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Parse bid/won amount strings like "$120k", "450000", "Unspecified". */
export function parseMoneyLoose(raw: string | undefined | null): number | null {
  if (!raw) return null;
  const t = raw.trim();
  if (!t || /unspecified|tbd|n\/a|not stated/i.test(t)) return null;
  const k = t.match(/\$?\s*([\d,.]+)\s*k\b/i);
  if (k) {
    const n = parseFloat(k[1].replace(/,/g, "")) * 1000;
    return Number.isFinite(n) ? n : null;
  }
  const cleaned = t.replace(/[^0-9.]/g, "");
  if (!cleaned) return null;
  const num = Number(cleaned);
  return Number.isFinite(num) ? num : null;
}

export function effectiveOutcome(rfp: StoredRfp): MatterOutcome | null {
  const d = rfp.partnerDecision;
  if (!d) return null;
  if (d.outcome) return d.outcome;
  if (d.verdict === "NO-GO") return "no_bid";
  return "pending";
}

export type LegalOutcomesSummary = {
  decided: number;
  go: number;
  conditional: number;
  noGo: number;
  pending: number;
  won: number;
  lost: number;
  withdrawn: number;
  noBid: number;
  /** won / (won + lost) among pursued matters with terminal outcome */
  winRate: number | null;
  pipelineUsd: number;
  wonUsd: number;
  lostUsd: number;
  /** Bid $ on NO-GO / no_bid — capacity not spent chasing bad RFPs */
  avoidedUsd: number;
  goWon: number;
  goLost: number;
  conditionalWon: number;
  conditionalLost: number;
  mockedCorpusCount: number;
  worstMissId: string | null;
  worstMissTitle: string | null;
  worstMissUsd: number;
};

export function summarizeLegalOutcomes(rfps: StoredRfp[]): LegalOutcomesSummary {
  let go = 0;
  let conditional = 0;
  let noGo = 0;
  let pending = 0;
  let won = 0;
  let lost = 0;
  let withdrawn = 0;
  let noBid = 0;
  let pipelineUsd = 0;
  let wonUsd = 0;
  let lostUsd = 0;
  let avoidedUsd = 0;
  let goWon = 0;
  let goLost = 0;
  let conditionalWon = 0;
  let conditionalLost = 0;
  let mockedCorpusCount = 0;
  let worstMiss: StoredRfp | null = null;
  let worstMissUsd = 0;

  let decided = 0;

  for (const rfp of rfps) {
    if (rfp.corpusStatus === "mocked") mockedCorpusCount += 1;
    const d = rfp.partnerDecision;
    if (!d) continue;
    decided += 1;
    const verdict: PartnerVerdict = d.verdict;
    if (verdict === "GO") go += 1;
    else if (verdict === "CONDITIONAL") conditional += 1;
    else noGo += 1;

    const outcome = effectiveOutcome(rfp)!;
    const bid = parseMoneyLoose(d.bidAmount) ?? parseMoneyLoose(rfp.amount);
    const wonAmt = parseMoneyLoose(d.wonAmount) ?? bid;

    if (outcome === "pending") {
      pending += 1;
      if (verdict !== "NO-GO" && bid != null) pipelineUsd += bid;
    } else if (outcome === "won") {
      won += 1;
      if (wonAmt != null) wonUsd += wonAmt;
      if (verdict === "GO") goWon += 1;
      if (verdict === "CONDITIONAL") conditionalWon += 1;
    } else if (outcome === "lost") {
      lost += 1;
      if (bid != null) {
        lostUsd += bid;
        if (!worstMiss || bid > worstMissUsd) {
          worstMiss = rfp;
          worstMissUsd = bid;
        }
      }
      if (verdict === "GO") goLost += 1;
      if (verdict === "CONDITIONAL") conditionalLost += 1;
    } else if (outcome === "withdrawn") {
      withdrawn += 1;
    } else if (outcome === "no_bid") {
      noBid += 1;
      if (bid != null) avoidedUsd += bid;
    }
  }

  const closed = won + lost;
  const winRate = closed > 0 ? round(won / closed) : null;

  return {
    decided,
    go,
    conditional,
    noGo,
    pending,
    won,
    lost,
    withdrawn,
    noBid,
    winRate,
    pipelineUsd: round(pipelineUsd),
    wonUsd: round(wonUsd),
    lostUsd: round(lostUsd),
    avoidedUsd: round(avoidedUsd),
    goWon,
    goLost,
    conditionalWon,
    conditionalLost,
    mockedCorpusCount,
    worstMissId: worstMiss?.id ?? null,
    worstMissTitle: worstMiss?.title ?? null,
    worstMissUsd: round(worstMissUsd),
  };
}
