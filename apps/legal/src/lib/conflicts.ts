import { completeWithClaude, isClaudeConfigured, parseJsonObject } from "@helix/core";
import type { StoredRfp } from "@helix/core";
import type {
  CoiVerdict,
  ConflictAgainst,
  ConflictHit,
  ConflictRelation,
  ConflictReport,
  FirmKnowledge,
} from "@/lib/conflict-types";
import { loadFirmKnowledge } from "@/lib/firm-knowledge";

function norm(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function similar(a: string, b: string): boolean {
  const left = norm(a);
  const right = norm(b);
  if (!left || !right) return false;
  if (left === right) return true;
  if (left.length >= 6 && right.includes(left)) return true;
  if (right.length >= 6 && left.includes(right)) return true;
  const tokens = left.split(" ").filter((t) => t.length > 3);
  if (tokens.length === 0) return false;
  return tokens.filter((t) => right.includes(t)).length >= Math.min(2, tokens.length);
}

function extractParties(rfp: StoredRfp): { relation: ConflictRelation; party: string }[] {
  const parties: { relation: ConflictRelation; party: string }[] = [];
  if (rfp.issuer && !/^unspecified$/i.test(rfp.issuer)) {
    parties.push({ relation: "issuer", party: rfp.issuer });
  }
  const blob = `${rfp.title}\n${rfp.body}`;
  const patterns: { relation: ConflictRelation; re: RegExp }[] = [
    { relation: "incumbent", re: /\b(?:incumbent|versus|vs\.?|competitor)\s+([A-Z][A-Za-z0-9& .'/-]{2,48})/g },
    { relation: "opposing_party", re: /\b(?:opposing party|adverse to|against)\s+([A-Z][A-Za-z0-9& .'/-]{2,48})/g },
    { relation: "related_entity", re: /\b(?:affiliate|related entity|parent|subsidiary)\s+([A-Z][A-Za-z0-9& .'/-]{2,48})/g },
  ];
  for (const { relation, re } of patterns) {
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(blob))) {
      parties.push({ relation, party: m[1].trim().replace(/[.,;]+$/, "") });
    }
  }
  return parties;
}

function scoreReport(hits: ConflictHit[]): { verdict: CoiVerdict; score: number; why: string } {
  const red = hits.filter((h) => h.severity === "red");
  const amber = hits.filter((h) => h.severity === "amber");
  if (red.length) {
    return {
      verdict: "NO-GO",
      score: Math.max(8, 24 - red.length * 6),
      why: red[0]?.detail ?? "Adverse party matches the firm’s book.",
    };
  }
  if (amber.length) {
    return {
      verdict: "CONDITIONAL",
      score: 55,
      why: amber[0]?.detail ?? "Possible conflict — ethics partner must clear before bid.",
    };
  }
  return { verdict: "GO", score: 88, why: "No issuer, opposing party, or related entity matched the firm book." };
}

export function heuristicConflicts(rfp: StoredRfp, knowledge: FirmKnowledge): ConflictHit[] {
  const hits: ConflictHit[] = [];
  const parties = extractParties(rfp);
  const seen = new Set<string>();

  for (const { relation, party } of parties) {
    for (const client of knowledge.clients) {
      if (!similar(party, client.clientName)) continue;
      const key = `${relation}:${client.id}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const former = client.status === "Inactive";
      const against: ConflictAgainst = former ? "former_client" : "current_client";
      const adverse = relation === "opposing_party" || relation === "incumbent";
      hits.push({
        party,
        matchedName: client.clientName,
        relation,
        against,
        severity: adverse && !former ? "red" : "amber",
        detail: adverse
          ? `${party} matches ${former ? "former" : "current"} client ${client.clientName} in an adverse role (${relation}).`
          : relation === "issuer"
            ? `${client.clientName} is a ${former ? "former" : "current"} client and the RFP issuer. Confirm the engagement is for the client, not adverse to them.`
            : `${client.clientName} appears as a related entity on this RFP.`,
      });
    }
    for (const matter of knowledge.matters) {
      if (!matter.opposingParty || !similar(party, matter.opposingParty)) continue;
      const key = `opp:${matter.id}:${relation}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const active = matter.status === "Active";
      hits.push({
        party,
        matchedName: matter.opposingParty,
        relation,
        against: active ? "active_matter_adverse" : "closed_matter",
        severity: active ? "red" : "amber",
        detail: `${party} matches opposing party on ${matter.matterName} (${matter.clientName}, ${matter.status}).`,
      });
    }
  }
  return hits;
}

type ClaudePayload = {
  verdict?: CoiVerdict;
  score?: number;
  why?: string;
  hits?: ConflictHit[];
};

function buildReport(rfp: StoredRfp, hits: ConflictHit[], engine: ConflictReport["engine"], claudeFailed: boolean): ConflictReport {
  const base = scoreReport(hits);
  return {
    rfpId: rfp.id,
    issuer: rfp.issuer,
    verdict: base.verdict,
    score: base.score,
    why: base.why,
    engine,
    claudeFailed,
    hits,
    checkedAt: new Date().toISOString(),
  };
}

export async function heuristicConflictReport(rfp: StoredRfp): Promise<ConflictReport> {
  const knowledge = await loadFirmKnowledge();
  return buildReport(rfp, heuristicConflicts(rfp, knowledge), "heuristic", false);
}

export async function runConflictCheck(rfp: StoredRfp): Promise<ConflictReport> {
  const knowledge = await loadFirmKnowledge();
  const hits = heuristicConflicts(rfp, knowledge);
  const base = scoreReport(hits);
  let engine: ConflictReport["engine"] = "heuristic";
  let claudeFailed = false;
  let verdict = base.verdict;
  let score = base.score;
  let why = base.why;
  let mergedHits = hits;

  if (!isClaudeConfigured()) {
    claudeFailed = true;
  } else {
    const raw = await completeWithClaude(
      [
        `You are ethics counsel for a US law firm. Return JSON only.`,
        `Schema: {"verdict":"GO"|"CONDITIONAL"|"NO-GO","score":0-100,"why":"string","hits":[{"party":"","matchedName":"","relation":"issuer"|"opposing_party"|"related_entity"|"incumbent","against":"current_client"|"former_client"|"active_matter_adverse"|"closed_matter","severity":"red"|"amber","detail":""}]}`,
        `RFP issuer: ${rfp.issuer}`,
        `RFP title: ${rfp.title}`,
        `RFP body: ${rfp.body.slice(0, 2500)}`,
        `Firm clients: ${JSON.stringify(knowledge.clients)}`,
        `Firm matters: ${JSON.stringify(knowledge.matters)}`,
        `Heuristic hits already found: ${JSON.stringify(hits)}`,
        `If unsure, stay CONDITIONAL. Never invent clients that are not in the firm lists.`,
      ].join("\n"),
      700,
      "claude-3-5-haiku-20241022"
    );
    const parsed = raw ? parseJsonObject<ClaudePayload>(raw) : null;
    if (!raw || !parsed) {
      claudeFailed = true;
    } else {
      engine = "claude";
      if (parsed.verdict) verdict = parsed.verdict;
      if (typeof parsed.score === "number") score = Math.max(0, Math.min(100, Math.round(parsed.score)));
      if (parsed.why) why = parsed.why;
      if (Array.isArray(parsed.hits) && parsed.hits.length) {
        mergedHits = [...hits, ...parsed.hits.filter((h) => h && h.matchedName && h.detail)];
      }
    }
  }

  return {
    rfpId: rfp.id,
    issuer: rfp.issuer,
    verdict,
    score,
    why,
    engine,
    claudeFailed,
    hits: mergedHits,
    checkedAt: new Date().toISOString(),
  };
}
