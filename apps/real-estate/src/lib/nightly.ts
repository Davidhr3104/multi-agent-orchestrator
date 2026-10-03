import { createHash, timingSafeEqual } from "node:crypto";
import { writeMatchAlert } from "./ai-copy";
import { buyersToAlert, matchAlertDraft } from "./outreach";
import { currentDeskMode, getMatchFingerprints, listDrafts, listLeads, listProperties, logActivity, putDraft, setMatchFingerprint } from "./store";
import type { Property } from "./types";

/**
 * The scheduled automation: once a night, find listings that are new or changed since the last run, match them
 * against open buyers with the desk's own scoring, and queue alert drafts for the agent. It never sends anything.
 */

/** Matching depends on these fields only; a change to any of them re-runs matching for the listing. */
export function propertyFingerprint(p: Property): string {
  return createHash("sha256").update(JSON.stringify([p.price, p.status, p.zone, p.beds, p.baths, p.sqm, p.kind])).digest("hex").slice(0, 16);
}

export function isCronAuthorized(authorization: string | null, secret: string): boolean {
  if (!secret || !authorization) return false;
  const a = Buffer.from(authorization);
  const b = Buffer.from(`Bearer ${secret}`);
  return a.length === b.length && timingSafeEqual(a, b);
}

export type NightlySummary = {
  at: string;
  skipped?: string;
  checked: number;
  changed: number;
  drafted: number;
  aiWritten: number;
  /** Always 0: the nightly run only queues drafts for approval. */
  sent: 0;
};

/** Cap on Claude calls per run (discarded answers are billed too), so a large import can't run up the bill overnight. */
export const NIGHTLY_MAX_AI_DRAFTS = 20;

export async function runNightlyMatching(opts: { now?: number; useAi?: boolean; fetchImpl?: typeof fetch } = {}): Promise<NightlySummary> {
  const now = opts.now ?? Date.now();
  const at = new Date(now).toISOString();
  if (currentDeskMode() === "demo") return { at, skipped: "The desk is on sample data; nightly matching runs on your imported listings only.", checked: 0, changed: 0, drafted: 0, aiWritten: 0, sent: 0 };

  const [props, leads, drafts, fingerprints] = await Promise.all([listProperties(), listLeads(), listDrafts(), getMatchFingerprints()]);
  const alreadyDrafted = new Set(drafts.filter((d) => d.kind === "new_match").map((d) => `${d.propertyIds[0]}|${d.leadId}`));
  let changed = 0;
  let drafted = 0;
  let aiWritten = 0;
  let aiCalls = 0;
  const labels: string[] = [];
  for (const p of props) {
    const fp = propertyFingerprint(p);
    if (fingerprints.get(p.id) === fp) continue;
    changed++;
    for (const b of buyersToAlert(p, leads)) {
      const key = `${p.id}|${b.lead.id}`;
      if (alreadyDrafted.has(key)) continue;
      const draft = { ...matchAlertDraft(p, b.lead, b.reasons, now), queuedBy: "nightly" as const, writer: "template" as const };
      if (opts.useAi && aiCalls < NIGHTLY_MAX_AI_DRAFTS) {
        aiCalls++;
        const ai = await writeMatchAlert(b.lead, p, "friendly", opts.fetchImpl, "nightly_match");
        draft.explanation = ai.explanation;
        if (ai.engine === "claude") {
          Object.assign(draft, { subject: ai.subject, body: ai.body, writer: "claude" });
          aiWritten++;
        }
      }
      await putDraft(draft);
      alreadyDrafted.add(key);
      drafted++;
      labels.push(`${b.lead.name}: ${p.title}`);
    }
    await setMatchFingerprint(p.id, fp);
  }
  if (drafted) await logActivity({ actor: "Helix (nightly)", action: "draft_match_alerts", kind: "run", via: "schedule", labels, done: drafted, failed: 0 });
  const summary: NightlySummary = { at, checked: props.length, changed, drafted, aiWritten, sent: 0 };
  lastRunSlot().last = summary;
  return summary;
}

const lastRunSlot = () => {
  const g = globalThis as typeof globalThis & { __helixReNightly?: { last: NightlySummary | null } };
  g.__helixReNightly ??= { last: null };
  return g.__helixReNightly;
};

/** The last run this server instance made, or null. */
export const lastNightlyRun = (): NightlySummary | null => lastRunSlot().last;
