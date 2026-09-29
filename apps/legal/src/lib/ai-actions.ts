import type { DeskActionRegistry, PartnerDecision, StoredRfp } from "@helix/core";
import { PARTNER_VERDICTS, recordPartnerDecision } from "@/lib/partner-decision";
import {
  addComm,
  checkAndStoreConflict,
  checkAndStorePricing,
  commIds,
  getRfp,
  patchRfp,
  removeCommsExcept,
} from "@/lib/store";

/**
 * What Helix AI may do on the Legal desk, and when it may do it alone.
 *   flag_review        send an RFP to partner review          -> auto (+Undo)
 *   add_note           log a note on the RFP                  -> auto (+Undo)
 *   run_conflict_check compute the COI report                 -> auto (nothing to undo, it only computes)
 *   run_pricing        compute a fee quote                    -> auto (nothing to undo, it only computes)
 *   record_decision    the partner's GO / CONDITIONAL / NO-GO -> always ask: it is a person's call
 */

export type LegalCtx = { actor: string };

const BULK_LIMIT = 3;
const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? "" : "s"}`;
const names = (l: string[]) => l.join(", ");

async function rfps(ids: string[]): Promise<StoredRfp[]> {
  return (await Promise.all(ids.map((id) => getRfp(id)))).filter((r): r is StoredRfp => r !== null);
}

const exists = async (id: string) => ((await getRfp(id)) ? {} : null);

const bulkGate = (ids: string[], what: string) =>
  ids.length > BULK_LIMIT ? { level: "confirm" as const, reasons: [`Bulk ${what} (${ids.length} RFPs)`] } : { level: "auto" as const, reasons: [] };

/** JSON drops undefined, so "no decision yet" is stored as an explicit null. */
type ReviewSnapshot = { needsReview: boolean; partnerDecision: PartnerDecision | null };

function isReviewSnapshot(d: unknown): d is ReviewSnapshot {
  if (!d || typeof d !== "object") return false;
  const o = d as Record<string, unknown>;
  if (typeof o.needsReview !== "boolean") return false;
  if (o.partnerDecision === null) return true;
  const p = o.partnerDecision as Record<string, unknown> | undefined;
  return !!p && typeof p === "object" && PARTNER_VERDICTS.includes(p.verdict as never) && typeof p.decidedBy === "string";
}

async function reviewSnapshot(id: string): Promise<ReviewSnapshot | null> {
  const r = await getRfp(id);
  return r ? { needsReview: r.needsReview, partnerDecision: r.partnerDecision ?? null } : null;
}

async function restoreReview(id: string, data: unknown): Promise<boolean> {
  if (!isReviewSnapshot(data)) throw new Error("Invalid undo data");
  return (await patchRfp(id, { needsReview: data.needsReview, partnerDecision: data.partnerDecision ?? undefined })) !== null;
}

export const legalActions: DeskActionRegistry<LegalCtx> = {
  flag_review: {
    name: "flag_review",
    assess: async (ids) => {
      const rows = await rfps(ids);
      const reasons: string[] = [];
      if (rows.length !== ids.length) reasons.push("An RFP no longer exists");
      if (rows.some((r) => r.partnerDecision)) reasons.push("An RFP already has a partner decision");
      if (rows.length > BULK_LIMIT) reasons.push(`Bulk change (${rows.length} RFPs)`);
      return reasons.length ? { level: "confirm", reasons } : { level: "auto", reasons };
    },
    snapshot: reviewSnapshot,
    apply: async (id) => (await patchRfp(id, { needsReview: true })) !== null,
    restore: restoreReview,
    resultText: (done, failed) => `Sent ${plural(done.length, "RFP")} to partner review.${failed ? ` ${failed} failed.` : ""}`,
    announce: (l) => `Helix AI sent ${names(l)} to partner review`,
  },

  record_decision: {
    name: "record_decision",
    validate: (p) => (PARTNER_VERDICTS.includes(p.verdict as never) ? null : "verdict must be GO, CONDITIONAL, or NO-GO"),
    assess: async () => ({ level: "confirm", reasons: ["A GO / NO-GO is the partner's decision, not the AI's"] }),
    snapshot: reviewSnapshot,
    apply: async (id, p, ctx) =>
      (await recordPartnerDecision(
        id,
        { verdict: p.verdict as never, coiCleared: Boolean(p.coiCleared), notes: typeof p.notes === "string" ? p.notes : undefined },
        ctx.actor
      )) !== null,
    restore: restoreReview,
    resultText: (done, failed, p) => `Recorded ${String(p.verdict)} on ${plural(done.length, "RFP")}.${failed ? ` ${failed} failed.` : ""}`,
    announce: (l, p) => `Helix AI recorded ${String(p.verdict)} on ${names(l)}`,
  },

  add_note: {
    name: "add_note",
    validate: (p) => (typeof p.note === "string" && p.note.trim() ? null : "note is required"),
    assess: async (ids) => bulkGate(ids, "change"),
    snapshot: async (id) => ((await getRfp(id)) ? { commIds: await commIds(id) } : null),
    apply: async (id, p) => (await addComm(id, "note", String(p.note))) !== null,
    restore: async (id, data) => {
      const ids = (data as { commIds?: unknown } | null)?.commIds;
      if (!Array.isArray(ids) || !ids.every((x) => typeof x === "string")) throw new Error("Invalid undo data");
      if (!(await getRfp(id))) return false;
      await removeCommsExcept(id, ids as string[]);
      return true;
    },
    resultText: (done) => `Note added to ${plural(done.length, "RFP")}.`,
    announce: (l) => `Helix AI added a note to ${names(l)}`,
  },

  run_conflict_check: {
    name: "run_conflict_check",
    reversible: false,
    assess: async (ids) => bulkGate(ids, "run"),
    snapshot: exists,
    apply: async (id) => {
      const r = await getRfp(id);
      if (!r) return false;
      await checkAndStoreConflict(r);
      return true;
    },
    restore: async () => {
      throw new Error("A conflict check only computes a report; there is nothing to undo.");
    },
    resultText: (done) => `Ran the conflict-of-interest check on ${plural(done.length, "RFP")}.`,
    announce: (l) => `Helix AI ran a conflict check on ${names(l)}`,
  },

  run_pricing: {
    name: "run_pricing",
    reversible: false,
    assess: async (ids) => bulkGate(ids, "run"),
    snapshot: exists,
    apply: async (id) => {
      const r = await getRfp(id);
      if (!r) return false;
      await checkAndStorePricing(r);
      return true;
    },
    restore: async () => {
      throw new Error("A fee quote only computes a number; there is nothing to undo.");
    },
    resultText: (done) => `Prepared a fee quote for ${plural(done.length, "RFP")}.`,
    announce: (l) => `Helix AI prepared a fee quote for ${names(l)}`,
  },
};
