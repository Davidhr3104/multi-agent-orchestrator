import type { Brand, Channel, Post, Readiness, ReadinessFactor } from "./types";

/**
 * Deterministic "is this post ready to approve?" score, 0-100. It checks form, not taste: the person
 * approving still decides whether the post is good. Every point comes from a rule shown in "Why this?".
 */

type ChannelRule = { label: string; hardMax?: number; idealMin: number; idealMax: number; tagsMin: number; tagsMax: number };

export const CHANNEL_RULES: Record<Channel, ChannelRule> = {
  instagram: { label: "Instagram", hardMax: 2200, idealMin: 80, idealMax: 400, tagsMin: 3, tagsMax: 8 },
  linkedin: { label: "LinkedIn", hardMax: 3000, idealMin: 150, idealMax: 1300, tagsMin: 1, tagsMax: 3 },
  x: { label: "X", hardMax: 280, idealMin: 40, idealMax: 240, tagsMin: 0, tagsMax: 2 },
  tiktok: { label: "TikTok", hardMax: 2200, idealMin: 20, idealMax: 150, tagsMin: 2, tagsMax: 5 },
  facebook: { label: "Facebook", hardMax: 63206, idealMin: 40, idealMax: 400, tagsMin: 0, tagsMax: 3 },
};

const CTA = /\b(link in bio|shop|order|book|join|sign up|subscribe|visit|try|grab|reserve|comment|reply|tell us|dm us|learn more|read more|save this|share)\b/i;

/** Length the channel actually counts: caption plus the hashtags appended to it. */
export function postLength(p: Pick<Post, "caption" | "hashtags">): number {
  const tags = p.hashtags.map((t) => `#${t}`).join(" ");
  return p.caption.length + (tags ? tags.length + 1 : 0);
}

function lengthFactor(p: Post, rule: ChannelRule): ReadinessFactor {
  const n = postLength(p);
  const max = 25;
  if (rule.hardMax && n > rule.hardMax) return { label: "Length", points: 0, max, detail: `${n} characters — over the ${rule.label} limit of ${rule.hardMax}` };
  if (n < rule.idealMin) return { label: "Length", points: 12, max, detail: `${n} characters — short for ${rule.label} (aim for ${rule.idealMin}+)` };
  if (n > rule.idealMax) return { label: "Length", points: 15, max, detail: `${n} characters — long for ${rule.label} (aim for ${rule.idealMax} or fewer)` };
  return { label: "Length", points: max, max, detail: `${n} characters — fits ${rule.label}` };
}

function tagsFactor(p: Post, rule: ChannelRule): ReadinessFactor {
  const n = p.hashtags.length;
  const max = 20;
  const range = rule.tagsMin === rule.tagsMax ? `${rule.tagsMin}` : `${rule.tagsMin}–${rule.tagsMax}`;
  if (n >= rule.tagsMin && n <= rule.tagsMax) return { label: "Hashtags", points: max, max, detail: `${n} hashtags — within ${range} for ${rule.label}` };
  const off = n < rule.tagsMin ? rule.tagsMin - n : n - rule.tagsMax;
  return { label: "Hashtags", points: Math.max(0, max - off * 6), max, detail: `${n} hashtags — ${rule.label} works best with ${range}` };
}

function ctaFactor(p: Post): ReadinessFactor {
  const m = p.caption.match(CTA);
  return m
    ? { label: "Call to action", points: 20, max: 20, detail: `Asks the reader to act ("${m[0]}")` }
    : { label: "Call to action", points: 6, max: 20, detail: "No clear next step for the reader" };
}

function voiceFactor(p: Post, brand: Brand): ReadinessFactor {
  const text = `${p.caption} ${p.hashtags.join(" ")}`.toLowerCase();
  const hits = brand.avoid.filter((w) => new RegExp(`\\b${w.toLowerCase()}\\b`).test(text));
  return hits.length
    ? { label: "Brand voice", points: 0, max: 20, detail: `Uses words ${brand.name} avoids: ${hits.join(", ")}` }
    : { label: "Brand voice", points: 20, max: 20, detail: `No words from the brand's avoid list` };
}

/** Networks where a post without a picture or clip is not a post. Others can go out as text. */
export const VISUAL_CHANNELS: Channel[] = ["instagram", "tiktok"];

export function needsMedia(channel: Channel): boolean {
  return VISUAL_CHANNELS.includes(channel);
}

/** A person attached an upload or explicitly picked a stock photo. A suggested cover in the UI does not count. */
export function hasMedia(p: Pick<Post, "media">): boolean {
  return Boolean(p.media && p.media.length > 0);
}

function assetFactor(p: Post): ReadinessFactor {
  if (!p.asset.trim()) return { label: "Visual brief", points: 0, max: 15, detail: "No visual described yet" };
  if (needsMedia(p.channel) && !hasMedia(p)) {
    return { label: "Visual brief", points: 6, max: 15, detail: `Brief written, but no image attached. ${CHANNEL_RULES[p.channel].label} needs an upload or an approved stock photo before this is ready` };
  }
  return { label: "Visual brief", points: 15, max: 15, detail: `Brief: ${p.asset}` };
}

export const READY_AT = 85;

/** Checks no one should approve past: over the channel's hard limit, or words the brand avoids. */
export function hardBlockers(factors: ReadinessFactor[]): ReadinessFactor[] {
  return factors.filter((f) => f.points === 0 && (f.label === "Length" || f.label === "Brand voice"));
}

export function scoreReadiness(p: Post, brand: Brand): Readiness {
  const rule = CHANNEL_RULES[p.channel];
  const factors = [lengthFactor(p, rule), tagsFactor(p, rule), ctaFactor(p), voiceFactor(p, brand), assetFactor(p)];
  const score = factors.reduce((s, f) => s + f.points, 0);
  const blockers = hardBlockers(factors);
  const missingMedia = needsMedia(p.channel) && !hasMedia(p);
  const ready = score >= READY_AT && factors.every((f) => f.points > 0) && !missingMedia;
  const weakest = [...factors].sort((a, b) => a.points / a.max - b.points / b.max)[0];
  const lc = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);
  const summary = blockers.length
    ? `Blocked: ${blockers.map((b) => lc(b.detail)).join("; ")}.`
    : ready
      ? "Ready for a person to approve."
      : `Needs work — weakest: ${weakest.label.toLowerCase()} (${lc(weakest.detail)}).`;
  return { score, ready, factors, summary };
}
