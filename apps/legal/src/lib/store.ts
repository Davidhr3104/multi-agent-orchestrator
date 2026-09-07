import {
  DEFAULT_LEGAL_PROFILE,
  scoreRfpHeuristic,
  type RfpIngestInput,
  type StoredRfp,
} from "@helix/core";
import type { AuditEvent } from "@/lib/audit-types";
import type { ConflictReport } from "@/lib/conflict-types";
import { heuristicConflictReport, runConflictCheck } from "@/lib/conflicts";
import type { PricingOverrides, PricingQuote } from "@/lib/pricing-types";
import { heuristicPricingQuote, runPricingQuote } from "@/lib/pricing";
import {
  isSupabaseConfigured,
  supabaseGetRfp,
  supabaseListAudit,
  supabaseListRfps,
  supabaseUpsertAudit,
  supabaseUpsertAudits,
  supabaseUpsertRfp,
  supabaseUpsertRfps,
} from "@/lib/supabase-desk";

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

function seedMemory() {
  const d = desk();
  if (d.seeded) return;
  d.seeded = true;
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
  seedMemory();

  const remoteRfps = await supabaseListRfps();
  if (remoteRfps === null) return; // schema missing / network — retry next call

  d.remoteBootstrapped = true;

  if (remoteRfps.length > 0) {
    d.memory.clear();
    for (const rfp of remoteRfps) d.memory.set(rfp.id, rfp);
  } else {
    await supabaseUpsertRfps([...d.memory.values()]);
  }

  const remoteAudit = await supabaseListAudit();
  if (remoteAudit === null) return;

  if (remoteAudit.length > 0) {
    d.audit.length = 0;
    d.audit.push(...remoteAudit);
  } else if (d.audit.length > 0) {
    await supabaseUpsertAudits([...d.audit]);
  }
}

export async function listRfps(): Promise<StoredRfp[]> {
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
  return rfp;
}

export async function getRfp(id: string): Promise<StoredRfp | null> {
  const d = desk();
  seedMemory();
  if (d.memory.has(id)) return d.memory.get(id) ?? null;
  await hydrateFromRemote();
  if (d.memory.has(id)) return d.memory.get(id) ?? null;
  const remote = await supabaseGetRfp(id);
  if (remote) {
    d.memory.set(remote.id, remote);
    return remote;
  }
  return null;
}

export async function patchRfp(
  id: string,
  patch: Partial<Pick<StoredRfp, "needsReview" | "corpusStatus">>
): Promise<StoredRfp | null> {
  const current = await getRfp(id);
  if (!current) return null;
  const next = { ...current, ...patch };
  return saveRfp(next);
}

export async function listComms(id: string): Promise<CommEvent[]> {
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

export async function listAudit(): Promise<AuditEvent[]> {
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
  return report;
}

export async function checkAndStoreConflict(rfp: StoredRfp): Promise<ConflictReport> {
  seedMemory();
  const report = await runConflictCheck(rfp);
  desk().conflicts.set(rfp.id, report);
  await pushAudit("ethics", "coi", `${rfp.title}: ${report.verdict} (${report.score}) via ${report.engine}`);
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
  return quote;
}

export async function checkAndStorePricing(rfp: StoredRfp, overrides?: PricingOverrides): Promise<PricingQuote> {
  seedMemory();
  const quote = await runPricingQuote(rfp, overrides);
  desk().quotes.set(rfp.id, quote);
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
