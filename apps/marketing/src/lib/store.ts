import { mkdirSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import path from "node:path";
import {
  autoSeedEnabled,
  buildMarketingSeed,
  dailySpendSeries,
  inWindow,
  parseMarketingWindow,
  runCampaignPipeline,
  splitJoinedAndUnmatched,
  summarizeDeskWaste,
  utcDay,
  windowBounds,
  type AttributedLead,
  type CampaignAction,
  type CampaignRemap,
  type DeskWasteSummary,
  type HitlDecision,
  type MarketingWindow,
  type SpendEvent,
  type SpendRowInput,
  type StoredCampaign,
} from "@helix/core";
import {
  isSupabaseConfigured,
  supabaseBootstrap,
  supabaseLoadDesk,
  supabaseSaveDecision,
  supabaseSaveLeads,
  supabaseSaveSpend,
} from "@/lib/supabase-desk";

type DeskState = {
  spend: SpendEvent[];
  leads: AttributedLead[];
  decisions: Map<string, HitlDecision>;
  remaps: CampaignRemap[];
  ready: boolean;
  remoteBootstrapped: boolean;
};

type FileShape = {
  spend: SpendEvent[];
  leads: AttributedLead[];
  decisions: HitlDecision[];
  remaps?: CampaignRemap[];
};

function getDesk(): DeskState {
  const g = globalThis as { __helixMarketing?: DeskState };
  if (!g.__helixMarketing) {
    g.__helixMarketing = {
      spend: [],
      leads: [],
      decisions: new Map(),
      remaps: [],
      ready: false,
      remoteBootstrapped: false,
    };
  }
  if (!g.__helixMarketing.remaps) g.__helixMarketing.remaps = [];
  return g.__helixMarketing;
}

function dataPath(): string {
  if (process.env.VERCEL) return "/tmp/helix-marketing-desk.json";
  const cwd = process.cwd();
  if (cwd.replace(/\\/g, "/").endsWith("/marketing")) {
    return path.join(cwd, ".data", "desk.json");
  }
  return path.join(cwd, "apps", "marketing", ".data", "desk.json");
}

function loadFile(): FileShape | null {
  try {
    const raw = readFileSync(dataPath(), "utf8");
    const parsed = JSON.parse(raw) as FileShape;
    if (!Array.isArray(parsed.spend) || !Array.isArray(parsed.leads)) return null;
    return parsed;
  } catch {
    return null;
  }
}

function saveFile(desk: DeskState) {
  try {
    const file = dataPath();
    mkdirSync(path.dirname(file), { recursive: true });
    const payload: FileShape = {
      spend: desk.spend,
      leads: desk.leads,
      decisions: [...desk.decisions.values()],
      remaps: desk.remaps,
    };
    writeFileSync(file, JSON.stringify(payload));
  } catch (err) {
    console.warn("[helix-marketing] file persist skipped:", err instanceof Error ? err.message : err);
  }
}

function seedDesk(desk: DeskState) {
  const seeded = buildMarketingSeed();
  desk.spend = seeded.spend;
  desk.leads = seeded.leads;
}

async function hydrate(): Promise<DeskState> {
  const desk = getDesk();
  if (!desk.ready) {
    const file = loadFile();
    if (file && (file.spend.length > 0 || file.leads.length > 0)) {
      desk.spend = file.spend;
      desk.leads = file.leads;
      desk.decisions = new Map(file.decisions.map((d) => [d.campaignId, d]));
      desk.remaps = file.remaps ?? [];
    } else if (autoSeedEnabled()) {
      seedDesk(desk);
      saveFile(desk);
    }
    desk.ready = true;
  }
  if (!desk.remoteBootstrapped && isSupabaseConfigured()) {
    desk.remoteBootstrapped = true;
    const remote = await supabaseLoadDesk();
    if (remote && remote.spend.length > 0) {
      desk.spend = remote.spend;
      desk.leads = remote.leads;
      desk.decisions = new Map(remote.decisions.map((d) => [d.campaignId, d]));
      saveFile(desk);
    } else if (desk.spend.length > 0) {
      await supabaseBootstrap({
        spend: desk.spend,
        leads: desk.leads,
        decisions: [...desk.decisions.values()],
      });
    }
  }
  return desk;
}

function applyDecision(campaign: StoredCampaign, decision?: HitlDecision): StoredCampaign {
  if (!decision) return campaign;
  return {
    ...campaign,
    action: decision.action,
    status:
      decision.action === "pause" ? "paused" : decision.action === "scale" ? "scale_recommended" : "active",
    needsReview: false,
    hitlNote: decision.note,
  };
}

export type DeskSnapshot = {
  window: MarketingWindow;
  from: string;
  to: string;
  store: "supabase" | "file" | "memory";
  campaigns: StoredCampaign[];
  leads: AttributedLead[];
  unmatched: SpendEvent[];
  series: { day: string; spend: number }[];
  waste: DeskWasteSummary;
};

export function storeKind(): DeskSnapshot["store"] {
  if (isSupabaseConfigured()) return "supabase";
  try {
    readFileSync(dataPath());
    return "file";
  } catch {
    return "memory";
  }
}

function applyRemaps(leads: AttributedLead[], remaps: CampaignRemap[] | undefined): AttributedLead[] {
  if (!remaps?.length) return leads;
  const extra: AttributedLead[] = [];
  for (const remap of remaps) {
    for (const lead of leads) {
      if (lead.campaignId === remap.leadCampaignId) {
        extra.push({ ...lead, id: `${lead.id}::${remap.spendCampaignId}`, campaignId: remap.spendCampaignId });
      }
    }
  }
  return extra.length ? [...leads, ...extra] : leads;
}

function snapshotFrom(desk: DeskState, window: MarketingWindow): DeskSnapshot {
  const { from, to } = windowBounds(window);
  const joinLeads = applyRemaps(desk.leads, desk.remaps);
  const { joined, unmatched } = splitJoinedAndUnmatched(desk.spend, joinLeads, from, to);
  const windowLeads = joinLeads.filter((l) => inWindow(l.createdAt, from, to));
  const campaigns = joined
    .map((spend) => {
      const scored = runCampaignPipeline(spend, windowLeads);
      scored.id = `camp-${spend.campaignId}`;
      return applyDecision(scored, desk.decisions.get(spend.campaignId));
    })
    .sort((a, b) => a.name.localeCompare(b.name));
  return {
    window,
    from,
    to,
    store: storeKind(),
    campaigns,
    leads: windowLeads,
    unmatched,
    series: dailySpendSeries(desk.spend, from, to),
    waste: summarizeDeskWaste(campaigns),
  };
}

export async function getSnapshot(window: MarketingWindow | string | null = "7d"): Promise<DeskSnapshot> {
  const desk = await hydrate();
  return snapshotFrom(desk, parseMarketingWindow(window));
}

export async function ingestSpend(rows: SpendRowInput[]): Promise<DeskSnapshot> {
  const desk = await hydrate();
  const today = utcDay();
  const events: SpendEvent[] = rows.map((row, i) => ({
    ...row,
    id: `ing-${row.campaignId}-${row.occurredAt ?? today}-${i}-${Date.now().toString(36)}`,
    occurredAt: row.occurredAt ?? today,
  }));
  desk.spend.push(...events);
  saveFile(desk);
  await supabaseSaveSpend(events);
  return snapshotFrom(desk, "7d");
}

export async function reviewCampaign(
  id: string,
  action: CampaignAction,
  note?: string,
  actor?: string
): Promise<StoredCampaign | null> {
  const desk = await hydrate();
  const campaignId = id.startsWith("camp-") ? id.slice(5) : id;
  const decision: HitlDecision = {
    campaignId,
    action,
    note: note?.trim() || undefined,
    at: new Date().toISOString(),
    actor,
  };
  desk.decisions.set(campaignId, decision);
  saveFile(desk);
  await supabaseSaveDecision(decision);
  const snap = snapshotFrom(desk, "90d");
  return snap.campaigns.find((c) => c.campaignId === campaignId || c.id === id) ?? null;
}

export type DeskModeStatus = {
  empty: boolean;
  demo: boolean;
  store: DeskSnapshot["store"];
  count: number;
};

export async function deskStatus(): Promise<DeskModeStatus> {
  const desk = await hydrate();
  return {
    empty: desk.spend.length === 0 && desk.leads.length === 0,
    demo: desk.spend.some((s) => s.campaignId.startsWith("ad-a-volume") || s.campaignId.startsWith("ad-b-quality")),
    store: storeKind(),
    count: desk.spend.length + desk.leads.length,
  };
}

export async function loadDemoCatalog(): Promise<DeskModeStatus> {
  const desk = await hydrate();
  seedDesk(desk);
  desk.decisions = new Map();
  saveFile(desk);
  return deskStatus();
}

export async function clearDesk(): Promise<DeskModeStatus> {
  const g = globalThis as { __helixMarketing?: DeskState };
  g.__helixMarketing = {
    spend: [],
    leads: [],
    decisions: new Map(),
    remaps: [],
    ready: true,
    remoteBootstrapped: true,
  };
  try {
    unlinkSync(dataPath());
  } catch {
    /* missing file is fine */
  }
  return deskStatus();
}

export function attributedFromStored(row: {
  id: string;
  campaignId?: string;
  name: string;
  email: string;
  classification: AttributedLead["classification"];
  score: number;
  tier: AttributedLead["tier"];
  confidence: number;
  createdAt: string;
}): AttributedLead | null {
  const campaignId = row.campaignId?.trim();
  if (!campaignId) return null;
  return {
    id: row.id,
    campaignId,
    name: row.name,
    email: row.email,
    classification: row.classification,
    score: row.score,
    tier: row.tier,
    confidence: row.confidence,
    createdAt: row.createdAt,
  };
}

export async function upsertAttributedLeads(incoming: AttributedLead[]): Promise<DeskSnapshot> {
  const desk = await hydrate();
  const byId = new Map(desk.leads.map((l) => [l.id, l]));
  for (const lead of incoming) byId.set(lead.id, lead);
  desk.leads = [...byId.values()];
  saveFile(desk);
  await supabaseSaveLeads(incoming);
  return snapshotFrom(desk, "90d");
}

export async function remapCampaign(spendCampaignId: string, leadCampaignId: string): Promise<DeskSnapshot> {
  const desk = await hydrate();
  const spendId = spendCampaignId.trim();
  const leadId = leadCampaignId.trim();
  if (!spendId || !leadId) return snapshotFrom(desk, "90d");
  desk.remaps = [...desk.remaps.filter((r) => r.spendCampaignId !== spendId), { spendCampaignId: spendId, leadCampaignId: leadId }];
  saveFile(desk);
  return snapshotFrom(desk, "90d");
}

export async function listRemaps(): Promise<CampaignRemap[]> {
  const desk = await hydrate();
  return [...desk.remaps];
}

export { parseMarketingWindow };
