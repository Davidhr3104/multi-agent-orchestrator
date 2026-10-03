import {
  DEFAULT_LEGAL_PROFILE,
  resolveDeskMode,
  scoreRfpHeuristic,
  type RfpIngestInput,
  type StoredRfp,
} from "@helix/core";
import type { AuditEvent } from "@/lib/audit-types";
import { modelForMethod, traceSuffix } from "@/lib/audit-trace";
import type { ConflictReport } from "@/lib/conflict-types";
import { heuristicConflictReport, runConflictCheck } from "@/lib/conflicts";
import { checkNoBidRules, loadNoBidRules } from "@/lib/no-bid-rules";
import type { PricingOverrides, PricingQuote } from "@/lib/pricing-types";
import { heuristicPricingQuote, runPricingQuote } from "@/lib/pricing";
import {
  isSupabaseConfigured,
  legalGate,
  supabaseProbeDesk,
  supabaseGetRfp,
  supabaseListAudit,
  supabaseListRfps,
  supabaseUpsertAudit,
  supabaseUpsertAudits,
  supabaseUpsertRfp,
  supabaseUpsertRfps,
  supabaseGetProfile,
  supabaseUpsertProfile,
  supabaseUpsertJson,
  supabaseLoadJsonMap,
  supabaseGetRfpMeta,
  supabaseLoadRfpMetaMap,
  supabaseUpsertRfpMeta,
} from "@/lib/supabase-desk";
import type { AiUsageEntry } from "@/lib/ai-cost";
import { pickRfpMeta, type LegalRfp, type LegalRfpMeta } from "@/lib/legal-rfp";

export type { AuditEvent } from "@/lib/audit-types";

export type CommKind = "email" | "call" | "meeting" | "note";
export type CommEvent = { id: string; at: string; kind: CommKind; text: string };

let clientProfile = DEFAULT_LEGAL_PROFILE;

export function getClientProfile(): string {
  return clientProfile;
}

export function setClientProfile(next: string): string | null {
  const trimmed = next.trim();
  if (trimmed.length < 24) return null;
  clientProfile = trimmed;
  void supabaseUpsertProfile(clientProfile);
  void pushAudit("ops", "settings", "Client profile updated");
  return clientProfile;
}

type LegalDesk = {
  memory: Map<string, StoredRfp>;
  seeded: boolean;
  remoteBootstrapped: boolean;
  comms: Map<string, CommEvent[]>;
  audit: AuditEvent[];
  conflicts: Map<string, ConflictReport>;
  quotes: Map<string, PricingQuote>;
};

function desk(): LegalDesk {
  const g = globalThis as typeof globalThis & { __helixLegalDesk?: LegalDesk };
  if (!g.__helixLegalDesk) {
    g.__helixLegalDesk = {
      memory: new Map(),
      seeded: false,
      remoteBootstrapped: false,
      comms: new Map(),
      audit: [],
      conflicts: new Map(),
      quotes: new Map(),
    };
  }
  return g.__helixLegalDesk;
}

const SAMPLES: RfpIngestInput[] = [
  {
    title: "Medical record abstraction — mass tort docket",
    issuer: "Northstar PI Consortium",
    body: "Due: 2026-09-18. Q&A deadline: 2026-09-11. Budget $85,000. Method: BEAR. Need clinical chart review and IME summarization for personal injury files in Texas. Submit by September 18, 2026. Malpractice coverage $2M required. Incumbent Harbor Review Group. Penalty of 10% for late deliverables.",
  },
  {
    title: "SPI coding for workers' compensation clinic",
    issuer: "Harbor Occupational Health",
    body: "Deadline 2026-10-02. $42,000. SPI preferred. Extract ICD and work-status from clinical notes. Injury clinic, not a software vendor RFP. Five years experience in workers' compensation coding. E&O insurance required.",
  },
  {
    title: "County IT — Kubernetes refresh",
    issuer: "Lake County CIO",
    body: "Due 2026-11-01. $210,000 for cluster migration and SaaS catalog sync. No medical records. Shopify-adjacent vendor portal. SOC2 Type II mandatory. Incumbent Nimbus Cloud. IP ownership assigned to County. Site visit 2026-10-15.",
  },
  {
    title: "Clinical NLP RFP (thin posting)",
    issuer: "Unspecified",
    body: "Looking for AI help with documents. Timeline TBD. Method not stated. ISO 27001 preferred.",
  },
];

function applyDemoCatalog() {
  const d = desk();
  d.memory.clear();
  d.comms.clear();
  d.audit.length = 0;
  d.conflicts.clear();
  d.quotes.clear();
  SAMPLES.forEach((sample, i) => {
    const scored = scoreRfpHeuristic(sample);
    const rfp: StoredRfp = {
      ...scored,
      id: `seed-${sample.title.replace(/[^a-z0-9]/gi, "").slice(0, 14)}`,
      createdAt: new Date(Date.now() - i * 2 * 86_400_000).toISOString(),
      runId: `seed-run-${i}`,
      title: sample.title,
      issuer: sample.issuer ?? "unspecified",
      body: sample.body,
      clientProfile: sample.clientProfile ?? getClientProfile(),
      corpusStatus: "not_asked",
    };
    d.memory.set(rfp.id, rfp);
  });

  // Closed-loop demo outcomes for /outcomes win-rate story
  const now = new Date().toISOString();
  const byTitle = [...d.memory.values()];
  const medical = byTitle.find((r) => r.title.startsWith("Medical record"));
  const spi = byTitle.find((r) => r.title.startsWith("SPI coding"));
  const county = byTitle.find((r) => r.title.startsWith("County IT"));
  const nlp = byTitle.find((r) => r.title.startsWith("Clinical NLP"));
  if (medical) {
    medical.needsReview = false;
    medical.partnerDecision = {
      verdict: "GO",
      coiCleared: true,
      bidAmount: "$85,000",
      notes: "Strong BEAR fit — clinical chart review core practice.",
      decidedBy: "Maya Chen",
      decidedAt: now,
      outcome: "won",
      outcomeAt: now,
      wonAmount: "$92,000",
    };
    d.memory.set(medical.id, medical);
  }
  if (spi) {
    spi.needsReview = false;
    spi.partnerDecision = {
      verdict: "GO",
      coiCleared: true,
      bidAmount: "$42,000",
      notes: "SPI preferred — pursued.",
      decidedBy: "Luis Ortega",
      decidedAt: now,
      outcome: "lost",
      outcomeAt: now,
      outcomeNotes: "Incumbent retained on price.",
    };
    d.memory.set(spi.id, spi);
  }
  if (county) {
    county.needsReview = false;
    county.partnerDecision = {
      verdict: "NO-GO",
      coiCleared: true,
      bidAmount: "$210,000",
      notes: "No medical records — outside practice.",
      decidedBy: "Priya Shah",
      decidedAt: now,
      outcome: "no_bid",
      outcomeAt: now,
    };
    d.memory.set(county.id, county);
  }
  if (nlp) {
    nlp.needsReview = true;
    nlp.partnerDecision = {
      verdict: "CONDITIONAL",
      coiCleared: false,
      bidAmount: "Unspecified",
      notes: "Thin posting — need clearer scope before GO.",
      decidedBy: "Luis Ortega",
      decidedAt: now,
      outcome: "pending",
      outcomeAt: now,
    };
    d.memory.set(nlp.id, nlp);
  }
  d.comms.set("seed-Medicalrecord", [
    {
      id: "c1",
      at: new Date(Date.now() - 3 * 86_400_000).toISOString(),
      kind: "email",
      text: "Sent capability deck to Northstar intake counsel.",
    },
    {
      id: "c2",
      at: new Date(Date.now() - 1 * 86_400_000).toISOString(),
      kind: "call",
      text: "15m scoping call — they want BEAR samples by Friday.",
    },
  ]);
  pushAuditSync("system", "seed", "Loaded evaluation desk with 4 RFPs");
  pushAuditSync("Maya Chen", "ingest", "Medical record abstraction — mass tort docket scored BEAR / hot");
  pushAuditSync("ethics", "coi", "Medical record abstraction — mass tort docket: CONDITIONAL (62) via heuristic");
  pushAuditSync("pricing", "quote", "Medical record abstraction — mass tort docket: $216,000 clinical via heuristic");
  pushAuditSync("Luis Ortega", "review", "SPI coding RFP marked for partner review");
  pushAuditSync("ethics", "coi", "SPI coding for workers' compensation clinic: CONDITIONAL (58) via heuristic");
  pushAuditSync("pricing", "quote", "SPI coding for workers' compensation clinic: $128,000 SPI via heuristic");
  pushAuditSync("Priya Shah", "compliance", "Lake County Kubernetes posting flagged SOC2 + IP assignment");
  pushAuditSync("ethics", "coi", "County IT — Kubernetes refresh: GO (88) via heuristic");
  pushAuditSync("pricing", "quote", "County IT — Kubernetes refresh: $288,000 other via heuristic");
  pushAuditSync("Maya Chen", "outcome", "Medical record abstraction — mass tort docket: won");
  pushAuditSync("Luis Ortega", "outcome", "SPI coding for workers' compensation clinic: lost");
  pushAuditSync("Priya Shah", "partner", "County IT — Kubernetes refresh: NO-GO · capacity avoided");
  d.seeded = true;
}

export function currentDeskMode(): "demo" | "live" {
  const m = legalGate.mode();
  // Before the first probe finishes there is nothing connected to consult: decide from the env alone.
  return m === "unknown" ? resolveDeskMode({ connected: false, realRecords: 0 }) : m;
}

function seedMemory() {
  const d = desk();
  if (d.seeded) return;
  if (currentDeskMode() !== "demo") {
    d.seeded = true;
    return;
  }
  applyDemoCatalog();
}

const PROBE_TTL_MS = 10_000;
let lastProbe = 0;

/** Re-decides demo vs live (throttled) and drops memory when it flips so demo and real data never mix. */
async function ensureDeskMode(): Promise<void> {
  let remoteRecords = legalGate.mode() === "live" ? 1 : 0;
  if (Date.now() - lastProbe > PROBE_TTL_MS) {
    lastProbe = Date.now();
    remoteRecords = (await supabaseProbeDesk()).hasRfps ? 1 : 0;
  }
  const changed = legalGate.evaluate({ connected: false, remoteRecords });
  if (!changed) return;
  const d = desk();
  d.memory.clear();
  d.comms.clear();
  d.audit.length = 0;
  d.conflicts.clear();
  d.quotes.clear();
  d.seeded = false;
  d.remoteBootstrapped = false;
}

function pushAuditSync(actor: string, action: string, detail: string): AuditEvent {
  const d = desk();
  const event: AuditEvent = {
    id: `a-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    at: new Date().toISOString(),
    actor,
    action,
    detail,
  };
  d.audit.unshift(event);
  if (d.audit.length > 400) d.audit.length = 400;
  return event;
}

async function pushAudit(actor: string, action: string, detail: string): Promise<AuditEvent> {
  const event = pushAuditSync(actor, action, detail);
  await supabaseUpsertAudit(event);
  return event;
}

/** When Supabase is empty, push memory seed once so restarts keep the desk. */
async function hydrateFromRemote(): Promise<void> {
  const d = desk();
  if (d.remoteBootstrapped || !isSupabaseConfigured()) return;

  const remoteAll = await supabaseListRfps();
  if (remoteAll === null) return; // schema missing / network — retry next call
  // Older versions stored the demo RFPs (ids "seed-…") in Supabase; a live desk never shows them.
  const remoteRfps = remoteAll.filter((r) => !r.id.startsWith("seed-"));

  d.remoteBootstrapped = true;

  if (remoteRfps.length > 0) {
    d.memory.clear();
    const metaMap = (await supabaseLoadRfpMetaMap<LegalRfpMeta>()) ?? {};
    for (const rfp of remoteRfps) d.memory.set(rfp.id, { ...rfp, ...(metaMap[rfp.id] ?? {}) });
  } else {
    seedMemory();
    if (d.memory.size > 0) await supabaseUpsertRfps([...d.memory.values()]);
  }

  const remoteAudit = await supabaseListAudit();
  if (remoteAudit === null) return;

  if (remoteAudit.length > 0) {
    d.audit.length = 0;
    d.audit.push(...remoteAudit);
  } else if (d.audit.length > 0) {
    await supabaseUpsertAudits([...d.audit]);
  }

  const profile = await supabaseGetProfile();
  if (profile && profile.length >= 24) clientProfile = profile;
  else await supabaseUpsertProfile(clientProfile);

  const remoteConflicts = await supabaseLoadJsonMap("conflicts");
  if (remoteConflicts) {
    for (const [id, report] of Object.entries(remoteConflicts)) {
      d.conflicts.set(id, report as ConflictReport);
    }
  }
  const remoteQuotes = await supabaseLoadJsonMap("quotes");
  if (remoteQuotes) {
    for (const [id, quote] of Object.entries(remoteQuotes)) {
      d.quotes.set(id, quote as PricingQuote);
    }
  }
}

export async function listRfps(): Promise<StoredRfp[]> {
  await ensureDeskMode();
  const d = desk();
  seedMemory();
  await hydrateFromRemote();
  // Do not re-pull Supabase on every list — that can clobber in-memory desk state
  // when upserts lag or fail on serverless isolates.
  return [...d.memory.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function saveRfp(rfp: StoredRfp): Promise<StoredRfp> {
  seedMemory();
  desk().memory.set(rfp.id, rfp);
  await supabaseUpsertRfp(rfp);
  const meta = pickRfpMeta(rfp as LegalRfp);
  if (meta) await supabaseUpsertRfpMeta(rfp.id, meta);
  return rfp;
}

/** Source, AI extraction, Go/No-Go proposal and AI cost live beside the core RFP record. */
export async function updateRfpMeta(id: string, patch: LegalRfpMeta): Promise<LegalRfp | null> {
  const current = (await getRfp(id)) as LegalRfp | null;
  if (!current) return null;
  return (await saveRfp({ ...current, ...patch } as LegalRfp)) as LegalRfp;
}

export async function appendAiUsage(id: string, entries: AiUsageEntry[]): Promise<LegalRfp | null> {
  const current = (await getRfp(id)) as LegalRfp | null;
  if (!current) return null;
  if (entries.length === 0) return current;
  return updateRfpMeta(id, { aiUsage: [...(current.aiUsage ?? []), ...entries] });
}

export async function getRfp(id: string): Promise<StoredRfp | null> {
  await ensureDeskMode();
  const d = desk();
  seedMemory();
  if (d.memory.has(id)) return d.memory.get(id) ?? null;
  await hydrateFromRemote();
  if (d.memory.has(id)) return d.memory.get(id) ?? null;
  const remote = await supabaseGetRfp(id);
  if (remote) {
    const merged: LegalRfp = { ...remote, ...((await supabaseGetRfpMeta<LegalRfpMeta>(id)) ?? {}) };
    d.memory.set(merged.id, merged);
    return merged;
  }
  return null;
}

export async function patchRfp(
  id: string,
  patch: Partial<Pick<StoredRfp, "needsReview" | "corpusStatus" | "partnerDecision" | "corpusHits">>
): Promise<StoredRfp | null> {
  const current = await getRfp(id);
  if (!current) return null;
  const next = { ...current, ...patch };
  return saveRfp(next);
}

/**
 * Runs the firm's structured no-bid rules against the RFP text at ingest.
 * On a match, writes a system partnerDecision of NO-GO up front — goNoGo()
 * already treats partnerDecision as authoritative, so this makes the rule a
 * real gate on the verdict instead of just descriptive corpus text a human
 * has to remember to check. A later real partner decision overwrites it.
 */
export async function checkAndStoreNoBid(rfp: StoredRfp): Promise<{ blocked: boolean; reason?: string }> {
  const { rules } = await loadNoBidRules();
  const hit = checkNoBidRules(`${rfp.title} ${rfp.body}`, rules);
  if (!hit.blocked) return { blocked: false };
  await patchRfp(rfp.id, {
    partnerDecision: {
      verdict: "NO-GO",
      coiCleared: false,
      decidedBy: "no-bid rule",
      decidedAt: new Date().toISOString(),
      notes: `Auto no-bid: "${hit.rule.pattern}" — ${hit.rule.reason}`,
      outcome: "no_bid",
      outcomeAt: new Date().toISOString(),
    },
  });
  await pushAudit("intake", "no-bid", `${rfp.title}: auto NO-GO via rule "${hit.rule.pattern}" — ${hit.rule.reason}`);
  return { blocked: true, reason: hit.rule.reason };
}

export async function listComms(id: string): Promise<CommEvent[]> {
  await ensureDeskMode();
  seedMemory();
  await hydrateFromRemote();
  return [...(desk().comms.get(id) ?? [])].sort((a, b) => b.at.localeCompare(a.at));
}

export async function addComm(id: string, kind: CommKind, text: string): Promise<CommEvent[] | null> {
  const rfp = await getRfp(id);
  if (!rfp) return null;
  const event: CommEvent = {
    id: `c-${Date.now()}`,
    at: new Date().toISOString(),
    kind,
    text: text.trim() || "Logged contact",
  };
  const d = desk();
  d.comms.set(id, [event, ...(d.comms.get(id) ?? [])]);
  await pushAudit("ops", "comms", `${kind} on ${rfp.title}`);
  return listComms(id);
}

/** Ids of the notes logged on an RFP — Helix AI's Undo for "add a note" removes any that appeared since. */
export async function commIds(id: string): Promise<string[]> {
  return (await listComms(id)).map((c) => c.id);
}

export async function removeCommsExcept(id: string, keepIds: string[]): Promise<void> {
  desk().comms.set(
    id,
    (desk().comms.get(id) ?? []).filter((c) => keepIds.includes(c.id))
  );
}

export async function listAudit(): Promise<AuditEvent[]> {
  await ensureDeskMode();
  const d = desk();
  seedMemory();
  await hydrateFromRemote();
  const remote = await supabaseListAudit();
  if (remote && remote.length > 0) {
    d.audit.length = 0;
    d.audit.push(...remote);
    return remote;
  }
  return [...d.audit];
}

export async function recordAudit(actor: string, action: string, detail: string): Promise<AuditEvent> {
  seedMemory();
  await hydrateFromRemote();
  return pushAudit(actor, action, detail);
}

export function getCachedConflict(rfpId: string): ConflictReport | undefined {
  return desk().conflicts.get(rfpId);
}

export async function cacheHeuristicConflict(rfp: StoredRfp): Promise<ConflictReport> {
  seedMemory();
  const d = desk();
  const existing = d.conflicts.get(rfp.id);
  if (existing) return existing;
  const report = await heuristicConflictReport(rfp);
  d.conflicts.set(rfp.id, report);
  await supabaseUpsertJson("conflicts", rfp.id, report);
  return report;
}

export async function checkAndStoreConflict(rfp: StoredRfp): Promise<ConflictReport> {
  seedMemory();
  const report = await runConflictCheck(rfp);
  desk().conflicts.set(rfp.id, report);
  await supabaseUpsertJson("conflicts", rfp.id, report);
  if (report.usage) await appendAiUsage(rfp.id, [report.usage]);
  await pushAudit(
    "ethics",
    "coi",
    [
      `${rfp.title}: ${report.verdict} (${report.score}) via ${report.engine}`,
      traceSuffix({
        model: modelForMethod(rfp.method),
        prompt: report.engine === "claude" ? "coi-claude-v1" : "coi-heuristic-v1",
        match: `${rfp.matchScore} → coi ${report.score}`,
        approval: "pending partner",
      }),
    ].join("\n")
  );
  return report;
}

export async function conflictSummaries(): Promise<Record<string, ConflictReport>> {
  seedMemory();
  await hydrateFromRemote();
  const d = desk();
  const rfps = await listRfps();
  for (const rfp of rfps) {
    if (!d.conflicts.has(rfp.id)) {
      d.conflicts.set(rfp.id, await heuristicConflictReport(rfp));
    }
  }
  return Object.fromEntries(d.conflicts);
}

export function getCachedPricing(rfpId: string): PricingQuote | undefined {
  return desk().quotes.get(rfpId);
}

export async function cacheHeuristicPricing(rfp: StoredRfp): Promise<PricingQuote> {
  seedMemory();
  const d = desk();
  const existing = d.quotes.get(rfp.id);
  if (existing) return existing;
  const quote = await heuristicPricingQuote(rfp);
  d.quotes.set(rfp.id, quote);
  await supabaseUpsertJson("quotes", rfp.id, quote);
  return quote;
}

export async function checkAndStorePricing(rfp: StoredRfp, overrides?: PricingOverrides): Promise<PricingQuote> {
  seedMemory();
  const quote = await runPricingQuote(rfp, overrides);
  desk().quotes.set(rfp.id, quote);
  await supabaseUpsertJson("quotes", rfp.id, quote);
  await pushAudit("pricing", "quote", `${rfp.title}: ${quote.target} ${quote.practiceArea} via ${quote.engine}`);
  return quote;
}

export async function pricingSummaries(): Promise<Record<string, PricingQuote>> {
  seedMemory();
  await hydrateFromRemote();
  const d = desk();
  const rfps = await listRfps();
  for (const rfp of rfps) {
    if (!d.quotes.has(rfp.id)) {
      d.quotes.set(rfp.id, await heuristicPricingQuote(rfp));
    }
  }
  return Object.fromEntries(d.quotes);
}

export type DeskModeStatus = {
  empty: boolean;
  demo: boolean;
  mode: "demo" | "live";
  store: "supabase" | "memory";
  count: number;
};

export async function deskStatus(): Promise<DeskModeStatus> {
  const rfps = await listRfps();
  return {
    empty: rfps.length === 0,
    demo: currentDeskMode() === "demo",
    mode: currentDeskMode(),
    store: isSupabaseConfigured() ? "supabase" : "memory",
    count: rfps.length,
  };
}

export async function loadDemoCatalog(): Promise<DeskModeStatus> {
  await ensureDeskMode();
  if (currentDeskMode() !== "demo") {
    throw new Error("Demo data is only available before you start using your own data.");
  }
  applyDemoCatalog();
  return deskStatus();
}

export async function clearDesk(): Promise<DeskModeStatus> {
  // "Start with my own data": leave the demo for good, so new RFPs persist to Supabase.
  legalGate.goLive();
  legalGate.evaluate({ connected: false, remoteRecords: 0 });
  const g = globalThis as typeof globalThis & { __helixLegalDesk?: LegalDesk };
  delete g.__helixLegalDesk;
  const d = desk();
  d.seeded = true;
  d.remoteBootstrapped = true;
  return deskStatus();
}
