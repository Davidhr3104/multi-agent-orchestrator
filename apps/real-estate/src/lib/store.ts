import { demoAvailable, type DeskMode } from "@helix/core";
import { scoreBuyer } from "./scoring";
import { DEMO_ZONES, LEAD_SEEDS, PROPERTY_SEEDS, SELLER_SEEDS, buildSeedShowings } from "./seed";
import type { ActivityEntry, ApprovedListingCopy, BuyerScore, Lead, LeadStage, MarketZone, OutreachDraft, Property, Seller, SellerStage, Showing } from "./types";

/**
 * In-memory desk: nothing here is persisted. It starts on the demo sandbox; importing the agent's own listings or
 * buyers wipes every sample record first and switches the desk to live, so demo and real data never mix. When a
 * deployment sets HELIX_DESK_SEED=off the desk starts empty (an honest live desk) instead of showing samples.
 */
type Desk = {
  properties: Map<string, Property>;
  leads: Map<string, Lead>;
  drafts: Map<string, OutreachDraft>;
  showings: Map<string, Showing>;
  sellers: Map<string, Seller>;
  activity: ActivityEntry[];
  zones: MarketZone[];
  listingCopies: Map<string, ApprovedListingCopy>;
  /** Property id -> fingerprint of the fields matching depends on, as of the last nightly run. */
  matchFingerprints: Map<string, string>;
  seeded: boolean;
  /** The sample agency is loaded. */
  demoLoaded: boolean;
  /** The agent imported their own data; demo can't come back over it. */
  live: boolean;
};

const ACTIVITY_CAP = 500;

function desk(): Desk {
  const g = globalThis as typeof globalThis & { __helixRealEstate?: Desk };
  g.__helixRealEstate ??= { properties: new Map(), leads: new Map(), drafts: new Map(), showings: new Map(), sellers: new Map(), activity: [], zones: [], listingCopies: new Map(), matchFingerprints: new Map(), seeded: false, demoLoaded: false, live: false };
  const d = g.__helixRealEstate;
  d.drafts ??= new Map();
  d.showings ??= new Map();
  d.sellers ??= new Map();
  d.activity ??= [];
  d.zones ??= [];
  d.listingCopies ??= new Map();
  d.matchFingerprints ??= new Map();
  d.demoLoaded ??= false;
  d.live ??= false;
  return d;
}

const cloneSeller = (s: Seller): Seller => ({ ...s });

function applyDemo() {
  const d = desk();
  d.properties = new Map(PROPERTY_SEEDS.map((p) => [p.id, { ...p, amenities: [...p.amenities] }]));
  d.leads = new Map(LEAD_SEEDS.map((l) => [l.id, { ...l, zones: [...l.zones], notes: [...l.notes] }]));
  d.drafts = new Map();
  d.showings = new Map(buildSeedShowings(Date.now()).map((s) => [s.id, s]));
  d.sellers = new Map(SELLER_SEEDS.map((s) => [s.id, cloneSeller(s)]));
  d.activity = [];
  d.zones = DEMO_ZONES.map((z) => ({ ...z }));
  d.listingCopies = new Map();
  d.matchFingerprints = new Map();
  d.seeded = true;
  d.demoLoaded = true;
  d.live = false;
}

function ensure() {
  const d = desk();
  if (d.seeded) return d;
  if (demoAvailable()) applyDemo();
  else d.seeded = true;
  return d;
}

export type ScoredLead = Lead & { buyer: BuyerScore };

export function currentDeskMode(): DeskMode {
  if (ensure().live) return "live";
  return demoAvailable() ? "demo" : "live";
}

export type ImportOutcome = { added: number; updated: number; clearedDemo: boolean };

/**
 * Adds the agent's own listings and/or buyers. The first import removes every sample record (listings, buyers,
 * drafts, showings, sellers, zones, activity) so real and demo data are never on the desk together.
 */
export async function importRecords(input: { properties?: Property[]; leads?: Lead[] }): Promise<ImportOutcome> {
  const d = ensure();
  const clearedDemo = d.demoLoaded;
  if (clearedDemo) {
    d.properties = new Map();
    d.leads = new Map();
    d.drafts = new Map();
    d.showings = new Map();
    d.sellers = new Map();
    d.activity = [];
    d.zones = [];
    d.listingCopies = new Map();
    d.matchFingerprints = new Map();
    d.demoLoaded = false;
  }
  d.live = true;
  let added = 0;
  let updated = 0;
  for (const p of input.properties ?? []) {
    if (d.properties.has(p.id)) updated++;
    else added++;
    d.properties.set(p.id, { ...p, amenities: [...p.amenities] });
  }
  for (const l of input.leads ?? []) {
    const prev = d.leads.get(l.id);
    if (prev) updated++;
    else added++;
    d.leads.set(l.id, { ...l, zones: [...l.zones], notes: prev ? [...prev.notes] : [...l.notes], createdAt: prev?.createdAt ?? l.createdAt, crm: prev?.crm });
  }
  return { added, updated, clearedDemo };
}

export async function putLead(l: Lead): Promise<void> {
  ensure().leads.set(l.id, { ...l, zones: [...l.zones], notes: [...l.notes] });
}

export async function getListingCopy(propertyId: string): Promise<ApprovedListingCopy | null> {
  const c = ensure().listingCopies.get(propertyId);
  return c ? { ...c } : null;
}

export async function putListingCopy(c: ApprovedListingCopy): Promise<void> {
  ensure().listingCopies.set(c.propertyId, { ...c });
}

export async function getMatchFingerprints(): Promise<Map<string, string>> {
  return new Map(ensure().matchFingerprints);
}

export async function setMatchFingerprint(propertyId: string, fingerprint: string): Promise<void> {
  ensure().matchFingerprints.set(propertyId, fingerprint);
}

export async function listProperties(): Promise<Property[]> {
  return [...ensure().properties.values()].sort((a, b) => b.price - a.price);
}

export async function getProperty(id: string): Promise<Property | null> {
  return ensure().properties.get(id) ?? null;
}

export async function putProperty(p: Property): Promise<void> {
  ensure().properties.set(p.id, { ...p, amenities: [...p.amenities] });
}

export async function deleteProperty(id: string): Promise<void> {
  ensure().properties.delete(id);
}

export async function listLeads(): Promise<ScoredLead[]> {
  return [...ensure().leads.values()]
    .map((l) => ({ ...l, buyer: scoreBuyer(l) }))
    .sort((a, b) => b.buyer.score - a.buyer.score);
}

export async function getLead(id: string): Promise<ScoredLead | null> {
  const l = ensure().leads.get(id);
  return l ? { ...l, buyer: scoreBuyer(l) } : null;
}

export async function setLeadStage(id: string, stage: LeadStage): Promise<boolean> {
  const l = ensure().leads.get(id);
  if (!l) return false;
  l.stage = stage;
  return true;
}

/** undefined clears the field (used by Undo when the lead had never been contacted). */
export async function setLeadLastContact(id: string, at: string | undefined): Promise<boolean> {
  const l = ensure().leads.get(id);
  if (!l) return false;
  l.lastContactAt = at;
  return true;
}

const cloneShowing = (s: Showing): Showing => ({
  ...s,
  checklist: s.checklist.map((c) => ({ ...c })),
  feedback: s.feedback ? { ...s.feedback, objections: [...s.feedback.objections] } : undefined,
});

/** Earliest first. */
export async function listShowings(): Promise<Showing[]> {
  return [...ensure().showings.values()].map(cloneShowing).sort((a, b) => a.startsAt.localeCompare(b.startsAt));
}

export async function getShowing(id: string): Promise<Showing | null> {
  const s = ensure().showings.get(id);
  return s ? cloneShowing(s) : null;
}

export async function putShowing(s: Showing): Promise<void> {
  ensure().showings.set(s.id, cloneShowing(s));
}

export async function deleteShowing(id: string): Promise<void> {
  ensure().showings.delete(id);
}

/** Sellers, newest first. */
export async function listSellers(): Promise<Seller[]> {
  return [...ensure().sellers.values()].map(cloneSeller).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function getSeller(id: string): Promise<Seller | null> {
  const s = ensure().sellers.get(id);
  return s ? cloneSeller(s) : null;
}

export async function putSeller(s: Seller): Promise<void> {
  ensure().sellers.set(s.id, cloneSeller(s));
}

export async function deleteSeller(id: string): Promise<void> {
  ensure().sellers.delete(id);
}

export async function setSellerStage(id: string, stage: SellerStage): Promise<boolean> {
  const s = ensure().sellers.get(id);
  if (!s) return false;
  s.stage = stage;
  return true;
}

/** The first zone is the agent's home zone. */
export async function getZone(): Promise<MarketZone | null> {
  return ensure().zones[0] ?? null;
}

export async function listZones(): Promise<MarketZone[]> {
  return ensure().zones.map((z) => ({ ...z }));
}

const cloneDraft = (x: OutreachDraft): OutreachDraft => ({ ...x, propertyIds: [...x.propertyIds], why: [...x.why], deliveries: x.deliveries?.map((v) => ({ ...v })) });

/** Newest batch first; within a batch, the order it was drafted in (best fit first). */
export async function listDrafts(): Promise<OutreachDraft[]> {
  return [...ensure().drafts.values()].map(cloneDraft).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function getDraft(id: string): Promise<OutreachDraft | null> {
  const x = ensure().drafts.get(id);
  return x ? cloneDraft(x) : null;
}

export async function putDraft(x: OutreachDraft): Promise<void> {
  ensure().drafts.set(x.id, cloneDraft(x));
}

export async function deleteDraft(id: string): Promise<void> {
  ensure().drafts.delete(id);
}

let activitySeq = 0;

export async function logActivity(e: Omit<ActivityEntry, "id" | "at">): Promise<void> {
  const d = ensure();
  d.activity.unshift({ ...e, labels: e.labels.slice(0, 10), id: `act-${Date.now().toString(36)}-${(activitySeq++).toString(36)}`, at: new Date().toISOString() });
  if (d.activity.length > ACTIVITY_CAP) d.activity.length = ACTIVITY_CAP;
}

/** Newest first. */
export async function listActivity(): Promise<ActivityEntry[]> {
  return ensure().activity.map((a) => ({ ...a, labels: [...a.labels] }));
}

export type DeskModeStatus = { empty: boolean; demo: boolean; mode: DeskMode; connected: boolean; imported: boolean; store: "memory"; count: number };

export async function deskStatus(): Promise<DeskModeStatus> {
  const d = ensure();
  const mode = currentDeskMode();
  return { empty: d.properties.size === 0 && d.leads.size === 0, demo: mode === "demo", mode, connected: false, imported: d.live, store: "memory", count: d.properties.size + d.leads.size };
}

/** Puts the sample agency back. This replaces everything on the desk, including imported data. */
export async function loadDemoCatalog(): Promise<DeskModeStatus> {
  if (!demoAvailable()) throw new Error("Demo data is disabled on this deployment.");
  applyDemo();
  return deskStatus();
}
