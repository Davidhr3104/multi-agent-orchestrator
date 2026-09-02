import { completeWithClaude, isClaudeConfigured, parseJsonObject } from "../claude";
import type {
  AgentRun,
  LeadEmit,
  LeadIngestInput,
  LeadScoreResult,
  PipelineLog,
  ScoredField,
  StoredLead,
} from "../types";
import { scoreLeadHeuristic } from "./heuristic";
import { leadScoringPrompt } from "./prompts";

function id(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

function now(): string {
  return new Date().toISOString();
}

function log(
  emit: LeadEmit,
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

function agent(emit: LeadEmit, run: AgentRun) {
  emit({ type: "agent", run });
}

type ClaudeJson = {
  classification?: string;
  score?: number;
  tier?: string;
  confidence?: number;
  reasoning?: string;
  fields?: Array<{
    key?: string;
    label?: string;
    value?: string;
    confidence?: number;
    evidence?: string;
  }>;
};

function normalizeClaude(raw: ClaudeJson, fallback: LeadScoreResult): LeadScoreResult {
  const classification =
    raw.classification === "spam" || raw.classification === "info" || raw.classification === "lead"
      ? raw.classification
      : fallback.classification;
  const score = Math.max(0, Math.min(100, Math.round(Number(raw.score) || fallback.score)));
  const tier =
    raw.tier === "hot" || raw.tier === "warm" || raw.tier === "cold"
      ? raw.tier
      : score >= 75
        ? "hot"
        : score >= 50
          ? "warm"
          : "cold";
  const confidence = Math.max(
    0.15,
    Math.min(0.98, Number(raw.confidence) || fallback.confidence)
  );
  const fields: ScoredField[] =
    raw.fields && raw.fields.length > 0
      ? raw.fields.map((f, i) => ({
          key: f.key || `field_${i}`,
          label: f.label || f.key || `Field ${i + 1}`,
          value: String(f.value ?? ""),
          confidence: Math.max(0.15, Math.min(0.98, Number(f.confidence) || 0.5)),
          evidence: String(f.evidence ?? ""),
          needsHuman: (Number(f.confidence) || 0.5) < 0.65,
        }))
      : fallback.fields;

  const needsReview = confidence < 0.65 || (score >= 40 && score <= 60);

  return {
    classification,
    score,
    tier,
    confidence,
    reasoning: (raw.reasoning || fallback.reasoning).trim(),
    fields,
    needsReview,
    engine: "claude",
  };
}

export async function runLeadPipeline(
  input: LeadIngestInput,
  emit: LeadEmit
): Promise<StoredLead> {
  const runId = id("run");
  const createdAt = now();

  log(emit, "orchestrator", "info", "Lead ingest accepted.", {
    field: "run_id",
    evidence: runId,
  });
  agent(emit, {
    agent: "orchestrator",
    status: "running",
    summary: "Routing EXT → REC → REV",
    confidence: 0.9,
  });

  agent(emit, {
    agent: "extractor",
    status: "running",
    summary: "Extracting contact fields",
    confidence: 0.5,
  });
  log(emit, "extractor", "info", `Parsed ${input.name} <${input.email}>.`);

  const heuristic = scoreLeadHeuristic(input);
  let scored = heuristic;

  agent(emit, {
    agent: "recommender",
    status: "running",
    summary: "Scoring lead vs spam vs info",
    confidence: 0.5,
  });

  if (isClaudeConfigured()) {
    log(emit, "recommender", "info", "Calling Claude for classification + score.");
    const text = await completeWithClaude(leadScoringPrompt(input));
    const parsed = text ? parseJsonObject<ClaudeJson>(text) : null;
    if (parsed) {
      scored = normalizeClaude(parsed, heuristic);
      log(emit, "recommender", "success", "Claude JSON accepted.", {
        confidence: scored.confidence,
      });
    } else {
      log(emit, "recommender", "warn", "Claude unavailable or invalid JSON; using heuristic.");
    }
  } else {
    log(emit, "recommender", "info", "No ANTHROPIC_API_KEY; heuristic scoring.");
  }

  agent(emit, {
    agent: "extractor",
    status: "done",
    summary: `${scored.fields.length} scored fields`,
    confidence: scored.confidence,
    decision: scored.needsReview ? "requiere revisión" : "aprobado",
  });
  agent(emit, {
    agent: "recommender",
    status: "done",
    summary: `${scored.classification} · ${scored.score} · ${scored.tier}`,
    confidence: scored.confidence,
    decision: scored.classification === "spam" ? "bloqueado" : "aprobado",
  });

  agent(emit, {
    agent: "reviewer",
    status: "running",
    summary: "HITL gate",
    confidence: scored.confidence,
  });
  const reviewDecision = scored.needsReview ? "requiere revisión" : "aprobado";
  log(emit, "reviewer", "decision", `Reviewer: ${reviewDecision}.`, {
    confidence: scored.confidence,
  });
  agent(emit, {
    agent: "reviewer",
    status: "done",
    summary: reviewDecision,
    confidence: scored.confidence,
    decision: reviewDecision,
  });

  const lead: StoredLead = {
    ...scored,
    id: id("lead"),
    createdAt,
    runId,
    crmStatus: "not_sent",
    name: input.name.trim(),
    email: input.email.trim(),
    source: (input.source ?? "unknown").trim() || "unknown",
    message: (input.message ?? "").trim(),
    budget: input.budget?.trim(),
    timeline: input.timeline?.trim(),
  };

  agent(emit, {
    agent: "orchestrator",
    status: "done",
    summary: `Lead ${lead.id} stored`,
    confidence: scored.confidence,
    decision: reviewDecision,
  });
  log(emit, "orchestrator", "success", "Pipeline complete.", {
    field: "lead_id",
    evidence: lead.id,
    confidence: scored.confidence,
  });
  emit({ type: "result", lead });
  return lead;
}

export function parseLeadIngest(body: unknown): LeadIngestInput | string {
  if (!body || typeof body !== "object") return "JSON object required.";
  const row = body as Record<string, unknown>;
  const name = String(row.name ?? "").trim();
  const email = String(row.email ?? "").trim();
  if (!name) return "name is required.";
  if (!email) return "email is required.";
  return {
    name,
    email,
    source: row.source != null ? String(row.source) : undefined,
    message: row.message != null ? String(row.message) : undefined,
    budget: row.budget != null ? String(row.budget) : undefined,
    timeline: row.timeline != null ? String(row.timeline) : undefined,
  };
}
