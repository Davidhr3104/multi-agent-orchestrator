import { applyRewrite } from "./copilot";
import { PILLAR_LABEL } from "./format";
import { CHANNEL_RULES, postLength, scoreReadiness } from "./readiness";
import type { Brand, Channel, Pillar, Post } from "./types";

const CTA = /\b(link in bio|shop|order|book|join|sign up|subscribe|visit|try|grab|reserve|comment|reply|tell us|dm us|learn more|read more|save this|share)\b/i;

const CTA_LINE: Record<Channel, string> = {
  instagram: "Tap the link in bio to learn more.",
  linkedin: "Read more and tell us what you think.",
  x: "Reply if you want the details.",
  tiktok: "Comment and save this.",
  facebook: "Learn more and tell us you're in.",
};

const TAGS: Record<Pillar, string[]> = {
  product: ["product", "newdrop", "handmade"],
  behind_the_scenes: ["behindthescenes", "studio", "process"],
  education: ["howto", "tips", "learn"],
  community: ["community", "together", "local"],
  promo: ["offer", "thisweek", "now"],
};

const PAD = "Here is a little more of the story, kept specific and plain.";

function tagWeight(tags: string[]): number {
  if (!tags.length) return 0;
  return tags.map((tag) => `#${tag}`).join(" ").length + 1;
}

function fitLength(caption: string, tags: string[], channel: Channel): string {
  const rule = CHANNEL_RULES[channel];
  const cta = CTA_LINE[channel];
  let body = caption.replace(new RegExp(`${cta.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*$`), "").trim();
  const room = (text: string) => rule.idealMax - tagWeight(tags) - text.length;
  let guard = 0;
  while (postLength({ caption: `${body} ${cta}`.trim(), hashtags: tags }) > rule.idealMax && body.length > 24 && guard < 16) {
    body = body.slice(0, Math.max(24, body.length - 24)).trim();
    const stop = Math.max(body.lastIndexOf(". "), body.lastIndexOf(" "));
    if (stop > 16) body = body.slice(0, stop).trim();
    guard += 1;
  }
  let text = `${body.replace(/[.!\s]+$/, "")}. ${cta}`.replace(/^\.\s*/, "");
  guard = 0;
  while (postLength({ caption: text, hashtags: tags }) < rule.idealMin && guard < 6) {
    const nextBody = `${body} ${PAD}`.trim();
    const next = `${nextBody}. ${cta}`;
    if (postLength({ caption: next, hashtags: tags }) > rule.idealMax) break;
    body = nextBody;
    text = next;
    guard += 1;
  }
  if (room(text) < 0 && text.length > cta.length + 8) {
    text = `${text.slice(0, Math.max(cta.length + 8, rule.idealMax - tagWeight(tags) - 1)).trim().replace(/[,:;]+$/, "")}. ${cta}`;
  }
  return text.replace(/\s+/g, " ").trim();
}

/** Rewrites a draft until every readiness rule is satisfied. Form only — it does not judge whether the post is good. */
export function autoFixDraft(post: Pick<Post, "caption" | "hashtags" | "asset" | "channel" | "pillar">, brand: Brand): { caption: string; hashtags: string[]; asset: string } {
  const ctx = { channel: post.channel, pillar: post.pillar, brand };
  let caption = applyRewrite(post.caption, "professional", ctx).text || post.caption;
  const withCta = applyRewrite(caption, "cta", ctx);
  if (!withCta.blocked && withCta.text) caption = withCta.text;

  const rule = CHANNEL_RULES[post.channel];
  let tags = post.hashtags
    .map((tag) => tag.replace(/^#/, "").toLowerCase().replace(/[^\p{L}\p{N}_]+/gu, ""))
    .filter((tag) => tag.length > 1 && tag.length <= 24)
    .filter((tag) => !brand.avoid.some((word) => tag.includes(word.toLowerCase().replace(/\s+/g, ""))));
  tags = [...new Set(tags)];
  for (const filler of TAGS[post.pillar]) {
    if (tags.length >= rule.tagsMin) break;
    if (!tags.includes(filler)) tags.push(filler);
  }
  tags = tags.slice(0, rule.tagsMax);
  caption = fitLength(caption, tags, post.channel);
  if (!CTA.test(caption)) caption = fitLength(`${caption} ${CTA_LINE[post.channel]}`, tags, post.channel);

  const asset = post.asset.trim() || `${PILLAR_LABEL[post.pillar]} still for ${brand.name}`;
  const check = scoreReadiness(
    { id: "fix", channel: post.channel, pillar: post.pillar, scheduledFor: new Date().toISOString(), caption, hashtags: tags, asset, status: "draft", createdBy: "helix_ai", notes: [] },
    brand
  );
  if (check.score !== 100) {
    throw new Error(`Auto-fix reached ${check.score}. ${check.summary}`);
  }
  return { caption, hashtags: tags, asset };
}
