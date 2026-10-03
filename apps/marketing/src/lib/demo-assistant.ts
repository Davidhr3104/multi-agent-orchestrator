import type { ActionProposal, StoredCampaign } from "@helix/core";
import type { DeskSnapshot } from "@/lib/store";

/**
 * Deterministic stand-in for Claude, used only on the demo desk when no ANTHROPIC_API_KEY is set.
 * Every name and number in a reply comes from the desk snapshot passed in; every proposal points at a
 * real campaign id the action registry can act on. It never invents data.
 */

export type DemoReply = {
  answer: string;
  proposal?: ActionProposal;
  /** True when the operator explicitly asked for the change (vs. asking a question). */
  command?: boolean;
};

const money = (n: number) => `$${n.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
const STOP = new Set(["the", "campaign", "ad", "ads", "for", "and", "pause", "scale", "keep", "please", "this", "that"]);

function tokens(text: string): string[] {
  return (text.toLowerCase().match(/[a-z0-9]+/g) ?? []).filter((t) => !STOP.has(t) || t.length === 1);
}

/** "Ad D", "ad-d-thin", "the new creative" — match on the campaign id/name words. */
function findCampaign(q: string, campaigns: StoredCampaign[]): { c: StoredCampaign } | { ambiguous: StoredCampaign[] } | null {
  const lowered = q.toLowerCase();
  const letter = lowered.match(/\bad\s+([a-z])\b/)?.[1];
  if (letter) {
    const hit = campaigns.find((c) => c.name.toLowerCase().startsWith(`ad ${letter}`));
    if (hit) return { c: hit };
  }
  const words = new Set(tokens(lowered).filter((t) => t.length > 2));
  const scored = campaigns
    .map((c) => ({ c, score: tokens(`${c.name} ${c.campaignId}`).filter((t) => t.length > 2 && words.has(t)).length }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score);
  if (scored.length === 0) return null;
  const top = scored.filter((x) => x.score === scored[0].score);
  return top.length === 1 ? { c: top[0].c } : { ambiguous: top.map((x) => x.c) };
}

const spamShare = (c: StoredCampaign) => (c.spend > 0 ? (c.metrics.spendOnSpam ?? 0) / c.spend : 0);

function waste(snap: DeskSnapshot): string {
  const w = snap.waste;
  if (w.totalSpend === 0) return "There is no spend on the desk for this window yet.";
  if (w.spendOnSpam === 0) return `Nothing is being wasted: ${money(w.totalSpend)} spent and no spend on spam leads.`;
  const offenders = [...snap.campaigns].filter((c) => (c.metrics.spendOnSpam ?? 0) > 0).sort((a, b) => (b.metrics.spendOnSpam ?? 0) - (a.metrics.spendOnSpam ?? 0));
  return `${money(w.spendOnSpam)} of ${money(w.totalSpend)} went to spam leads (${w.wastePct <= 1 ? Math.round(w.wastePct * 100) : w.wastePct}%).\n${offenders
    .map((c) => `• ${c.name} — ${money(c.metrics.spendOnSpam ?? 0)} on spam (${Math.round(spamShare(c) * 100)}% of its spend)`)
    .join("\n")}\nI can pause the worst one once you say so.`;
}

function worst(snap: DeskSnapshot): string {
  const w = snap.waste;
  if (!w.worstCampaignName) return "No campaign is wasting spend right now.";
  const c = snap.campaigns.find((x) => x.campaignId === w.worstCampaignId);
  return `${w.worstCampaignName} is the worst: ${money(w.worstSpendOnSpam)} spent on spam leads${c ? ` out of ${money(c.spend)}` : ""}. ${c ? `Its current status is ${c.status.replace("_", " ")}.` : ""}`.trim();
}

function scaleCandidates(snap: DeskSnapshot): string {
  const good = snap.campaigns.filter((c) => (c.metrics.nHot ?? 0) > 0 && (c.metrics.nSpam ?? 0) === 0).sort((a, b) => (a.metrics.costPerHot ?? Infinity) - (b.metrics.costPerHot ?? Infinity));
  if (good.length === 0) return "No campaign has produced hot leads without spam yet, so I wouldn't scale anything.";
  return `Worth scaling — hot leads and no spam:\n${good.map((c) => `• ${c.name} — ${c.metrics.nHot} hot lead${c.metrics.nHot === 1 ? "" : "s"}, ${money(c.metrics.costPerHot ?? 0)} per hot lead`).join("\n")}\nSay "scale ${good[0].name}" and I'll ask you to confirm.`;
}

function summary(snap: DeskSnapshot): string {
  const w = snap.waste;
  if (w.totalSpend === 0) return "There is no spend on the desk for this window yet.";
  const review = snap.campaigns.filter((c) => c.needsReview);
  return `Over ${snap.window}: ${money(w.totalSpend)} spent across ${snap.campaigns.length} campaigns, ${w.nLeads} leads (${w.nHot} hot, ${w.nSpam} spam).${review.length ? ` ${review.length} campaigns are waiting for your review (${review.map((c) => c.name).join(", ")}).` : ""}`;
}

function explain(c: StoredCampaign): string {
  return `${c.name} (${c.platform}): ${money(c.spend)} spent, ${c.metrics.nLeads} leads (${c.metrics.nHot} hot, ${c.metrics.nSpam} spam). Suggested action: ${c.action}; status ${c.status.replace("_", " ")}.\nWhy: ${c.reasoning}`;
}

function command(q: string, snap: DeskSnapshot): DemoReply | null {
  const verb = q.match(/^(?:please )?(keep|pause|scale|stop|boost)\b/)?.[1];
  if (!verb) return null;
  const found = findCampaign(q, snap.campaigns);
  if (!found) return { answer: `I couldn't find a campaign matching that on this desk.` };
  if ("ambiguous" in found) return { answer: `That could be more than one campaign: ${found.ambiguous.map((c) => c.name).join(", ")}. Which one do you mean?` };
  const c = found.c;
  const target = [{ id: c.campaignId, label: c.name }];
  const action = verb === "keep" ? "keep_campaign" : verb === "pause" || verb === "stop" ? "pause_campaign" : "scale_campaign";
  const say = action === "keep_campaign" ? "Keeping" : action === "pause_campaign" ? "Pausing" : "Scaling";
  return { answer: `${say} ${c.name}.`, command: true, proposal: { action, summary: `${say} ${c.name}.`, targets: target } };
}

/** "Which campaign should I pause and why?" — names the campaign leaking the most spend and proposes pausing it (a person still confirms). */
function pauseAdvice(snap: DeskSnapshot): DemoReply {
  const leaking = snap.campaigns.filter((c) => (c.metrics.spendOnSpam ?? 0) > 0);
  if (leaking.length === 0) {
    return { answer: `I would not pause anything right now: none of the ${snap.campaigns.length} campaigns has spend attributed to spam leads in this window.` };
  }
  const pick = [...leaking].sort((a, b) => Number(b.action === "pause") - Number(a.action === "pause") || (b.metrics.spendOnSpam ?? 0) - (a.metrics.spendOnSpam ?? 0))[0];
  const m = pick.metrics;
  const pct = Math.round(spamShare(pick) * 100);
  const thin = m.nLeads < 8;
  const engine =
    pick.action === "pause"
      ? "The scoring engine also recommends pausing it."
      : `The scoring engine's own call is "${pick.action}"${pick.needsReview ? " (needs review)" : ""}${thin ? ` because only ${m.nLeads} leads were scored, which is thin evidence` : ""}, so this is your decision.`;
  const answer = `Pause ${pick.name}. ${money(m.spendOnSpam ?? 0)} of its ${money(pick.spend)} (${pct}%) went to spam leads, the most on the desk (${money(snap.waste.spendOnSpam)} across all campaigns). It has ${m.nLeads} scored leads: ${m.nSpam} spam, ${m.nHot} hot${m.nHot === 0 ? ", so nothing to protect" : ""}. ${engine}`;
  return { answer, command: true, proposal: { action: "pause_campaign", summary: `Pausing ${pick.name}.`, targets: [{ id: pick.campaignId, label: pick.name }] } };
}

const HELP =
  'I can summarize your spend, show where money is wasted on spam leads, name the worst campaign and suggest which to scale. You can also tell me what to do — "Keep Ad D", "Pause Ad A", "Scale Ad B" — and I only stop to ask when a change reaches the ad platform.';

export function buildDemoReply(question: string, snap: DeskSnapshot): DemoReply {
  const q = question.trim().toLowerCase();
  if (snap.campaigns.length === 0) return { answer: "There are no campaigns on this desk yet." };

  const cmd = command(q, snap);
  if (cmd) return cmd;

  if (/(which|what|should|any|who).*\b(pause|stop|cut|kill)\b|\b(pause|stop|cut|kill)\b.*\b(which|why)\b/.test(q)) return pauseAdvice(snap);
  if (/wast|spam|leak|losing/.test(q)) return { answer: waste(snap) };
  if (/worst|bad|underperform/.test(q)) return { answer: worst(snap) };
  if (/scale|grow|best|winner|invest/.test(q)) return { answer: scaleCandidates(snap) };
  const named = findCampaign(q, snap.campaigns);
  if (named && "c" in named && !/summar|overview|week/.test(q)) return { answer: explain(named.c) };
  if (/summar|overview|week|spend|how.*(doing|going)|status/.test(q)) return { answer: summary(snap) };
  return { answer: HELP };
}
