import { autoFixDraft } from "./autofix";
import type { Brand, Channel, Pillar } from "./types";

const CHANNELS: [RegExp, Channel][] = [
  [/\b(instagram|insta)\b/i, "instagram"],
  [/\blinkedin\b/i, "linkedin"],
  [/\b(tiktok)\b/i, "tiktok"],
  [/\b(twitter|tweet|\bx\b)/i, "x"],
  [/\b(facebook)\b/i, "facebook"],
];

/** Pulls a channel and a topic out of a command. Returns null when no channel is named. */
export function parseCompose(raw: string): { channel: Channel; topic: string; submit: boolean } | null {
  const text = raw.trim();
  if (text.length < 12) return null;
  const channel = CHANNELS.find(([pattern]) => pattern.test(text))?.[1];
  if (!channel) return null;
  const submit = /\b(review|revisi[oó]n|queue|approval)\b/i.test(text);
  const topic = text
    .replace(/\b(crea|create|draft|write|post|publicaci[oó]n|para|for|sobre|about|and|send|m[aá]ndalo|mandalo|it|to|review|revisi[oó]n|linkedin|instagram|insta|tiktok|twitter|tweet|facebook)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
  return { channel, topic: (topic.length >= 4 ? topic : text).slice(0, 180), submit };
}

export function knowledgeLines(directives: string): string[] {
  return directives
    .split(/\n/)
    .filter((line) => line.startsWith("kb:"))
    .map((line) => line.slice(3).trim())
    .filter(Boolean)
    .slice(0, 8);
}

export function regulatedWords(directives: string): string[] {
  return directives
    .split(/\n/)
    .filter((line) => line.startsWith("regulated:"))
    .map((line) => line.slice("regulated:".length).trim())
    .filter((word) => word.length > 1)
    .slice(0, 20);
}

function pillarFor(topic: string): Pillar {
  if (/\b(product|case|customer|success|cliente|caso)\b/i.test(topic)) return "product";
  if (/\b(how|learn|tip|guide|educat)\b/i.test(topic)) return "education";
  if (/\b(offer|sale|promo|descuento)\b/i.test(topic)) return "promo";
  return "community";
}

/** A form-complete draft from the brand voice and any pasted notes. It does not open a URL or call an image model. */
export function composeDraft(brand: Brand, channel: Channel, topic: string) {
  const pillar = pillarFor(topic);
  const notes = knowledgeLines(brand.directives);
  const voice = brand.voice.slice(0, 3).join(", ");
  const fact = notes[0] ? ` ${notes[0]}` : "";
  let caption = `${brand.name}: ${topic}.${fact} ${voice ? `Voice: ${voice}.` : "Plain and specific."}`;
  for (const word of brand.avoid) {
    if (!word.trim()) continue;
    caption = caption.replace(new RegExp(word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi"), "").replace(/\s+/g, " ").trim();
  }
  const tags = pillar === "product" ? ["product", "story"] : pillar === "education" ? ["howto", "tips"] : ["update", "brand"];
  const asset = `${pillar} frame for ${brand.name}. Prompt only.`;
  const fixed = autoFixDraft({ caption, hashtags: tags, asset, channel, pillar }, brand);
  return { ...fixed, pillar };
}
