import { completeWithClaude, isClaudeConfigured, parseJsonObject } from "../claude";
import { hydrateScoredField } from "../fact";
import type {
  AgentRun,
  PipelineLog,
  RfpEmit,
  RfpIngestInput,
  RfpScoreResult,
  ScoredField,
  StoredRfp,
} from "../types";
import { scoreRfpHeuristic } from "./heuristic";
import { DEFAULT_LEGAL_PROFILE, rfpScoringPrompt } from "./prompts";

function id(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

function now(): string {
  return new Date().toISOString();
}

function log(
  emit: RfpEmit,
  agent: PipelineLog["agent"],
  level: PipelineLog["level"],
  message: string,
  extra: Partial<PipelineLog> = {}
) {
  emit({
    type: "log",
    log: {
      id: id("log"),
      ts: now(),
      agent,
      level,
      message,
      ...extra,
    },
  });
}

function agent(emit: RfpEmit, run: AgentRun) {
  emit({ type: "agent", run });
}

type ClaudeJson = {
  method?: string;
  amount?: string;
  deadline?: string;
  matchScore?: number;
  tier?: string;
  confidence?: number;
  reasoning?: string;
  fields?: Array<{
    key?: string;
    label?: string;
    value?: string;
    confidence?: number;
    evidence?: string;
    quote?: string;
    spanStart?: number;
    spanEnd?: number;
  }>;
};

function normalizeClaude(
  raw: ClaudeJson,
  fallback: RfpScoreResult,
  document: string
): RfpScoreResult {
  const method =
    raw.method === "BEAR" || raw.method === "SPI" || raw.method === "other"
      ? raw.method
      : fallback.method;
  const matchScore = Math.max(
    0,
    Math.min(100, Math.round(Number(raw.matchScore) || fallback.matchScore))
  );
  const tier =
    raw.tier === "hot" || raw.tier === "warm" || raw.tier === "cold"
      ? raw.tier
      : matchScore >= 75
        ? "hot"
        : matchScore >= 50
          ? "warm"
          : "cold";
  const confidence = Math.max(
    0.15,
    Math.min(0.98, Number(raw.confidence) || fallback.confidence)
  );
  const fields: ScoredField[] =
    raw.fields && raw.fields.length > 0
      ? raw.fields.map((f, i) => hydrateScoredField(document, f, i))
      : fallback.fields;
  const unverifiedCount = fields.filter((f) => !f.verified).length;
  const needsReview = confidence < 0.65 || (matchScore >= 40 && matchScore <= 60);

  return {
    matchScore,
    tier,
    method,
    amount: String(raw.amount ?? fallback.amount),
    deadline: String(raw.deadline ?? fallback.deadline),
    confidence,
    reasoning: (raw.reasoning || fallback.reasoning).trim(),
    fields,
    unverifiedCount,
    needsReview,
    engine: "claude",
  };
}

export async function runRfpPipeline(input: RfpIngestInput, emit: RfpEmit): Promise<StoredRfp> {
  const runId = id("run");
  const createdAt = now();
  const clientProfile = input.clientProfile?.trim() || DEFAULT_LEGAL_PROFILE;

  log(emit, "orchestrator", "info", "RFP ingest accepted.", {
    field: "run_id",
    evidence: runId,
  });
  agent(emit, {
    agent: "orchestrator",
    status: "running",
    summary: "Routing EXT → FACT → REC → REV",
    confidence: 0.9,
  });

  agent(emit, {
    agent: "extractor",
    status: "running",
    summary: "Extracting legal fields",
    confidence: 0.5,
  });

  const heuristic = scoreRfpHeuristic({ ...input, clientProfile });
  let scored = heuristic;

  if (isClaudeConfigured()) {
    log(emit, "extractor", "info", "Calling Claude for extraction + match.");
    const text = await completeWithClaude(rfpScoringPrompt({ ...input, clientProfile }));
    const parsed = text ? parseJsonObject<ClaudeJson>(text) : null;
    if (parsed) {
      scored = normalizeClaude(parsed, heuristic, `${input.title}\n${input.issuer ?? ""}\n${input.body}`);
      log(emit, "extractor", "success", "Claude JSON accepted.", {
        confidence: scored.confidence,
      });
    } else {
      log(emit, "extractor", "warn", "Claude unavailable or invalid JSON; using heuristic.");
    }
  } else {
    log(emit, "extractor", "info", "No ANTHROPIC_API_KEY; heuristic extraction.");
  }

  agent(emit, {
    agent: "extractor",
    status: "done",
    summary: `${scored.fields.length} scored fields`,
    confidence: scored.confidence,
    decision: scored.needsReview ? "needs review" : "approved",
  });

  agent(emit, {
    agent: "factchecker",
    status: "running",
    summary: "Evidence gate",
    confidence: scored.confidence,
  });
  log(emit, "factchecker", "decision", `FACT: ${scored.unverifiedCount} unverified field(s).`, {
    confidence: scored.confidence,
  });
  agent(emit, {
    agent: "factchecker",
    status: "done",
    summary: `${scored.unverifiedCount} unverified`,
    confidence: scored.confidence,
    decision: scored.unverifiedCount > 0 ? "needs review" : "approved",
  });

  agent(emit, {
    agent: "recommender",
    status: "done",
    summary: `match ${scored.matchScore} · ${scored.tier} · ${scored.method}`,
    confidence: scored.confidence,
    decision: scored.tier === "cold" ? "blocked" : "approved",
  });

  const reviewDecision = scored.needsReview ? "needs review" : "approved";
  agent(emit, {
    agent: "reviewer",
    status: "done",
    summary: reviewDecision,
    confidence: scored.confidence,
    decision: reviewDecision,
  });
  log(emit, "reviewer", "decision", `Reviewer: ${reviewDecision}.`, {
    confidence: scored.confidence,
  });

  const rfp: StoredRfp = {
    ...scored,
    id: id("rfp"),
    createdAt,
    runId,
    title: input.title.trim(),
    issuer: (input.issuer ?? "").trim() || "unspecified",
    body: input.body.trim(),
    clientProfile,
    corpusStatus: "not_asked",
  };

  agent(emit, {
    agent: "orchestrator",
    status: "done",
    summary: `RFP ${rfp.id} stored`,
    confidence: scored.confidence,
    decision: reviewDecision,
  });
  emit({ type: "result", rfp });
  return rfp;
}

export function parseRfpIngest(body: unknown): RfpIngestInput | string {
  if (!body || typeof body !== "object") return "JSON object required.";
  const row = body as Record<string, unknown>;
  const title = String(row.title ?? "").trim();
  const rfpBody = String(row.body ?? "").trim();
  if (!title) return "title is required.";
  if (!rfpBody) return "body is required.";
  return {
    title,
    issuer: row.issuer != null ? String(row.issuer) : undefined,
    body: rfpBody,
    clientProfile:
      row.client_profile != null
        ? String(row.client_profile)
        : row.clientProfile != null
          ? String(row.clientProfile)
          : undefined,
  };
}
