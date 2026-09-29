import type { PipelineStage, StoredLead } from "@helix/core";
import { getLead, patchLead } from "./store";

/**
 * Actions the Ask AI drawer can execute after an explicit human confirmation.
 * Each one is a plain patch on the same fields the manual buttons write, so the
 * audit page shows them like any other operator action — with the actor stamped
 * as "Helix AI · approved by <operator>" so AI-proposed changes are attributable.
 */

export const AI_ADVANCE_STAGES: PipelineStage[] = ["qualified", "contacted"];

export function aiActor(operator: string): string {
  return `Helix AI · approved by ${operator}`;
}

function stamp(note: string): string {
  return `${new Date().toISOString().slice(0, 16)} ${note}`;
}

export async function approveLead(id: string, actor: string, orgId: string | undefined): Promise<StoredLead | null> {
  return patchLead(
    id,
    { needsReview: false, reviewedBy: actor, reviewedAt: new Date().toISOString() },
    orgId
  );
}

export async function advanceLead(
  id: string,
  stage: PipelineStage,
  actor: string,
  orgId: string | undefined,
  note?: string
): Promise<StoredLead | null> {
  const current = await getLead(id, orgId);
  if (!current) return null;
  const notes = [...(current.notes ?? []), stamp(note?.trim() || `Moved to ${stage}`)];
  return patchLead(
    id,
    { pipelineStage: stage, reviewedBy: actor, reviewedAt: new Date().toISOString(), notes },
    orgId
  );
}

export async function archiveLead(id: string, actor: string, orgId: string | undefined): Promise<StoredLead | null> {
  return patchLead(
    id,
    { needsReview: false, pipelineStage: "lost", reviewedBy: actor, reviewedAt: new Date().toISOString() },
    orgId
  );
}

export async function noteLead(
  id: string,
  note: string,
  actor: string,
  orgId: string | undefined
): Promise<StoredLead | null> {
  const current = await getLead(id, orgId);
  if (!current) return null;
  return patchLead(
    id,
    { notes: [...(current.notes ?? []), stamp(note)], reviewedBy: actor, reviewedAt: new Date().toISOString() },
    orgId
  );
}

/** The lead fields an AI action can touch — captured before the change so it can be undone. */
/** JSON drops undefined, so "was unset" is an explicit null and becomes undefined again on restore. */
export type LeadSnapshot = {
  id: string;
  pipelineStage?: PipelineStage;
  needsReview?: boolean;
  reviewedBy: string | null;
  reviewedAt: string | null;
  notes?: string[];
};

const STAGES: PipelineStage[] = ["new", "qualified", "contacted", "won", "lost"];

export function isValidSnapshot(s: unknown): s is LeadSnapshot {
  if (!s || typeof s !== "object") return false;
  const o = s as Record<string, unknown>;
  return (
    typeof o.id === "string" &&
    (o.pipelineStage === undefined || STAGES.includes(o.pipelineStage as PipelineStage)) &&
    (o.needsReview === undefined || typeof o.needsReview === "boolean") &&
    (o.reviewedBy === null || typeof o.reviewedBy === "string") &&
    (o.reviewedAt === null || typeof o.reviewedAt === "string") &&
    (o.notes === undefined || (Array.isArray(o.notes) && o.notes.every((n) => typeof n === "string")))
  );
}

export async function snapshotLead(id: string, orgId: string | undefined): Promise<LeadSnapshot | null> {
  const l = await getLead(id, orgId);
  if (!l) return null;
  return {
    id: l.id,
    pipelineStage: l.pipelineStage,
    needsReview: l.needsReview,
    reviewedBy: l.reviewedBy ?? null,
    reviewedAt: l.reviewedAt ?? null,
    notes: l.notes,
  };
}

export async function restoreLead(s: LeadSnapshot, orgId: string | undefined): Promise<StoredLead | null> {
  const { id, reviewedBy, reviewedAt, ...fields } = s;
  return patchLead(id, { ...fields, reviewedBy: reviewedBy ?? undefined, reviewedAt: reviewedAt ?? undefined }, orgId);
}

export type AiActionPayload = {
  action: string;
  targetIds: string[];
  stage?: string;
  note?: string;
  snapshots?: unknown[];
};

export const AI_ACTIONS = ["archive_leads", "approve_leads", "advance_stage", "add_note", "restore"] as const;

/** Runs one allowlisted action across its targets. Every failure is reported per id, never swallowed. */
export async function runAiAction(
  p: AiActionPayload,
  actor: string,
  orgId: string | undefined
): Promise<{ done: string[]; failed: { id: string; error: string }[]; undo: LeadSnapshot[] }> {
  const done: string[] = [];
  const failed: { id: string; error: string }[] = [];
  const undo: LeadSnapshot[] = [];

  if (p.action === "restore") {
    for (const raw of p.snapshots ?? []) {
      if (!isValidSnapshot(raw)) {
        failed.push({ id: "?", error: "Invalid snapshot" });
        continue;
      }
      try {
        (await restoreLead(raw, orgId)) ? done.push(raw.id) : failed.push({ id: raw.id, error: "Lead not found" });
      } catch (err) {
        failed.push({ id: raw.id, error: err instanceof Error ? err.message : String(err) });
      }
    }
    return { done, failed, undo };
  }

  for (const id of p.targetIds) {
    try {
      const before = await snapshotLead(id, orgId);
      let lead: StoredLead | null;
      switch (p.action) {
        case "archive_leads":
          lead = await archiveLead(id, actor, orgId);
          break;
        case "approve_leads":
          lead = await approveLead(id, actor, orgId);
          break;
        case "advance_stage":
          lead = await advanceLead(id, p.stage as PipelineStage, actor, orgId, p.note);
          break;
        case "add_note":
          lead = await noteLead(id, p.note ?? "", actor, orgId);
          break;
        default:
          throw new Error(`Unsupported action ${p.action}`);
      }
      if (lead && before) {
        done.push(id);
        undo.push(before);
      } else failed.push({ id, error: "Lead not found" });
    } catch (err) {
      failed.push({ id, error: err instanceof Error ? err.message : String(err) });
    }
  }
  return { done, failed, undo };
}
