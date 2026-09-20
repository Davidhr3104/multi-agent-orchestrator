import { completeWithClaude, isClaudeConfigured, parseJsonObject } from "../claude";
import { hydrateScoredField } from "../fact";
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

function agent(emit: LeadEmit, run: AgentRun, trace: AgentRun[]) {
  const i = trace.findIndex((t) => t.agent === run.agent);
  if (i >= 0) trace[i] = run;
  else trace.push(run);
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
  competitors?: string[];
  battle_card?: string;
};

function normalizeClaude(
  raw: ClaudeJson,
  fallback: LeadScoreResult,
  document: string,
  hitl: number
): LeadScoreResult {
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
      ? raw.fields.map((f, i) => hydrateScoredField(document, f, i))
      : fallback.fields;

  const needsReview = confidence < hitl || (score >= 40 && score <= 60);

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
  emit: LeadEmit,
  opts?: { hitl?: number; addendum?: string }
): Promise<StoredLead> {
  const runId = id("run");
  const createdAt = now();
  const hitl = opts?.hitl ?? 0.65;
  const trace: AgentRun[] = [];

  log(emit, "orchestrator", "info", "Lead ingest accepted.", {
    field: "run_id",
    evidence: runId,
  });
  agent(
    emit,
    {
      agent: "orchestrator",
      status: "running",
      summary: "Routing EXT → REC → REV",
      confidence: 0.9,
    },
    trace
  );

  agent(
    emit,
    {
      agent: "extractor",
      status: "running",
      summary: "Extracting contact fields",
      confidence: 0.5,
    },
    trace
  );
  log(emit, "extractor", "info", `Parsed ${input.name} <${input.email}>.`);

  const heuristic = scoreLeadHeuristic(input, { hitl });
  let scored = heuristic;
  const document = [input.name, input.email, input.source, input.message, input.budget, input.timeline]
    .filter(Boolean)
    .join("\n");

  agent(
    emit,
    {
      agent: "recommender",
      status: "running",
      summary: "Scoring lead vs spam vs info",
      confidence: 0.5,
    },
    trace
  );

  let claudeCompetitors: string[] = [];
  let battleCard = "";

  if (isClaudeConfigured()) {
    log(emit, "recommender", "info", "Calling Claude for classification + score.");
    const text = await completeWithClaude(leadScoringPrompt(input, opts?.addendum));
    const parsed = text ? parseJsonObject<ClaudeJson>(text) : null;
    if (parsed) {
      scored = normalizeClaude(parsed, heuristic, document, hitl);
      claudeCompetitors = (parsed.competitors ?? []).filter((n) => typeof n === "string" && n.trim());
      battleCard = (parsed.battle_card ?? "").trim();
      log(emit, "recommender", "success", "Claude JSON accepted.", {
        confidence: scored.confidence,
      });
    } else {
      log(emit, "recommender", "warn", "Claude unavailable or invalid JSON; using heuristic.");
    }
  } else {
    log(emit, "recommender", "info", "No ANTHROPIC_API_KEY; heuristic scoring.");
  }

  agent(
    emit,
    {
      agent: "extractor",
      status: "done",
      summary: `${scored.fields.length} scored fields`,
      confidence: scored.confidence,
      decision: scored.needsReview ? "needs review" : "approved",
    },
    trace
  );
  agent(
    emit,
    {
      agent: "recommender",
      status: "done",
      summary: `${scored.classification} · ${scored.score} · ${scored.tier}`,
      confidence: scored.confidence,
      decision: scored.classification === "spam" ? "blocked" : "approved",
    },
    trace
  );

  agent(
    emit,
    {
      agent: "reviewer",
      status: "running",
      summary: "HITL gate",
      confidence: scored.confidence,
    },
    trace
  );
  const reviewDecision = scored.needsReview ? "needs review" : "approved";
  log(emit, "reviewer", "decision", `Reviewer: ${reviewDecision}.`, {
    confidence: scored.confidence,
  });
  agent(
    emit,
    {
      agent: "reviewer",
      status: "done",
      summary: reviewDecision,
      confidence: scored.confidence,
      decision: reviewDecision,
    },
    trace
  );

  const lead: StoredLead = {
    ...scored,
    id: id("lead"),
    createdAt,
    runId,
    crmStatus: "not_sent",
    pipelineStage: "new",
    name: input.name.trim(),
    email: input.email.trim(),
    source: (input.source ?? "unknown").trim() || "unknown",
    message: (input.message ?? "").trim(),
    budget: input.budget?.trim(),
    timeline: input.timeline?.trim(),
    phone: input.phone?.trim(),
    company: input.company?.trim(),
    country: input.country?.trim(),
    region: input.region?.trim(),
    trade: input.trade?.trim(),
    zip: input.zip?.trim(),
    campaignId: input.campaignId?.trim(),
    utmSource: input.utmSource?.trim(),
    utmCampaign: input.utmCampaign?.trim(),
    competitors: claudeCompetitors.map((name) => ({ name, talkingPoints: [] })),
    battleCard: battleCard || undefined,
    agentTrace: trace,
  };

  agent(
    emit,
    {
      agent: "orchestrator",
      status: "done",
      summary: `Lead ${lead.id} stored`,
      confidence: scored.confidence,
      decision: reviewDecision,
    },
    trace
  );
  lead.agentTrace = [...trace];
  log(emit, "orchestrator", "success", "Pipeline complete.", {
    field: "lead_id",
    evidence: lead.id,
    confidence: scored.confidence,
  });
  emit({ type: "result", lead });
  return lead;
}

function field(row: Record<string, unknown>, ...keys: string[]): string | undefined {
  for (const key of keys) {
    const value = row[key];
    if (value == null) continue;
    const text = String(value).trim();
    if (text) return text;
  }
  return undefined;
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
    source: field(row, "source"),
    message: field(row, "message"),
    budget: field(row, "budget"),
    timeline: field(row, "timeline"),
    phone: field(row, "phone"),
    company: field(row, "company"),
    country: field(row, "country"),
    region: field(row, "region"),
    trade: field(row, "trade"),
    zip: field(row, "zip", "postal_code", "postalCode"),
    campaignId: field(row, "campaignId", "campaign_id"),
    utmSource: field(row, "utmSource", "utm_source"),
    utmCampaign: field(row, "utmCampaign", "utm_campaign"),
  };
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

export function parseGhlWebhook(body: unknown): LeadIngestInput | string {
  if (!body || typeof body !== "object") return "JSON object required.";
  const raw = body as Record<string, unknown>;
  const contact = asRecord(raw.contact) ?? raw;
  const custom = asRecord(contact.customData) ?? asRecord(contact.custom_data) ?? {};
  const campaign = asRecord(contact.campaign) ?? asRecord(raw.campaign);
  const first = field(contact, "first_name", "firstName") ?? "";
  const last = field(contact, "last_name", "lastName") ?? "";
  const combined = `${first} ${last}`.trim();
  return parseLeadIngest({
    name: field(contact, "name", "full_name", "fullName") ?? combined,
    email: field(contact, "email") ?? "",
    phone: field(contact, "phone", "phone_number"),
    source: field(contact, "source") ?? field(raw, "source"),
    company: field(contact, "company", "companyName"),
    message: field(custom, "message") ?? field(contact, "message") ?? field(raw, "message"),
    trade: field(custom, "trade") ?? field(contact, "trade"),
    zip: field(custom, "zip") ?? field(contact, "zip", "postal_code"),
    campaign_id:
      field(contact, "campaignId", "campaign_id") ??
      (campaign ? field(campaign, "id", "campaignId") : undefined),
    utm_source: field(custom, "utm_source", "utmSource") ?? field(contact, "utm_source", "utmSource"),
    utm_campaign:
      field(custom, "utm_campaign", "utmCampaign") ?? field(contact, "utm_campaign", "utmCampaign"),
  });
}

export { tierFromScore } from "./intelligence";
