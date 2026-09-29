import type { CampaignAction, DeskActionRegistry, HitlDecision } from "@helix/core";
import { decideCampaign } from "@/lib/campaign-decision";
import { getDecision, getSnapshot, restoreDecision } from "@/lib/store";

/**
 * What Helix AI may do on the Marketing desk, and when it may do it alone.
 *   keep_campaign   record "keep" — local only, changes nothing on the ad platform -> auto (+Undo)
 *   pause_campaign  pause the campaign (writes back to Meta when connected)         -> always ask
 *   scale_campaign  scale the campaign (writes back to Meta when connected)         -> always ask
 * Spend decisions that reach the ad platform always need a person's sign-off.
 */

export type MarketingCtx = { actor: string };

const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? "" : "s"}`;
const names = (l: string[]) => l.join(", ");
const ACTIONS: CampaignAction[] = ["pause", "scale", "keep"];

/** Decisions go to the browser as JSON and back, so "no decision yet" is an explicit null. */
type DecisionSnapshot = { decision: HitlDecision | null };

function isSnapshot(d: unknown): d is DecisionSnapshot {
  if (!d || typeof d !== "object") return false;
  const dec = (d as { decision?: unknown }).decision;
  if (dec === null) return true;
  const o = dec as Record<string, unknown> | undefined;
  return !!o && typeof o.campaignId === "string" && ACTIONS.includes(o.action as CampaignAction) && typeof o.at === "string";
}

async function campaignExists(id: string): Promise<boolean> {
  const snap = await getSnapshot("90d");
  return snap.campaigns.some((c) => c.campaignId === id);
}

async function snapshot(id: string): Promise<DecisionSnapshot | null> {
  return (await campaignExists(id)) ? { decision: await getDecision(id) } : null;
}

async function restore(id: string, data: unknown): Promise<boolean> {
  if (!isSnapshot(data)) throw new Error("Invalid undo data");
  if (!(await campaignExists(id))) return false;
  if (data.decision && data.decision.campaignId !== id) throw new Error("Undo data does not match this campaign");
  await restoreDecision(id, data.decision);
  return true;
}

function decider(action: CampaignAction) {
  return async (id: string, p: Record<string, unknown>, ctx: MarketingCtx) =>
    (await decideCampaign(id, action, typeof p.note === "string" ? p.note : undefined, ctx.actor, true)) !== null;
}

export const marketingActions: DeskActionRegistry<MarketingCtx> = {
  keep_campaign: {
    name: "keep_campaign",
    assess: async (ids) => (ids.length > 3 ? { level: "confirm", reasons: [`Bulk change (${ids.length} campaigns)`] } : { level: "auto", reasons: [] }),
    snapshot,
    apply: decider("keep"),
    restore,
    resultText: (done, failed) => `Kept ${plural(done.length, "campaign")} running and cleared ${done.length === 1 ? "its" : "their"} review flag.${failed ? ` ${failed} failed.` : ""}`,
    announce: (l) => `Helix AI kept ${names(l)}`,
  },

  pause_campaign: {
    name: "pause_campaign",
    assess: async () => ({ level: "confirm", reasons: ["Pausing changes live ad delivery and needs a person's sign-off"] }),
    snapshot,
    apply: decider("pause"),
    restore,
    resultText: (done, failed) => `Paused ${plural(done.length, "campaign")}. Ads Manager is only updated when Meta is connected.${failed ? ` ${failed} failed.` : ""}`,
    announce: (l) => `Helix AI paused ${names(l)}`,
  },

  scale_campaign: {
    name: "scale_campaign",
    assess: async () => ({ level: "confirm", reasons: ["Scaling spends more money and needs a person's sign-off"] }),
    snapshot,
    apply: decider("scale"),
    restore,
    resultText: (done, failed) => `Marked ${plural(done.length, "campaign")} to scale. Ads Manager is only updated when Meta is connected.${failed ? ` ${failed} failed.` : ""}`,
    announce: (l) => `Helix AI scaled ${names(l)}`,
  },
};
