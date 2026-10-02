import type { DeskActionRegistry } from "@helix/core";
import { DRAFT_TONES, buyersToAlert, isCold, isTone, matchAlertDraft, reactivationDraft } from "@/lib/outreach";
import { DEFAULT_DURATION, MIN, checklistFresh, conflictsWith } from "@/lib/showings";
import {
  deleteDraft,
  deleteShowing,
  getDraft,
  getLead,
  getProperty,
  getShowing,
  listDrafts,
  listLeads,
  listProperties,
  listShowings,
  putDraft,
  putShowing,
  setLeadLastContact,
  setLeadStage,
  deleteProperty,
  deleteSeller,
  getSeller,
  putProperty,
  putSeller,
  setSellerStage,
} from "@/lib/store";
import {
  INTEREST_LEVELS,
  LEAD_STAGES,
  SELLER_STAGES,
  type DraftKind,
  type DraftStatus,
  type Interest,
  type LeadStage,
  type OutreachDraft,
  type PropertyKind,
  type SellerStage,
  type Showing,
} from "@/lib/types";

const PROPERTY_KINDS: PropertyKind[] = ["apartment", "house", "penthouse", "townhouse", "loft"];
const SELLER_ID = /^seller-[a-z0-9-]{4,48}$/;
const positive = (v: unknown) => typeof v === "number" && Number.isFinite(v) && v > 0;

let showSeq = 0;
const newShowingId = () => `show-${Date.now().toString(36)}-${(showSeq++).toString(36)}`;

/**
 * What Helix AI may do on the Real Estate desk, and when it may do it alone.
 *   move_stage          move buyers along the pipeline                              -> auto (+Undo); closing/archiving asks
 *   schedule_showing / reschedule_showing / cancel_showing / record_feedback / toggle_checklist
 *                       the agent's own calendar; no sync, no invites               -> auto (+Undo), bulk asks
 *   draft_match_alerts  write "new listing" drafts for the buyers a property fits   -> auto (+Undo), bulk asks
 *   draft_reactivation  write a check-in draft for a buyer who went cold            -> auto (+Undo), bulk asks
 *   dismiss_draft       drop a draft                                                -> auto (+Undo)
 *   approve_draft       mark a draft ready to send                                  -> always asks a person
 *   add_seller / move_seller_stage / create_listing_from_seller
 *                       the listing side; a new listing is always a draft           -> auto (+Undo); "lost" asks
 * Drafting only writes inside the desk. No email or WhatsApp is connected, so nothing is ever sent from here.
 */

export type RealEstateCtx = { actor: string };

const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? "" : "s"}`;
const names = (l: string[]) => l.join(", ");
const KINDS: DraftKind[] = ["new_match", "reactivation"];
const STATUSES: DraftStatus[] = ["pending", "approved", "dismissed"];
const strings = (v: unknown) => Array.isArray(v) && v.every((x) => typeof x === "string");

function isDraft(d: unknown): d is OutreachDraft {
  const o = d as Record<string, unknown> | null;
  return (
    !!o &&
    typeof o.id === "string" &&
    KINDS.includes(o.kind as DraftKind) &&
    STATUSES.includes(o.status as DraftStatus) &&
    typeof o.leadId === "string" &&
    typeof o.subject === "string" &&
    typeof o.body === "string" &&
    typeof o.createdAt === "string" &&
    strings(o.propertyIds) &&
    strings(o.why)
  );
}

const bulk = (ids: string[], noun: string) => (ids.length > 5 ? { level: "confirm" as const, reasons: [`Bulk change (${ids.length} ${noun})`] } : { level: "auto" as const, reasons: [] });

/** Undo for "draft for X": remember which drafts of that kind already pointed at X, delete any created after. */
type DraftSetSnapshot = { ids: string[] };
const isSet = (d: unknown): d is DraftSetSnapshot => strings((d as DraftSetSnapshot | null)?.ids);

async function draftIdsFor(kind: DraftKind, key: (x: OutreachDraft) => string, id: string) {
  return (await listDrafts()).filter((x) => x.kind === kind && key(x) === id).map((x) => x.id);
}

async function restoreSet(kind: DraftKind, key: (x: OutreachDraft) => string, id: string, data: unknown) {
  if (!isSet(data)) throw new Error("Invalid undo data");
  const keep = new Set(data.ids);
  for (const did of await draftIdsFor(kind, key, id)) if (!keep.has(did)) await deleteDraft(did);
  return true;
}

const byProperty = (x: OutreachDraft) => x.propertyIds[0] ?? "";
const byLead = (x: OutreachDraft) => x.leadId;

async function draftSnapshot(id: string) {
  const draft = await getDraft(id);
  return draft ? { draft } : null;
}

async function restoreDraft(id: string, data: unknown) {
  const d = (data as { draft?: unknown } | null)?.draft;
  if (!isDraft(d)) throw new Error("Invalid undo data");
  if (d.id !== id) throw new Error("Undo data does not match this draft");
  if (!(await getDraft(id))) return false;
  await putDraft(d);
  return true;
}

function decide(status: Exclude<DraftStatus, "pending">) {
  return async (id: string, _p: Record<string, unknown>, ctx: RealEstateCtx) => {
    const d = await getDraft(id);
    if (!d) return false;
    if (d.status !== "pending") throw new Error(`This draft is already ${d.status}.`);
    await putDraft({ ...d, status, decidedBy: ctx.actor, decidedAt: new Date().toISOString() });
    return true;
  };
}

const isStage = (v: unknown): v is LeadStage => LEAD_STAGES.includes(v as LeadStage);

const NOT_SYNCED = "Not synced to any calendar and no invite was sent.";

function isShowing(d: unknown): d is Showing {
  const o = d as Record<string, unknown> | null;
  return (
    !!o &&
    typeof o.id === "string" &&
    typeof o.leadId === "string" &&
    typeof o.propertyId === "string" &&
    typeof o.startsAt === "string" &&
    !Number.isNaN(Date.parse(o.startsAt)) &&
    typeof o.durationMin === "number" &&
    ["scheduled", "done", "cancelled", "no_show"].includes(o.status as string) &&
    Array.isArray(o.checklist) &&
    o.checklist.every((c) => typeof (c as { label?: unknown }).label === "string" && typeof (c as { done?: unknown }).done === "boolean")
  );
}

async function showingSnapshot(id: string) {
  const showing = await getShowing(id);
  return showing ? { showing } : null;
}

async function restoreShowing(id: string, data: unknown) {
  const s = (data as { showing?: unknown } | null)?.showing;
  if (!isShowing(s) || s.id !== id) throw new Error("Invalid undo data");
  await putShowing(s);
  return true;
}

async function scheduled(id: string): Promise<Showing> {
  const s = await getShowing(id);
  if (!s) throw new Error("Showing not found.");
  if (s.status !== "scheduled") throw new Error(`This showing is already ${s.status.replace("_", "-")}.`);
  return s;
}

async function assertFree(startsAt: string, durationMin: number, excludeId?: string) {
  const clash = conflictsWith(await listShowings(), startsAt, durationMin, excludeId)[0];
  if (!clash) return;
  const [lead, prop] = await Promise.all([getLead(clash.leadId), getProperty(clash.propertyId)]);
  const time = new Date(clash.startsAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  throw new Error(`Overlaps with ${lead?.name ?? "another buyer"} at ${prop?.title ?? "another listing"} (${time}).`);
}

const validWhen = (v: unknown) => (typeof v === "string" && !Number.isNaN(Date.parse(v)) ? null : "startsAt must be an ISO 8601 date-time");

export const realEstateActions: DeskActionRegistry<RealEstateCtx> = {
  schedule_showing: {
    name: "schedule_showing",
    validate: (p) => {
      if (typeof p.propertyId !== "string" || !p.propertyId) return "propertyId is required";
      if (p.durationMin !== undefined && (typeof p.durationMin !== "number" || p.durationMin < 15 || p.durationMin > 240)) return "durationMin must be 15–240";
      return validWhen(p.startsAt);
    },
    assess: async (ids) => (ids.length > 3 ? { level: "confirm", reasons: [`Booking ${ids.length} showings at once`] } : { level: "auto", reasons: [] }),
    snapshot: async (id) => ((await getLead(id)) ? { ids: (await listShowings()).filter((s) => s.leadId === id).map((s) => s.id) } : null),
    apply: async (id, p, ctx) => {
      const lead = await getLead(id);
      if (!lead) return false;
      if (lead.stage === "closed" || lead.stage === "archived") throw new Error(`${lead.name} is ${lead.stage}.`);
      const prop = await getProperty(p.propertyId as string);
      if (!prop) throw new Error("Listing not found.");
      if (prop.status !== "active") throw new Error(`${prop.title} is ${prop.status}; only active listings can be shown.`);
      const startsAt = new Date(p.startsAt as string).toISOString();
      if (Date.parse(startsAt) < Date.now() - 5 * MIN) throw new Error("That time has already passed.");
      const durationMin = (p.durationMin as number | undefined) ?? DEFAULT_DURATION;
      await assertFree(startsAt, durationMin);
      await putShowing({ id: newShowingId(), leadId: id, propertyId: prop.id, startsAt, durationMin, status: "scheduled", checklist: checklistFresh(), createdBy: ctx.actor, createdAt: new Date().toISOString() });
      return true;
    },
    restore: async (id, data) => {
      if (!isSet(data)) throw new Error("Invalid undo data");
      const keep = new Set(data.ids);
      for (const s of await listShowings()) if (s.leadId === id && !keep.has(s.id)) await deleteShowing(s.id);
      return true;
    },
    resultText: (done, failed) => `Scheduled ${plural(done.length, "showing")}. ${NOT_SYNCED}${failed ? ` ${failed} couldn't be booked.` : ""}`,
    announce: (l) => `Scheduled a showing for ${names(l)}`,
  },

  reschedule_showing: {
    name: "reschedule_showing",
    validate: (p) => validWhen(p.startsAt),
    assess: async (ids) => bulk(ids, "showings"),
    snapshot: showingSnapshot,
    apply: async (id, p) => {
      const s = await scheduled(id);
      const startsAt = new Date(p.startsAt as string).toISOString();
      if (Date.parse(startsAt) < Date.now() - 5 * MIN) throw new Error("That time has already passed.");
      await assertFree(startsAt, s.durationMin, id);
      await putShowing({ ...s, startsAt });
      return true;
    },
    restore: restoreShowing,
    resultText: (done, failed) => `Moved ${plural(done.length, "showing")}. ${NOT_SYNCED} Let the buyer know yourself.${failed ? ` ${failed} failed.` : ""}`,
    announce: (l) => `Rescheduled ${names(l)}`,
  },

  cancel_showing: {
    name: "cancel_showing",
    assess: async (ids) => bulk(ids, "showings"),
    snapshot: showingSnapshot,
    apply: async (id) => {
      const s = await scheduled(id);
      await putShowing({ ...s, status: "cancelled" });
      return true;
    },
    restore: restoreShowing,
    resultText: (done, failed) => `Cancelled ${plural(done.length, "showing")}. Nobody was notified — tell the buyer yourself.${failed ? ` ${failed} failed.` : ""}`,
    announce: (l) => `Cancelled ${names(l)}`,
  },

  record_feedback: {
    name: "record_feedback",
    validate: (p) => {
      if (p.noShow === true) return null;
      if (!INTEREST_LEVELS.includes(p.interest as Interest)) return `interest must be one of: ${INTEREST_LEVELS.join(", ")}`;
      if (p.objections !== undefined && !strings(p.objections)) return "objections must be a list of strings";
      if (p.notes !== undefined && typeof p.notes !== "string") return "notes must be text";
      return null;
    },
    assess: async (ids) => bulk(ids, "showings"),
    snapshot: async (id) => {
      const showing = await getShowing(id);
      if (!showing) return null;
      return { showing, lastContactAt: (await getLead(showing.leadId))?.lastContactAt ?? null };
    },
    apply: async (id, p, ctx) => {
      const s = await scheduled(id);
      if (Date.parse(s.startsAt) > Date.now()) throw new Error("This showing hasn't started yet.");
      const now = new Date().toISOString();
      if (p.noShow === true) {
        await putShowing({ ...s, status: "no_show" });
        return true;
      }
      const objections = ((p.objections as string[] | undefined) ?? []).map((o) => o.trim().slice(0, 40)).filter(Boolean).slice(0, 8);
      const notes = String(p.notes ?? "").trim().slice(0, 1000);
      await putShowing({ ...s, status: "done", feedback: { interest: p.interest as Interest, objections, notes, recordedBy: ctx.actor, recordedAt: now } });
      await setLeadLastContact(s.leadId, s.startsAt);
      return true;
    },
    restore: async (id, data) => {
      const d = data as { showing?: unknown; lastContactAt?: unknown } | null;
      const s = d?.showing;
      const last = d?.lastContactAt;
      if (!isShowing(s) || s.id !== id) throw new Error("Invalid undo data");
      if (last !== null && typeof last !== "string") throw new Error("Invalid undo data");
      await putShowing(s);
      await setLeadLastContact(s.leadId, last ?? undefined);
      return true;
    },
    resultText: (done, failed, p) => (p.noShow === true ? `Marked ${plural(done.length, "showing")} as no-show.` : `Saved feedback for ${plural(done.length, "showing")}.`) + (failed ? ` ${failed} failed.` : ""),
    announce: (l) => `Recorded how ${names(l)} went`,
  },

  toggle_checklist: {
    name: "toggle_checklist",
    validate: (p) => (Number.isInteger(p.index) && (p.index as number) >= 0 ? null : "index must be a checklist position"),
    assess: async () => ({ level: "auto", reasons: [] }),
    snapshot: showingSnapshot,
    apply: async (id, p) => {
      const s = await scheduled(id);
      const i = p.index as number;
      if (!s.checklist[i]) throw new Error("No such checklist item.");
      s.checklist[i] = { ...s.checklist[i], done: !s.checklist[i].done };
      await putShowing(s);
      return true;
    },
    restore: restoreShowing,
    resultText: () => "Checklist updated.",
    announce: (l) => `Updated the checklist for ${names(l)}`,
  },

  move_stage: {
    name: "move_stage",
    validate: (p) => (isStage(p.stage) ? null : `stage must be one of: ${LEAD_STAGES.join(", ")}`),
    assess: async (ids, p) => {
      if (p.stage === "closed" || p.stage === "archived") {
        return { level: "confirm", reasons: [`Marking a buyer ${p.stage} takes them out of matches and outreach`] };
      }
      return bulk(ids, "buyers");
    },
    snapshot: async (id) => {
      const l = await getLead(id);
      return l ? { stage: l.stage } : null;
    },
    apply: async (id, p) => setLeadStage(id, p.stage as LeadStage),
    restore: async (id, data) => {
      const stage = (data as { stage?: unknown } | null)?.stage;
      if (!isStage(stage)) throw new Error("Invalid undo data");
      return setLeadStage(id, stage);
    },
    resultText: (done, failed, p) => `Moved ${plural(done.length, "buyer")} to ${String(p.stage)}.${failed ? ` ${failed} failed.` : ""}`,
    announce: (l, p) => `Moved ${names(l)} to ${String(p.stage)}`,
  },

  draft_match_alerts: {
    name: "draft_match_alerts",
    validate: (p) => (p.tone === undefined || isTone(p.tone) ? null : `tone must be one of: ${DRAFT_TONES.join(", ")}`),
    assess: async (ids) => bulk(ids, "listings"),
    snapshot: async (id) => ((await getProperty(id)) ? { ids: await draftIdsFor("new_match", byProperty, id) } : null),
    apply: async (id, params) => {
      const p = await getProperty(id);
      if (!p) return false;
      const already = new Set((await listDrafts()).filter((x) => x.kind === "new_match" && byProperty(x) === id).map((x) => x.leadId));
      const fresh = buyersToAlert(p, await listLeads()).filter((b) => !already.has(b.lead.id));
      if (fresh.length === 0) throw new Error(already.size ? "Every matching buyer already has a draft for this listing." : "No open buyer is a strong fit for this listing yet.");
      const now = Date.now();
      const tone = isTone(params.tone) ? params.tone : "friendly";
      for (const b of fresh) await putDraft(matchAlertDraft(p, b.lead, b.reasons, now, tone));
      return true;
    },
    restore: (id, data) => restoreSet("new_match", byProperty, id, data),
    resultText: (done, failed) =>
      `Drafted new-listing alerts for ${plural(done.length, "listing")}. They're waiting in Outreach for your approval — nothing was sent.${failed ? ` ${failed} had no new buyer to alert.` : ""}`,
    announce: (l) => `Helix AI drafted buyer alerts for ${names(l)}`,
  },

  draft_reactivation: {
    name: "draft_reactivation",
    validate: (p) => (p.tone === undefined || isTone(p.tone) ? null : `tone must be one of: ${DRAFT_TONES.join(", ")}`),
    assess: async (ids) => bulk(ids, "buyers"),
    snapshot: async (id) => ((await getLead(id)) ? { ids: await draftIdsFor("reactivation", byLead, id) } : null),
    apply: async (id, params) => {
      const lead = await getLead(id);
      if (!lead) return false;
      const now = Date.now();
      if (!isCold(lead, now)) throw new Error(`${lead.name} was contacted recently — no check-in needed.`);
      if ((await listDrafts()).some((x) => x.kind === "reactivation" && x.leadId === id && x.status === "pending")) throw new Error(`${lead.name} already has a check-in waiting for approval.`);
      await putDraft(reactivationDraft(lead, await listProperties(), now, isTone(params.tone) ? params.tone : "friendly"));
      return true;
    },
    restore: (id, data) => restoreSet("reactivation", byLead, id, data),
    resultText: (done, failed) => `Drafted check-ins for ${plural(done.length, "cold buyer")}. Review them in Outreach — nothing was sent.${failed ? ` ${failed} skipped.` : ""}`,
    announce: (l) => `Helix AI drafted check-ins for ${names(l)}`,
  },

  dismiss_draft: {
    name: "dismiss_draft",
    assess: async (ids) => bulk(ids, "drafts"),
    snapshot: draftSnapshot,
    apply: decide("dismissed"),
    restore: restoreDraft,
    resultText: (done, failed) => `Dismissed ${plural(done.length, "draft")}.${failed ? ` ${failed} failed.` : ""}`,
    announce: (l) => `Dismissed ${names(l)}`,
  },

  add_seller: {
    name: "add_seller",
    validate: (p) => {
      if (typeof p.name !== "string" || !p.name.trim()) return "name is required";
      if (typeof p.address !== "string" || !p.address.trim()) return "address is required";
      if (typeof p.zone !== "string" || !p.zone.trim()) return "zone is required";
      if (!PROPERTY_KINDS.includes(p.kind as PropertyKind)) return `kind must be one of: ${PROPERTY_KINDS.join(", ")}`;
      if (!positive(p.sqm) || !Number.isInteger(p.beds) || (p.beds as number) < 0) return "sqm and beds are required";
      if (p.askingPrice !== null && p.askingPrice !== undefined && !positive(p.askingPrice)) return "askingPrice must be a positive number or empty";
      return null;
    },
    assess: async (ids) => bulk(ids, "sellers"),
    snapshot: async (id) => (SELLER_ID.test(id) && !(await getSeller(id)) ? {} : null),
    apply: async (id, p) => {
      const text = (v: unknown, max: number) => String(v ?? "").trim().slice(0, max);
      await putSeller({
        id,
        name: text(p.name, 80),
        email: text(p.email, 120),
        phone: text(p.phone, 40) || undefined,
        source: text(p.source, 40) || "Added by hand",
        address: text(p.address, 120),
        zone: text(p.zone, 40),
        kind: p.kind as PropertyKind,
        sqm: Math.round(p.sqm as number),
        beds: p.beds as number,
        askingPrice: positive(p.askingPrice) ? Math.round(p.askingPrice as number) : null,
        stage: "prospect",
        notes: text(p.notes, 1000),
        createdAt: new Date().toISOString(),
      });
      return true;
    },
    restore: async (id) => {
      await deleteSeller(id);
      return true;
    },
    resultText: (done, failed) => `Added ${plural(done.length, "seller")} as a prospect.${failed ? ` ${failed} failed.` : ""}`,
    announce: (l) => `Added ${names(l)} to Sellers`,
  },

  move_seller_stage: {
    name: "move_seller_stage",
    validate: (p) => (SELLER_STAGES.includes(p.stage as SellerStage) ? null : `stage must be one of: ${SELLER_STAGES.join(", ")}`),
    assess: async (ids, p) => (p.stage === "lost" ? { level: "confirm", reasons: ["Marking a seller lost takes them off your pipeline"] } : bulk(ids, "sellers")),
    snapshot: async (id) => {
      const s = await getSeller(id);
      return s ? { stage: s.stage } : null;
    },
    apply: async (id, p) => setSellerStage(id, p.stage as SellerStage),
    restore: async (id, data) => {
      const stage = (data as { stage?: unknown } | null)?.stage;
      if (!SELLER_STAGES.includes(stage as SellerStage)) throw new Error("Invalid undo data");
      return setSellerStage(id, stage as SellerStage);
    },
    resultText: (done, failed, p) => `Moved ${plural(done.length, "seller")} to ${String(p.stage)}.${failed ? ` ${failed} failed.` : ""}`,
    announce: (l, p) => `Moved ${names(l)} to ${String(p.stage)}`,
  },

  create_listing_from_seller: {
    name: "create_listing_from_seller",
    assess: async (ids) => bulk(ids, "sellers"),
    snapshot: async (id) => {
      const s = await getSeller(id);
      return s ? { stage: s.stage } : null;
    },
    apply: async (id) => {
      const s = await getSeller(id);
      if (!s) return false;
      if (s.propertyId) throw new Error(`${s.name} already has a listing on the desk.`);
      if (!s.askingPrice) throw new Error(`Agree a price with ${s.name} before drafting the listing.`);
      const pid = `prop-${id.replace(/^seller-/, "")}`;
      if (await getProperty(pid)) throw new Error("A listing with this id already exists.");
      await putProperty({
        id: pid,
        title: `${s.address} ${s.kind === "house" ? "House" : s.kind[0].toUpperCase() + s.kind.slice(1)}`,
        address: s.address,
        zone: s.zone,
        kind: s.kind,
        price: s.askingPrice,
        sqm: s.sqm,
        beds: s.beds,
        baths: Math.max(1, Math.round(s.beds / 2)),
        amenities: [],
        status: "draft",
        daysOnMarket: 0,
        description: `Draft from ${s.name}'s seller record. Add photos, bathrooms, amenities and a description before publishing.`,
        cover: ["#1E2E4C", "#C9A24B"],
      });
      await putSeller({ ...s, propertyId: pid, stage: "listed" });
      return true;
    },
    restore: async (id, data) => {
      const stage = (data as { stage?: unknown } | null)?.stage;
      const s = await getSeller(id);
      if (!s || !SELLER_STAGES.includes(stage as SellerStage)) throw new Error("Invalid undo data");
      if (s.propertyId) await deleteProperty(s.propertyId);
      await putSeller({ ...s, propertyId: undefined, stage: stage as SellerStage });
      return true;
    },
    resultText: (done, failed) => `Drafted ${plural(done.length, "listing")}. It's a draft on this desk only — check the bathrooms, add photos and publish it yourself.${failed ? ` ${failed} failed.` : ""}`,
    announce: (l) => `Drafted a listing for ${names(l)}`,
  },

  approve_draft: {
    name: "approve_draft",
    assess: async () => ({ level: "confirm", reasons: ["A message to a buyer needs the agent's sign-off"] }),
    snapshot: draftSnapshot,
    apply: decide("approved"),
    restore: restoreDraft,
    resultText: (done, failed) =>
      `Approved ${plural(done.length, "draft")}. Not sent — no email or WhatsApp is connected yet, so copy it into your own inbox.${failed ? ` ${failed} couldn't be approved.` : ""}`,
    announce: (l) => `Approved ${names(l)} (not sent)`,
  },
};
