import {
  attachIntelligence,
  demoAvailable,
  getSecret,
  isDemoRecordId,
  resolveDeskMode,
  scoreLeadHeuristic,
  type DeskMode,
  type LeadIngestInput,
  type StoredLead,
} from "@helix/core";
import { isSupabaseConfigured, supabaseListLeads, supabaseUpsertLead } from "./supabase-leads";

/**
 * Two stores, never mixed:
 *  - `real`    what a workspace actually owns (cache in front of Supabase, or the local desk).
 *  - `sandbox` demonstration data. Lives in memory only and is never written to Supabase.
 * Which one a request sees is decided by resolveView(), from one rule: an integration is
 * connected or real records exist -> live; otherwise demo. See resolveDeskMode() in helix-core.
 */
const real = new Map<string, StoredLead>();
const sandbox = new Map<string, StoredLead>();
let sandboxSeeded = false;

const SAMPLES: LeadIngestInput[] = [
  {
    name: "Maya Chen",
    email: "maya@northwindhvac.com",
    source: "GHL form",
    budget: "8500",
    timeline: "this month",
    message:
      "We need AI to score inbound HVAC quotes. Ready to start this month if it plugs into GoHighLevel.",
  },
  {
    name: "Luis Ortega",
    email: "luis@ortegraland.com",
    source: "referral",
    budget: "4000",
    timeline: "soon",
    message: "Landscaping company. Leads from Google Ads are 60% junk. Want classification + routing.",
  },
  {
    name: "Ava Brooks",
    email: "ava@example.org",
    source: "website",
    message: "Just looking at how the scoring works before we talk to sales.",
  },
  {
    name: "Crypto Blast",
    email: "buy@spam.invalid",
    source: "unknown",
    message: "Buy followers and crypto nft drop click here free money",
  },
  {
    // Mid-band on purpose: lands in the human-review queue so the demo has a real approve flow.
    name: "Priya Nair",
    email: "priya@brightpath-roofing.com",
    source: "website",
    timeline: "next quarter",
    message:
      "We run a roofing company and are exploring options for lead qualification. Could be a fit later this year, still comparing vendors.",
  },
  {
    name: "Jordan Hale",
    email: "jordan.hale@bookedjobs.example",
    source: "Upwork",
    budget: "12000",
    timeline: "this week",
    message:
      "Urgent: we close jobs from Facebook leads. Need hot/warm/cold in the dashboard and human review on mid scores. Evaluating HubSpot too.",
  },
];

function applyDemoCatalog() {
  sandbox.clear();
  for (const sample of SAMPLES) {
    const scored = scoreLeadHeuristic(sample);
    const lead: StoredLead = attachIntelligence(
      {
        ...scored,
        id: `seed-${sample.email.replace(/[^a-z0-9]/gi, "").slice(0, 12)}`,
        createdAt: new Date(
          Date.now() -
            (sample.email.startsWith("ava@")
              ? 200 * 86400000
              : sample.email.startsWith("luis@")
                ? 190 * 86400000
                : sandbox.size * 36e5)
        ).toISOString(),
        runId: `seed-run-${sandbox.size}`,
        crmStatus: "not_sent",
        pipelineStage:
          scored.classification === "spam"
            ? "lost"
            : scored.classification === "lead" && scored.tier === "hot"
              ? "qualified"
              : "new",
        name: sample.name,
        email: sample.email,
        source: sample.source ?? "unknown",
        message: sample.message ?? "",
        budget: sample.budget,
        timeline: sample.timeline,
      },
      null,
      [...sandbox.values()]
    );
    sandbox.set(lead.id, lead);
  }
  sandboxSeeded = true;
}

function ensureSandbox() {
  if (sandboxSeeded) return;
  if (!demoAvailable()) {
    sandboxSeeded = true;
    return;
  }
  applyDemoCatalog();
}

/** GoHighLevel is this desk's outbound integration: both fields set means the operator connected it. */
export function isCrmConnected(): boolean {
  return Boolean(getSecret("GHL_API_KEY") && getSecret("GHL_LOCATION_ID"));
}

type View = { mode: DeskMode; store: Map<string, StoredLead>; remote: StoredLead[] | null };

const VIEW_TTL_MS = 5_000;
const viewCache = new Map<string, { mode: DeskMode; at: number }>();

/**
 * Decides which store a request sees. Key safety property: with no orgId in a Supabase-backed
 * (multi-tenant) deployment the caller is a guest, and a guest is only ever given the demo
 * sandbox — never the `real` cache, which holds other tenants' leads.
 */
async function resolveView(orgId?: string): Promise<View> {
  ensureSandbox();
  if (!orgId) {
    if (isSupabaseConfigured()) return { mode: "demo", store: sandbox, remote: null };
    const mode = resolveDeskMode({ connected: isCrmConnected(), realRecords: 0 });
    return { mode, store: mode === "demo" ? sandbox : real, remote: null };
  }

  const cached = viewCache.get(orgId);
  const remote = await supabaseListLeads(orgId);
  if (remote === null) {
    // Supabase did not answer for a signed-in org: fall back to the local desk rather than guess.
    const mode = resolveDeskMode({ connected: isCrmConnected(), realRecords: 0 });
    return { mode, store: mode === "demo" ? sandbox : real, remote: null };
  }
  const owned = remote.filter((l) => !isDemoRecordId(l.id));
  const mode = resolveDeskMode({ connected: isCrmConnected(), realRecords: owned.length });
  viewCache.set(orgId, { mode, at: Date.now() });
  void cached;
  return { mode, store: mode === "demo" ? sandbox : real, remote: owned };
}

async function modeFor(orgId?: string): Promise<DeskMode> {
  if (orgId) {
    const hit = viewCache.get(orgId);
    if (hit && Date.now() - hit.at < VIEW_TTL_MS) return hit.mode;
  }
  return (await resolveView(orgId)).mode;
}

/**
 * orgId is required whenever Supabase is configured and the caller is signed in — it's the real
 * tenant boundary (the server client bypasses RLS via the service-role key, so this explicit
 * filter IS the isolation). Guests (no orgId) only ever see the demo sandbox.
 */
export async function listLeads(orgId?: string): Promise<StoredLead[]> {
  const view = await resolveView(orgId);
  if (view.mode === "live" && view.remote) {
    for (const lead of view.remote) real.set(lead.id, lead);
    return view.remote;
  }
  return [...view.store.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function saveLead(lead: StoredLead, orgId?: string): Promise<StoredLead> {
  const mode = await modeFor(orgId);
  if (mode === "demo" || isDemoRecordId(lead.id)) {
    // Demo records never reach Supabase, whoever is signed in.
    sandbox.set(lead.id, lead);
    return lead;
  }
  real.set(lead.id, lead);
  if (orgId) await supabaseUpsertLead(lead, orgId);
  return lead;
}

export async function getLead(id: string, orgId?: string): Promise<StoredLead | null> {
  const view = await resolveView(orgId);
  if (view.store.has(id)) return view.store.get(id) ?? null;
  if (view.mode === "live") return view.remote?.find((l) => l.id === id) ?? null;
  return null;
}

export async function patchLead(
  id: string,
  patch: Partial<Omit<StoredLead, "id">>,
  orgId?: string
): Promise<StoredLead | null> {
  const current = await getLead(id, orgId);
  if (!current) return null;
  const next = { ...current, ...patch };
  return saveLead(next, orgId);
}

export async function deleteLeads(ids: string[], orgId?: string): Promise<number> {
  const view = await resolveView(orgId);
  let n = 0;
  for (const id of ids) {
    if (view.store.delete(id)) n += 1;
  }
  return n;
}

export async function patchLeads(
  ids: string[],
  patch: Partial<Pick<StoredLead, "crmStatus" | "needsReview" | "pipelineStage" | "reviewedBy" | "reviewedAt">>,
  orgId?: string
): Promise<StoredLead[]> {
  const out: StoredLead[] = [];
  for (const id of ids) {
    const next = await patchLead(id, patch, orgId);
    if (next) out.push(next);
  }
  return out;
}

export type DeskModeStatus = {
  empty: boolean;
  demo: boolean;
  /** True while the desk is showing the demo sandbox (drives the "Demo data" label and Reset). */
  sandbox: boolean;
  mode: DeskMode;
  /** Whether the integration that turns the desk live is connected. */
  connected: boolean;
  store: "supabase" | "memory";
  count: number;
};

export async function deskStatus(orgId?: string): Promise<DeskModeStatus> {
  const view = await resolveView(orgId);
  const leads = await listLeads(orgId);
  return {
    empty: leads.length === 0,
    demo: view.mode === "demo",
    sandbox: view.mode === "demo",
    mode: view.mode,
    connected: isCrmConnected(),
    store: process.env.NEXT_PUBLIC_SUPABASE_URL ? "supabase" : "memory",
    count: leads.length,
  };
}

export async function deskModeFor(orgId?: string): Promise<DeskMode> {
  return modeFor(orgId);
}

export async function loadDemoCatalog(orgId?: string): Promise<DeskModeStatus> {
  applyDemoCatalog();
  return deskStatus(orgId);
}

export async function clearDesk(orgId?: string): Promise<DeskModeStatus> {
  const view = await resolveView(orgId);
  view.store.clear();
  if (view.store === sandbox) sandboxSeeded = true;
  return deskStatus(orgId);
}
