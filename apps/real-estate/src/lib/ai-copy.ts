import { callClaude, claudeReady, inventedNumbers, parseJson } from "./ai-claude";
import type { AiFeature } from "./ai-usage";
import { listingCopy, type ListingCopy } from "./listing-copy";
import { matchAlertDraft, type DraftTone } from "./outreach";
import { fitBreakdown } from "./scoring";
import type { Lead, Property } from "./types";

/**
 * Claude writes the words; the facts come from the desk. Every AI text is checked against the facts it was given
 * and thrown away (falling back to the template) if it mentions a figure or a common amenity that isn't there.
 */

export type Engine = "claude" | "template";
export type AiCost = { inputTokens: number; outputTokens: number; estUsd: number };

const usd = (n: number) => `$${n.toLocaleString("en-US")}`;
const FIN = { cash: "cash buyer", preapproved: "pre-approved mortgage", needs_financing: "still needs financing", unknown: "financing not stated" } as const;

/** Words that describe a feature a listing either has or doesn't. If the AI uses one the facts don't contain, it invented it. */
const AMENITY_WORDS = ["pool", "gym", "garage", "parking", "terrace", "balcony", "garden", "fireplace", "concierge", "elevator", "doorman", "rooftop", "yard", "patio", "basement", "storage", "sauna", "spa", "view", "views", "waterfront", "renovated", "furnished", "school", "schools", "metro", "subway"];

export function unlistedAmenities(text: string, facts: string): string[] {
  const f = facts.toLowerCase();
  const t = text.toLowerCase();
  return AMENITY_WORDS.filter((w) => new RegExp(`\\b${w}\\b`).test(t) && !new RegExp(`\\b${w.replace(/s$/, "")}`).test(f));
}

/** Why an AI text can't be used, or null when it only restates the facts. */
export function factCheck(text: string, facts: string): string | null {
  const nums = inventedNumbers(text, facts);
  if (nums.length) return `it mentioned figures that aren't in the data (${nums.slice(0, 3).join(", ")})`;
  const words = unlistedAmenities(text, facts);
  if (words.length) return `it mentioned features that aren't on the listing (${words.slice(0, 3).join(", ")})`;
  return null;
}

const cost = (u: { inputTokens: number; outputTokens: number; estUsd: number }): AiCost => ({ inputTokens: u.inputTokens, outputTokens: u.outputTokens, estUsd: u.estUsd });

export function listingFacts(p: Property): string {
  return [
    `Title: ${p.title}`,
    `Address: ${p.address}`,
    `Zone: ${p.zone}`,
    `Type: ${p.kind}`,
    `Asking price: ${usd(p.price)}`,
    `Bedrooms: ${p.beds}`,
    `Bathrooms: ${p.baths}`,
    `Size: ${p.sqm} m²`,
    `Amenities: ${p.amenities.length ? p.amenities.join(", ") : "none listed"}`,
    `Agent's description: ${p.description || "none"}`,
  ].join("\n");
}

export type ListingCopyResult = { engine: Engine; copy: ListingCopy[]; note?: string; cost?: AiCost };

const COPY_SYSTEM = `You write real-estate listing copy for an agent, who will edit and approve it.
Use ONLY the facts provided. Do not add amenities, views, finishes, condition, neighbourhood, schools, transport or any claim that isn't in the facts.
Do not write any number that isn't in the facts. Keep a warm, professional tone. English.
Answer with JSON only: {"portal": "...", "social": "...", "message": "..."}
- portal: listing description for a property portal, up to 900 characters, may use short bullet lines starting with "• ".
- social: a social post up to 350 characters, ending with 2-3 hashtags made from the zone and property type.
- message: a short WhatsApp/SMS message to a buyer, up to 280 characters, asking if they want a visit.`;

export async function writeListingCopy(p: Property, fetchImpl?: typeof fetch): Promise<ListingCopyResult> {
  const template = listingCopy(p);
  if (!claudeReady()) return { engine: "template", copy: template, note: "Template copy — Claude isn't connected (no Anthropic API key on this server)." };
  const facts = listingFacts(p);
  const r = await callClaude({ feature: "listing_copy", system: COPY_SYSTEM, prompt: `Facts:\n${facts}`, maxTokens: 900, fetchImpl });
  if (!r.ok) return { engine: "template", copy: template, note: `Template copy — ${r.error}` };
  const out = parseJson<{ portal?: unknown; social?: unknown; message?: unknown }>(r.text);
  const texts = [out?.portal, out?.social, out?.message];
  if (!texts.every((t) => typeof t === "string" && t.trim())) return { engine: "template", copy: template, note: "Template copy — Claude's answer wasn't in the expected format.", cost: cost(r.usage) };
  const [portal, social, message] = (texts as string[]).map((t) => t.trim());
  const problem = factCheck(`${portal}\n${social}\n${message}`, facts);
  if (problem) return { engine: "template", copy: template, note: `Template copy — Claude's draft was discarded because ${problem}.`, cost: cost(r.usage) };
  return {
    engine: "claude",
    cost: cost(r.usage),
    copy: [
      { key: "portal", label: "Portal listing", text: portal.slice(0, 1500) },
      { key: "social", label: "Social post", text: social.slice(0, 600) },
      { key: "message", label: "Short message", text: message.slice(0, 500) },
    ],
  };
}

export function matchFacts(lead: Lead, p: Property): string {
  const parts = fitBreakdown(lead, p);
  const fit = Math.min(100, parts.reduce((s, x) => s + x.points, 0));
  return [
    `Buyer first name: ${lead.name.split(/\s+/)[0]}`,
    `Buyer budget: ${lead.budget > 0 ? usd(lead.budget) : "not stated"}`,
    `Buyer zones: ${lead.zones.length ? lead.zones.join(", ") : "not stated"}`,
    `Buyer minimum bedrooms: ${lead.bedsMin > 0 ? lead.bedsMin : "not stated"}`,
    `Buyer timeline: ${lead.timelineMonths === null ? "not stated" : `${lead.timelineMonths} months`}`,
    `Buyer financing: ${FIN[lead.financing]}`,
    `Buyer's own words: ${lead.message || "none"}`,
    "",
    listingFacts(p),
    "",
    `Fit score computed by the desk: ${fit}/100`,
    ...parts.map((x) => `- ${x.label} ${x.points}/${x.max}: ${x.detail}`),
  ].join("\n");
}

export type MatchAlertResult = { engine: Engine; subject: string; body: string; explanation: string; note?: string; cost?: AiCost };

const ALERT_SYSTEM = `You help a real-estate agent tell a buyer about a listing that fits their brief.
The fit score and its parts were computed by software; restate them, never change or add numbers.
Use ONLY the facts provided. Do not add amenities, views, condition, neighbourhood claims or promises.
Answer with JSON only: {"explanation": "...", "subject": "...", "body": "..."}
- explanation: 1-2 sentences for the agent on why this listing fits this buyer, citing the fit parts.
- subject: an email subject up to 80 characters.
- body: the message to the buyer, up to 120 words, greeting them by first name, mentioning only facts given, and ending by offering a viewing. No signature.`;

const TONE_HINT: Record<DraftTone, string> = { friendly: "Tone: friendly and warm.", formal: "Tone: formal and courteous.", sales: "Tone: direct, with a clear call to book a viewing." };

export async function writeMatchAlert(lead: Lead, p: Property, tone: DraftTone = "friendly", fetchImpl?: typeof fetch, feature: AiFeature = "match_alert"): Promise<MatchAlertResult> {
  const reasons = fitBreakdown(lead, p).filter((x) => x.ok).map((x) => x.detail);
  const t = matchAlertDraft(p, lead, reasons, Date.now(), tone);
  const template: MatchAlertResult = { engine: "template", subject: t.subject, body: t.body, explanation: reasons.join(" · ") };
  if (!claudeReady()) return { ...template, note: "Template wording — Claude isn't connected." };
  const facts = matchFacts(lead, p);
  const r = await callClaude({ feature, system: ALERT_SYSTEM, prompt: `${TONE_HINT[tone]}\n\nFacts:\n${facts}`, maxTokens: 600, fetchImpl });
  if (!r.ok) return { ...template, note: `Template wording — ${r.error}` };
  const out = parseJson<{ explanation?: unknown; subject?: unknown; body?: unknown }>(r.text);
  if (typeof out?.explanation !== "string" || typeof out.subject !== "string" || typeof out.body !== "string" || !out.body.trim()) {
    return { ...template, note: "Template wording — Claude's answer wasn't in the expected format.", cost: cost(r.usage) };
  }
  const problem = factCheck(`${out.explanation}\n${out.subject}\n${out.body}`, facts);
  if (problem) return { ...template, note: `Template wording — Claude's draft was discarded because ${problem}.`, cost: cost(r.usage) };
  return { engine: "claude", subject: out.subject.trim().slice(0, 120), body: out.body.trim().slice(0, 1500), explanation: out.explanation.trim().slice(0, 500), cost: cost(r.usage) };
}
