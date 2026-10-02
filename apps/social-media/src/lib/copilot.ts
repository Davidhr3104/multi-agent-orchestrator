import { CHANNEL_RULES, postLength } from "./readiness";
import type { Brand, Channel, Pillar, Post } from "./types";

export type RewriteAction = "concise" | "emojis" | "professional" | "cta";

export type RewriteContext = { channel: Channel; pillar: Pillar; brand: Brand };

const CTA = /\b(link in bio|shop|order|book|join|sign up|subscribe|visit|try|grab|reserve|comment|reply|tell us|dm us|learn more|read more|save this|share)\b/i;

const FILLER = /\b(very|really|just|actually|totally|literally|a bit|kind of|sort of)\b/gi;

const EMOJI: Record<Pillar, string> = {
  product: "☕",
  behind_the_scenes: "🛠️",
  education: "📘",
  community: "🤝",
  promo: "✨",
};

const CTA_LINE: Record<Channel, string> = {
  instagram: "Tap the link in bio to learn more.",
  linkedin: "Read more and tell us what you think.",
  x: "Reply if you want the details.",
  tiktok: "Comment and save this.",
  facebook: "Learn more and tell us you're in.",
};

const SUMMARY: Record<RewriteAction, string> = {
  concise: "Made the text more concise",
  emojis: "Added emojis",
  professional: "Shifted the tone to professional",
  cta: "Added a call to action",
};

export function directiveRules(directives: string | undefined): { always: string[]; never: string[] } {
  const always: string[] = [];
  const never: string[] = [];
  for (const line of (directives ?? "").split("\n")) {
    const alwaysMatch = line.trim().match(/^always:\s*(.+)/i);
    const neverMatch = line.trim().match(/^never:\s*(.+)/i);
    if (alwaysMatch) always.push(alwaysMatch[1].trim());
    else if (neverMatch) never.push(neverMatch[1].trim());
  }
  return { always, never };
}

function escapeRegExp(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function stripPhrases(text: string, phrases: string[]): string {
  let next = text;
  for (const phrase of phrases) {
    if (!phrase) continue;
    next = next.replace(new RegExp(escapeRegExp(phrase), "gi"), " ");
  }
  return next.replace(/\s+/g, " ").replace(/\s+([,.!?])/g, "$1").trim();
}

function clip(text: string, max: number): string {
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  const stop = Math.max(cut.lastIndexOf(". "), cut.lastIndexOf(" "));
  const clipped = (stop > 24 ? cut.slice(0, stop) : cut).trim();
  return /[.!?]$/.test(clipped) ? clipped : `${clipped.replace(/[,:;]+$/, "")}.`;
}

function ensureCta(text: string, channel: Channel): string {
  if (CTA.test(text)) return text;
  return `${text.replace(/[.!\s]+$/, "")}. ${CTA_LINE[channel]}`;
}

export function applyRewrite(text: string, action: RewriteAction, ctx: RewriteContext): { text: string; summary: string; blocked?: string } {
  const rules = directiveRules(ctx.brand.directives);
  const source = text.trim();
  if (action === "emojis" && rules.never.some((n) => /emoji/i.test(n))) {
    return { text: source, summary: SUMMARY.emojis, blocked: "Brand directives say not to add emojis." };
  }

  let next = source;
  if (action === "concise") {
    next = stripPhrases(next.replace(FILLER, " "), []);
    const sentences = next.split(/(?<=[.!?])\s+/).filter(Boolean);
    if (sentences.length > 2 && next.length > 160) next = sentences.slice(0, 2).join(" ");
  } else if (action === "emojis") {
    const mark = EMOJI[ctx.pillar];
    if (!next.includes(mark)) next = `${mark} ${next}`;
  } else if (action === "professional") {
    next = next
      .replace(/\b(gonna)\b/gi, "going to")
      .replace(/\b(wanna)\b/gi, "want to")
      .replace(/\b(kinda|sorta)\b/gi, "")
      .replace(/!+/g, ".")
      .replace(/\s+/g, " ")
      .trim();
  } else {
    next = ensureCta(next, ctx.channel);
  }

  next = stripPhrases(next, [...ctx.brand.avoid, ...rules.never.filter((n) => !/emoji/i.test(n))]);
  for (const line of rules.always) {
    if (line && !next.toLowerCase().includes(line.toLowerCase())) next = `${next.replace(/[.!\s]+$/, "")}. ${line}`;
  }
  if (!next) return { text: source, summary: SUMMARY[action], blocked: "That rewrite removed the whole selection. Adjust the brand rules and try again." };
  return { text: next, summary: SUMMARY[action] };
}

function normalizeTag(tag: string): string {
  return tag.replace(/^#/, "").trim().toLowerCase().replace(/[^\p{L}\p{N}_]+/gu, "");
}

/** Channel-native caption + hashtags. Aims at the same form checks the readiness score uses. */
export function repurposeDraft(source: Pick<Post, "caption" | "hashtags" | "pillar">, target: Channel, brand: Brand): { caption: string; hashtags: string[] } {
  const rule = CHANNEL_RULES[target];
  const rules = directiveRules(brand.directives);
  let caption = stripPhrases(source.caption.replace(/\s+/g, " ").trim(), [...brand.avoid, ...rules.never.filter((n) => !/emoji/i.test(n))]);
  caption = clip(caption, rule.idealMax);
  caption = ensureCta(caption, target);

  let tags = source.hashtags.map(normalizeTag).filter((t) => t.length > 1 && t.length <= 40);
  tags = tags.filter((t) => !brand.avoid.some((w) => t.includes(w.toLowerCase().replace(/\s+/g, ""))));
  tags = [...new Set(tags)].slice(0, rule.tagsMax);
  const filler = source.pillar === "behind_the_scenes" ? "behindthescenes" : source.pillar;
  if (tags.length < rule.tagsMin && !tags.includes(filler)) tags.push(filler);

  const cta = CTA_LINE[target];
  while (postLength({ caption, hashtags: tags }) > (rule.hardMax ?? rule.idealMax) && caption.length > cta.length + 8) {
    caption = clip(caption.replace(cta, "").trim(), Math.max(20, caption.length - 40));
    caption = ensureCta(caption, target);
  }
  return { caption, hashtags: tags };
}

const PILLAR_TAGS: Record<Pillar, string[]> = {
  product: ["product", "newdrop", "handmade"],
  behind_the_scenes: ["behindthescenes", "workshop", "process"],
  education: ["howto", "learn", "tips"],
  community: ["community", "together", "local"],
  promo: ["offer", "thisweek", "announce"],
};

/**
 * Rewrites form until the readiness checks can score 100: length, hashtags, CTA, banned words, and a visual brief.
 * It does not judge whether the post is good.
 */
export function autoFix(source: Pick<Post, "caption" | "hashtags" | "asset" | "channel" | "pillar">, brand: Brand): { caption: string; hashtags: string[]; asset: string } {
  const rule = CHANNEL_RULES[source.channel];
  const rules = directiveRules(brand.directives);
  let caption = stripPhrases(source.caption.replace(/\s+/g, " ").trim(), [...brand.avoid, ...rules.never.filter((n) => !/emoji/i.test(n))]);
  if (caption.length < 12) caption = "A specific update from the team, with the detail a reader can use.";
  caption = ensureCta(caption, source.channel);

  let tags = source.hashtags.map(normalizeTag).filter((tag) => tag.length > 1 && tag.length <= 40);
  tags = tags.filter((tag) => !brand.avoid.some((word) => tag.includes(word.toLowerCase().replace(/\s+/g, ""))));
  tags = [...new Set(tags)];
  for (const tag of PILLAR_TAGS[source.pillar]) {
    if (tags.length >= rule.tagsMin) break;
    if (!tags.includes(tag)) tags.push(tag);
  }
  tags = tags.slice(0, Math.max(rule.tagsMax, rule.tagsMin));

  let guard = 0;
  while (postLength({ caption, hashtags: tags }) > rule.idealMax && guard < 6) {
    const cta = CTA_LINE[source.channel];
    caption = clip(caption.replace(cta, "").trim(), Math.max(rule.idealMin, rule.idealMax - 80));
    caption = ensureCta(caption, source.channel);
    guard += 1;
  }
  guard = 0;
  while (postLength({ caption, hashtags: tags }) < rule.idealMin && guard < 3) {
    caption = `${caption.replace(/[.!\s]+$/, "")}. The useful part is concrete, so a reader knows what to do with it.`;
    caption = ensureCta(caption, source.channel);
    guard += 1;
  }
  if (rule.hardMax && postLength({ caption, hashtags: tags }) > rule.hardMax) {
    caption = clip(caption, Math.max(20, rule.hardMax - tags.join(" ").length - tags.length - 8));
    caption = ensureCta(caption, source.channel);
  }

  const asset = source.asset.trim() || "Clean photo, natural light, no text overlay";
  return { caption, hashtags: tags, asset };
}
