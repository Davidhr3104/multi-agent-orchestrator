import type {
  BehaviorEvent,
  BehaviorKind,
  CompetitorHit,
  FollowUpPlan,
  LeadEnrichment,
  LeadIngestInput,
  LeadTier,
  SalesRep,
  ScoreHistoryEntry,
  SentimentLabel,
  StoredLead,
} from "../types";

export const DEFAULT_REPS: SalesRep[] = [
  {
    id: "ana",
    name: "Ana Ruiz",
    senior: false,
    territories: ["us", "ca", "uk"],
    industries: ["healthcare", "hvac"],
  },
  {
    id: "luis",
    name: "Luis Ortega",
    senior: false,
    territories: ["mx", "latam", "es", "br"],
    industries: ["retail", "landscaping"],
  },
  {
    id: "sam",
    name: "Sam Patel",
    senior: true,
    territories: ["us", "uk", "eu", "in"],
    industries: ["tech", "saas"],
  },
];

export const BEHAVIOR_DELTA: Record<BehaviorKind, number> = {
  email_open: 5,
  link_click: 10,
  pricing_visit: 15,
  no_reply_7d: -10,
  email_reply: 12,
};

const COMPETITORS: { name: string; re: RegExp; talkingPoints: string[] }[] = [
  {
    name: "HubSpot",
    re: /\bhub\s*spot\b/i,
    talkingPoints: [
      "Helix sits in front of the CRM — scores before the inbox floods.",
      "HITL on mid-confidence beats HubSpot’s generic lead grade.",
    ],
  },
  {
    name: "Salesforce",
    re: /\bsalesforce\b|\bsfdc\b/i,
    talkingPoints: [
      "Keep Salesforce; Helix is the scoring layer, not a CRM rip-and-replace.",
      "GHL/Salesforce upsert without rebuilding objects.",
    ],
  },
  {
    name: "Pipedrive",
    re: /\bpipedrive\b/i,
    talkingPoints: ["Pipeline stages map 1:1; scoring is what Pipedrive leaves to reps."],
  },
  {
    name: "Zoho",
    re: /\bzoho\b/i,
    talkingPoints: ["Zoho is the system of record; Helix is the inbound filter."],
  },
  {
    name: "ActiveCampaign",
    re: /\bactive\s*campaign\b/i,
    talkingPoints: ["Use AC for sequences; Helix decides who is worth a sequence."],
  },
];

const POS =
  /\b(excited|love|great|ready|asap|let'?s (go|talk)|looking forward|perfect|thanks)\b/i;
const NEG =
  /\b(frustrated|angry|useless|waste|never|cancel|lawsuit|terrible|hate|scam)\b/i;

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function digitsOnly(phone?: string): string {
  return (phone ?? "").replace(/\D/g, "");
}

export function companyFromEmail(email: string): string {
  const host = email.split("@")[1] ?? "";
  const core = host.split(".")[0] ?? "";
  if (!core || /gmail|yahoo|hotmail|outlook|icloud|example|spam/.test(core)) return "";
  return core.replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function findDuplicate(
  leads: StoredLead[],
  input: Pick<LeadIngestInput, "email" | "phone" | "company" | "name">
): StoredLead | null {
  const email = normalizeEmail(input.email);
  const phone = digitsOnly(input.phone);
  const company = (input.company || companyFromEmail(input.email)).trim().toLowerCase();
  const name = input.name.trim().toLowerCase();

  for (const lead of leads) {
    if (normalizeEmail(lead.email) === email) return lead;
    if (phone && digitsOnly(lead.phone) === phone && phone.length >= 7) return lead;
    const leadCo = (lead.company || companyFromEmail(lead.email)).trim().toLowerCase();
    if (company && leadCo && company === leadCo && lead.name.trim().toLowerCase() === name) {
      return lead;
    }
  }
  return null;
}

export function inferIndustry(input: LeadIngestInput): string {
  const blob = `${input.message ?? ""} ${input.source ?? ""} ${input.email} ${input.company ?? ""}`;
  if (/\bhvac|heating|cooling|air\b/i.test(blob)) return "hvac";
  if (/\bhealth|clinic|hospital|dental\b/i.test(blob)) return "healthcare";
  if (/\bretail|ecommerce|store\b/i.test(blob)) return "retail";
  if (/\blandscap|lawn|garden\b/i.test(blob)) return "landscaping";
  if (/\bsaas|software|ai|tech|dev\b/i.test(blob)) return "tech";
  return "general";
}

export function inferTerritory(input: LeadIngestInput): string {
  const blob = `${input.country ?? ""} ${input.region ?? ""} ${input.message ?? ""} ${input.email}`;
  if (/\b(mexico|mx|latam|colombia|chile)\b/i.test(blob)) return "mx";
  if (/\b(spain|españa|es)\b/i.test(blob)) return "es";
  if (/\b(brazil|brasil|br|portugu)\b/i.test(blob)) return "br";
  if (/\b(uk|britain|london)\b/i.test(blob)) return "uk";
  if (/\b(eu|germany|france|nl)\b/i.test(blob)) return "eu";
  if (/\b(india|in)\b/i.test(blob)) return "in";
  if (/\.mx\b/i.test(input.email)) return "mx";
  if (/\.br\b/i.test(input.email)) return "br";
  if (/\.uk\b|\.co\.uk\b/i.test(input.email)) return "uk";
  return "us";
}

export function enrichFromSignals(input: LeadIngestInput): LeadEnrichment {
  const company = (input.company?.trim() || companyFromEmail(input.email) || "Unknown company").trim();
  const industry = inferIndustry(input);
  const personal = /gmail|yahoo|hotmail|outlook|icloud/i.test(input.email);
  const employees = personal ? "1–10 (personal inbox)" : "11–50 (domain heuristic)";
  const revenue = personal ? "n/a" : industry === "tech" ? "$1–10M est." : "$500k–5M est.";
  const q = encodeURIComponent(`${input.name} ${company}`);
  const techStack: string[] = [];
  const msg = `${input.message ?? ""} ${input.source ?? ""}`;
  if (/gohighlevel|\bghl\b/i.test(msg)) techStack.push("GoHighLevel");
  if (/hubspot/i.test(msg)) techStack.push("HubSpot");
  if (/salesforce/i.test(msg)) techStack.push("Salesforce");
  if (/wordpress|webflow|next\.js/i.test(msg)) techStack.push("Web CMS");
  return {
    company,
    industry,
    employees,
    revenue,
    linkedin: `https://www.linkedin.com/search/results/all/?keywords=${q}`,
    techStack,
    source: "heuristic",
  };
}

export function budgetNumber(budget?: string): number | null {
  if (!budget) return null;
  const n = Number(String(budget).replace(/[^0-9.]/g, ""));
  return Number.isFinite(n) ? n : null;
}

export function extractQualification(input: LeadIngestInput): {
  budget?: string;
  timeline?: string;
  decisionMaker?: string;
  meetingIntent: boolean;
} {
  const text = `${input.budget ?? ""} ${input.timeline ?? ""} ${input.message ?? ""}`;
  let budget = input.budget?.trim();
  if (!budget) {
    const m = text.match(/\$\s?(\d[\d,]*)\s*(k|m)?|\b(\d[\d,]*)\s*(usd|dollars|mensual(es)?|\/mo)/i);
    if (m) budget = m[0];
  }
  let timeline = input.timeline?.trim();
  if (!timeline) {
    const m = text.match(/\b(this week|this month|asap|q[1-4]|next quarter|30 days|urgent)\b/i);
    if (m) timeline = m[0];
  }
  const dm = text.match(
    /\b(ceo|cto|cfo|founder|owner|vp\s+\w+|need(?:s|ed)? approval(?: of| from)? [\w .]+)\b/i
  );
  return {
    budget,
    timeline,
    decisionMaker: dm ? dm[0] : undefined,
    meetingIntent: /\b(demo|call|meeting|calendly|schedule)\b/i.test(text),
  };
}

export function detectCompetitors(message?: string): CompetitorHit[] {
  const text = message ?? "";
  return COMPETITORS.filter((c) => c.re.test(text)).map((c) => ({
    name: c.name,
    talkingPoints: c.talkingPoints,
  }));
}

export function mergeCompetitors(fromClaude: CompetitorHit[] | undefined, fromText: CompetitorHit[]): CompetitorHit[] {
  const map = new Map<string, CompetitorHit>();
  for (const hit of [...fromText, ...(fromClaude ?? [])]) {
    const key = hit.name.trim().toLowerCase();
    if (!key) continue;
    const prev = map.get(key);
    if (!prev) {
      map.set(key, { name: hit.name, talkingPoints: [...hit.talkingPoints] });
    } else {
      map.set(key, {
        name: prev.name,
        talkingPoints: [...new Set([...prev.talkingPoints, ...hit.talkingPoints])],
      });
    }
  }
  return [...map.values()];
}

export function battleCardFromHits(hits: CompetitorHit[], existing?: string): string | undefined {
  const trimmed = existing?.trim();
  if (trimmed) return trimmed;
  const points = hits.flatMap((c) => c.talkingPoints).slice(0, 3);
  if (points.length === 0) return undefined;
  return points.map((p) => `• ${p}`).join("\n");
}

export function analyzeSentiment(message?: string): SentimentLabel {
  const text = message ?? "";
  const pos = POS.test(text);
  const neg = NEG.test(text);
  if (neg && !pos) return "negative";
  if (pos && !neg) return "positive";
  return "neutral";
}

export function detectLanguage(message?: string): "es" | "en" | "pt" {
  const text = message ?? "";
  if (/[ãõção]|você|obrigad/i.test(text)) return "pt";
  if (/[áéíóúñ¿¡]|tenemos|necesito|hola|gracias/i.test(text)) return "es";
  return "en";
}

export function tierFromScore(score: number): LeadTier {
  if (score >= 75) return "hot";
  if (score >= 50) return "warm";
  return "cold";
}

export function planFollowUp(score: number): FollowUpPlan {
  if (score > 80) {
    return {
      delay: "immediate",
      subject: "Thanks for your interest — let’s talk today",
      preview: "Hot lead sequence: same-day conversation ask.",
      status: "queued",
    };
  }
  if (score >= 60) {
    return {
      delay: "2h",
      subject: "How teams like yours qualify inbound",
      preview: "Warm sequence: case study in 2 hours.",
      status: "queued",
    };
  }
  return {
    delay: "24h",
    subject: "A simple way to keep junk out of the inbox",
    preview: "Cold sequence: educational email in 24 hours.",
    status: "queued",
  };
}

export function routeLead(
  input: LeadIngestInput & { score?: number; budget?: string },
  all: StoredLead[],
  reps: SalesRep[] = DEFAULT_REPS
): { assignee: string; reason: string } {
  const industry = inferIndustry(input);
  const territory = inferTerritory(input);
  const amount = budgetNumber(input.budget);
  const seniorOnly = amount != null && amount >= 10000;

  let pool = reps.filter((r) => {
    if (seniorOnly) return r.senior;
    return true;
  });
  const byIndustry = pool.filter((r) => r.industries.includes(industry));
  if (byIndustry.length) pool = byIndustry;
  const byTerr = pool.filter((r) => r.territories.includes(territory));
  if (byTerr.length) pool = byTerr;
  if (pool.length === 0) pool = seniorOnly ? reps.filter((r) => r.senior) : reps;

  const counts = new Map<string, number>();
  for (const r of pool) counts.set(r.name, 0);
  for (const lead of all) {
    if (lead.assignee && counts.has(lead.assignee)) {
      counts.set(lead.assignee, (counts.get(lead.assignee) ?? 0) + 1);
    }
  }
  pool = [...pool].sort((a, b) => (counts.get(a.name) ?? 0) - (counts.get(b.name) ?? 0));
  const pick = pool[0] ?? reps[0];
  const why = [
    seniorOnly ? "budget ≥ $10k → senior" : null,
    `industry ${industry}`,
    `territory ${territory}`,
    "round-robin",
  ]
    .filter(Boolean)
    .join(" · ");
  return { assignee: pick.name, reason: why };
}

export function sourceAttribution(leads: StoredLead[]): {
  source: string;
  total: number;
  hotPct: number;
}[] {
  const map = new Map<string, { total: number; hot: number }>();
  for (const lead of leads) {
    const key = lead.source || "unknown";
    const cur = map.get(key) ?? { total: 0, hot: 0 };
    cur.total += 1;
    if (lead.tier === "hot") cur.hot += 1;
    map.set(key, cur);
  }
  return [...map.entries()]
    .map(([source, v]) => ({
      source,
      total: v.total,
      hotPct: v.total === 0 ? 0 : Math.round((v.hot / v.total) * 100),
    }))
    .sort((a, b) => b.hotPct - a.hotPct);
}

function history(
  at: string,
  score: number,
  reason: string,
  extra: ScoreHistoryEntry[] = []
): ScoreHistoryEntry[] {
  return [...extra, { at, score, tier: tierFromScore(score), reason }];
}

export function attachIntelligence(
  fresh: StoredLead,
  existing: StoredLead | null,
  all: StoredLead[]
): StoredLead {
  const input: LeadIngestInput = {
    name: fresh.name,
    email: fresh.email,
    source: fresh.source,
    message: fresh.message,
    budget: fresh.budget,
    timeline: fresh.timeline,
    phone: fresh.phone,
    company: fresh.company,
    country: fresh.country,
    region: fresh.region,
  };
  const qual = extractQualification(input);
  const enrichment = enrichFromSignals({ ...input, company: input.company });
  const competitors = mergeCompetitors(fresh.competitors, detectCompetitors(fresh.message));
  const battleCard = battleCardFromHits(competitors, fresh.battleCard);
  const sentiment = analyzeSentiment(fresh.message);
  const language = detectLanguage(fresh.message);
  const routed = routeLead(
    { ...input, budget: qual.budget || fresh.budget, score: fresh.score },
    all.filter((l) => !existing || l.id !== existing.id)
  );
  const company = fresh.company || enrichment.company;
  const now = new Date().toISOString();

  if (!existing) {
    const score = fresh.score;
    return {
      ...fresh,
      budget: qual.budget || fresh.budget,
      timeline: qual.timeline || fresh.timeline,
      company,
      enrichment,
      competitors,
      battleCard,
      sentiment,
      language,
      assignee: routed.assignee,
      routingReason: routed.reason,
      decisionMaker: qual.decisionMaker,
      meetingIntent: qual.meetingIntent,
      notes: [],
      reingestCount: 0,
      baseScore: score,
      behaviors: [],
      scoreHistory: history(fresh.createdAt, score, "Initial form submission"),
      followUp: planFollowUp(score),
      agentTrace: fresh.agentTrace ?? [
        {
          agent: "extractor",
          status: "done",
          summary: `Found ${fresh.email}`,
          confidence: fresh.confidence,
        },
        {
          agent: "recommender",
          status: "done",
          summary: `${fresh.classification} · score ${fresh.score}`,
          confidence: fresh.confidence,
        },
        {
          agent: "reviewer",
          status: "done",
          summary: fresh.needsReview ? "needs review" : "approved",
          confidence: fresh.confidence,
          decision: fresh.needsReview ? "needs review" : "approved",
        },
      ],
    };
  }

  const nextScore = Math.max(0, Math.min(100, Math.round((existing.score + fresh.score) / 2 + 4)));
  const note = `Lead re-ingested (${now})`;
  return {
    ...existing,
    ...fresh,
    id: existing.id,
    createdAt: existing.createdAt,
    ghlContactId: existing.ghlContactId,
    crmStatus: existing.crmStatus,
    pipelineStage: existing.pipelineStage,
    score: nextScore,
    tier: tierFromScore(nextScore),
    budget: qual.budget || fresh.budget || existing.budget,
    timeline: qual.timeline || fresh.timeline || existing.timeline,
    company,
    enrichment,
    competitors: competitors.length ? competitors : existing.competitors,
    battleCard: battleCard || existing.battleCard,
    sentiment,
    language,
    assignee: existing.assignee || routed.assignee,
    routingReason: existing.routingReason || routed.reason,
    decisionMaker: qual.decisionMaker || existing.decisionMaker,
    meetingIntent: qual.meetingIntent || existing.meetingIntent,
    duplicateOf: existing.id,
    reingestCount: (existing.reingestCount ?? 0) + 1,
    notes: [...(existing.notes ?? []), note],
    baseScore: existing.baseScore ?? existing.score,
    behaviors: existing.behaviors ?? [],
    scoreHistory: history(
      now,
      nextScore,
      "Lead re-ingested — score refreshed",
      existing.scoreHistory ?? []
    ),
    followUp: planFollowUp(nextScore),
    reasoning: `${note}. ${fresh.reasoning}`,
  };
}

export function applyBehavior(lead: StoredLead, kind: BehaviorKind, at = new Date().toISOString()): StoredLead {
  const delta = BEHAVIOR_DELTA[kind];
  const score = Math.max(0, Math.min(100, lead.score + delta));
  const labels: Record<BehaviorKind, string> = {
    email_open: "Opened email",
    link_click: "Clicked link",
    pricing_visit: "Visited pricing page",
    no_reply_7d: "No reply in 7 days",
    email_reply: "Replied to email",
  };
  const event: BehaviorEvent = { at, kind, delta };
  return {
    ...lead,
    score,
    tier: tierFromScore(score),
    behaviors: [...(lead.behaviors ?? []), event],
    scoreHistory: history(at, score, `${labels[kind]} (${delta > 0 ? "+" : ""}${delta})`, lead.scoreHistory ?? []),
    followUp: planFollowUp(score),
  };
}

export function isBehaviorKind(value: string): value is BehaviorKind {
  return value in BEHAVIOR_DELTA;
}
