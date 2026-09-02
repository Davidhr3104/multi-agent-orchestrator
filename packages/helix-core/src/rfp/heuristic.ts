import { citeSpan, missingCite } from "../fact";
import type {
  RfpIngestInput,
  RfpMethod,
  RfpScoreResult,
  RfpTier,
  ScoredField,
} from "../types";
import { DEFAULT_LEGAL_PROFILE } from "./prompts";

const STOP = new Set([
  "with",
  "from",
  "that",
  "this",
  "have",
  "will",
  "skip",
  "unless",
  "work",
  "firm",
  "they",
  "your",
  "into",
  "only",
  "than",
]);

function clamp01(n: number): number {
  return Math.max(0.15, Math.min(0.98, Math.round(n * 100) / 100));
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
  const cite = needle == null ? missingCite("span not in document") : citeSpan(document, needle);
  return {
    key,
    label,
    value,
    confidence: clamp01(confidence),
    ...cite,
    needsHuman: confidence < hitl || !cite.verified,
  };
}

function detectMethod(text: string): { method: RfpMethod; needle: string | null } {
  const bear = text.match(/\bBEAR\b/i);
  if (bear) return { method: "BEAR", needle: bear[0] };
  const spi = text.match(/\bSPI\b/i);
  if (spi) return { method: "SPI", needle: spi[0] };
  return { method: "other", needle: null };
}

function detectAmount(text: string): { value: string; needle: string | null } {
  const m = text.match(/\$\s?[\d,]+(?:\.\d+)?(?:\s*(?:k|K|million|m))?/);
  if (m) return { value: m[0].replace(/\s+/g, ""), needle: m[0] };
  const n = text.match(/\b(\d{2,3})\s*k\b/i);
  if (n) return { value: `$${n[1]}k`, needle: n[0] };
  return { value: "unspecified", needle: null };
}

function detectDeadline(text: string): { value: string; needle: string | null } {
  const m = text.match(
    /\b(?:due|deadline|closes?|submit by)[:\s]+([A-Za-z]+\s+\d{1,2},?\s+\d{4}|\d{1,2}\/\d{1,2}\/\d{2,4}|\d{4}-\d{2}-\d{2})/i
  );
  if (m) return { value: m[1], needle: m[0] };
  const iso = text.match(/\b(20\d{2}-\d{2}-\d{2})\b/);
  if (iso) return { value: iso[1], needle: iso[1] };
  return { value: "unspecified", needle: null };
}

function amountNumber(amount: string): number | null {
  const n = Number(amount.replace(/[^0-9.]/g, ""));
  if (!Number.isFinite(n) || n <= 0) return null;
  if (/k/i.test(amount) && n < 1000) return n * 1000;
  return n;
}

export function profileOverlap(body: string, profile: string): number {
  const tokens = profile
    .toLowerCase()
    .split(/[^a-z0-9$]+/)
    .filter((t) => t.length > 3 && !STOP.has(t));
  if (tokens.length === 0) return 0;
  const blob = body.toLowerCase();
  const hits = tokens.filter((t) => blob.includes(t)).length;
  return hits / tokens.length;
}

export function scoreRfpHeuristic(input: RfpIngestInput): RfpScoreResult {
  const hitl = 0.65;
  const body = `${input.title}\n${input.issuer ?? ""}\n${input.body}`;
  const profile = input.clientProfile?.trim() || DEFAULT_LEGAL_PROFILE;
  const methodHit = detectMethod(body);
  const amount = detectAmount(body);
  const deadline = detectDeadline(body);
  const overlap = profileOverlap(body, profile);

  const dollars = amountNumber(amount.value);
  const inBand = dollars != null && dollars >= 25000 && dollars <= 150000;

  let match = 18 + Math.round(overlap * 55);
  if (methodHit.method === "BEAR" || methodHit.method === "SPI") match += 14;
  if (inBand) match += 12;
  if (deadline.needle) match += 8;
  match = Math.max(0, Math.min(100, Math.round(match)));

  let tier: RfpTier = "cold";
  if (match >= 75) tier = "hot";
  else if (match >= 50) tier = "warm";

  const unverified =
    (!amount.needle ? 1 : 0) + (!deadline.needle ? 1 : 0) + (methodHit.method === "other" ? 1 : 0);
  const confidence = clamp01(
    0.82 - unverified * 0.12 - (input.body.trim().length < 80 ? 0.18 : 0)
  );

  const issuer = (input.issuer ?? "").trim() || "unspecified";
  const fields: ScoredField[] = [
    field(
      "issuer",
      "Issuer",
      issuer,
      input.issuer ? 0.88 : 0.4,
      hitl,
      body,
      input.issuer?.trim() || null
    ),
    field("deadline", "Deadline", deadline.value, deadline.needle ? 0.86 : 0.38, hitl, body, deadline.needle),
    field("amount", "Amount", amount.value, amount.needle ? 0.84 : 0.36, hitl, body, amount.needle),
    field("method", "Method", methodHit.method, methodHit.needle ? 0.9 : 0.45, hitl, body, methodHit.needle),
    field(
      "fit",
      "Client fit",
      overlap >= 0.2 ? "aligned with profile" : "weak profile overlap",
      overlap >= 0.2 ? 0.78 : 0.42,
      hitl,
      body,
      overlap >= 0.2 ? profile.split(/[^a-zA-Z0-9$]+/).find((t) => t.length > 4 && body.toLowerCase().includes(t.toLowerCase())) || null : null
    ),
  ];

  const needsReview = confidence < hitl || (match >= 40 && match <= 60) || unverified >= 2;

  const reasoning = [
    `Heuristic match ${match} (${tier}). Profile overlap ${(overlap * 100).toFixed(0)}%.`,
    `Method ${methodHit.method}; amount ${amount.value}; deadline ${deadline.value}.`,
    unverified
      ? `${unverified} field(s) lack a cited span in the RFP body (FACT).`
      : "Deadline, amount, and method are cited in the text.",
  ].join(" ");

  return {
    matchScore: match,
    tier,
    method: methodHit.method,
    amount: amount.value,
    deadline: deadline.value,
    confidence,
    reasoning,
    fields,
    unverifiedCount: unverified,
    needsReview,
    engine: "heuristic",
  };
}
