import { parseJsonObject } from "@helix/core";
import { suggestSlot } from "../schedule";
import type { Brand, Channel, Pillar, Post } from "../types";
import { callClaude, type AiCallRecord } from "./claude";
import type { FetchLike } from "./config";
import { topPosts, type RankedPost } from "./performance";
import type { RealPost } from "./meta-graph";
import { addZonedDays } from "@/lib/tz";

const PILLARS: Pillar[] = ["product", "behind_the_scenes", "education", "community", "promo"];
const DRAFT_CHANNELS: Channel[] = ["instagram", "facebook", "linkedin"];

export class InspirationError extends Error {}

type ModelDraft = { channel?: unknown; pillar?: unknown; caption?: unknown; hashtags?: unknown; inspiredBy?: unknown; why?: unknown };

export function metricLine(p: RankedPost): string {
  const parts = [`${p.interactions.toLocaleString("en-US")} interactions`];
  if (p.reach !== null) parts.push(`reach ${p.reach.toLocaleString("en-US")}`);
  if (p.engagementRate !== null) parts.push(`${(p.engagementRate * 100).toFixed(1)}% interactions per reached account`);
  return parts.join(", ");
}

const SYSTEM = [
  "You draft social media posts for a brand team. A person reviews every draft before anything is posted.",
  "You get the brand voice and the brand's best real posts, ranked in code by measured results.",
  "Write new posts that reuse what worked (angle, hook, format) without copying sentences.",
  "Never invent results, statistics, prices, or claims. Do not mention metrics in the captions.",
  'Reply with JSON only: {"drafts":[{"channel":"instagram|facebook|linkedin","pillar":"product|behind_the_scenes|education|community|promo","caption":"...","hashtags":["word"],"inspiredBy":["P1"],"why":"one sentence"}]}',
].join(" ");

/** Asks Claude for drafts based on the top real posts. Returns posts ready for the review queue; nothing is stored or published here. */
export async function draftsFromTopPosts(
  posts: RealPost[],
  brand: Brand,
  opts: { count?: number; fetchImpl?: FetchLike; now?: Date; actor?: string } = {}
): Promise<{ drafts: Post[]; top: RankedPost[]; call: AiCallRecord }> {
  const top = topPosts(posts, 3);
  if (!top.length) throw new InspirationError("No real post has measured results yet, so there is nothing to learn from.");
  const count = Math.min(Math.max(opts.count ?? 3, 1), 7);
  const allowed = DRAFT_CHANNELS.filter((c) => !brand.channels.length || brand.channels.includes(c) || top.some((p) => p.network === c));
  const listing = top.map((p, i) => `[P${i + 1}] ${p.network}, ${p.mediaType}, ${metricLine(p)}\nCaption: ${p.caption.slice(0, 600)}`).join("\n\n");
  const prompt = [
    `Brand: ${brand.name}${brand.handle ? ` (${brand.handle})` : ""}.`,
    `Voice: ${brand.voice.join(", ") || "not set"}. Never use: ${brand.avoid.join(", ") || "nothing listed"}.`,
    brand.directives ? `Standing instructions:\n${brand.directives}` : "",
    `Channels you may use: ${allowed.join(", ")}.`,
    `Top real posts, best first:\n\n${listing}`,
    `Write ${count} drafts. Each one must cite at least one of ${top.map((_, i) => `P${i + 1}`).join(", ")} in inspiredBy.`,
  ]
    .filter(Boolean)
    .join("\n\n");
  const { text, call } = await callClaude({ purpose: "drafts_from_top_posts", system: SYSTEM, prompt, maxTokens: 1500 }, opts.fetchImpl);
  const parsed = parseJsonObject<{ drafts?: ModelDraft[] }>(text);
  const now = opts.now ?? new Date();
  const actor = opts.actor ?? "Helix AI";
  const drafts: Post[] = [];
  for (const raw of parsed?.drafts ?? []) {
    if (drafts.length >= count) break;
    const channel = allowed.includes(raw.channel as Channel) ? (raw.channel as Channel) : null;
    const caption = typeof raw.caption === "string" ? raw.caption.trim().slice(0, 2200) : "";
    const sources = (Array.isArray(raw.inspiredBy) ? raw.inspiredBy : [])
      .map((label) => (typeof label === "string" ? top[Number(label.replace(/^P/i, "")) - 1] : undefined))
      .filter((p): p is RankedPost => Boolean(p));
    if (!channel || !caption || !sources.length) continue;
    const pillar = PILLARS.includes(raw.pillar as Pillar) ? (raw.pillar as Pillar) : "education";
    const slot = addZonedDays(now, drafts.length + 1, suggestSlot(channel, pillar, now).hour);
    const hashtags = (Array.isArray(raw.hashtags) ? raw.hashtags : [])
      .filter((t): t is string => typeof t === "string")
      .map((t) => t.replace(/^#/, "").trim().toLowerCase())
      .filter((t) => /^[\p{L}\p{N}_]{1,40}$/u.test(t))
      .slice(0, 8);
    const unique = [...new Map(sources.map((p) => [p.id, p])).values()];
    drafts.push({
      id: `ai-${channel}-${now.getTime().toString(36)}-${drafts.length}`,
      channel,
      pillar,
      scheduledFor: slot.toISOString(),
      caption,
      hashtags,
      asset: "Visual to pick: reuse the format of the inspiring post.",
      status: "needs_review",
      createdBy: "helix_ai",
      notes: [
        `${actor}: Claude drafted this from real results. Waiting for approval; nothing is published.`,
        ...unique.map((p) => `Inspired by ${p.network} post ${p.permalink ?? p.id} (${metricLine(p)}; computed from the Graph API).`),
        ...(typeof raw.why === "string" && raw.why.trim() ? [`Claude's reasoning: ${raw.why.trim().slice(0, 300)}`] : []),
      ],
      comments: [],
      revisions: [],
      media: [],
      inspiredBy: unique.map((p) => ({ network: p.network, id: p.id, permalink: p.permalink })),
    });
  }
  if (!drafts.length) throw new InspirationError("Claude did not return a usable draft that cites a real post. Nothing was added.");
  return { drafts, top, call };
}
