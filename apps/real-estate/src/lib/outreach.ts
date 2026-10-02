import { fitFor, matchProperties } from "./scoring";
import type { Lead, OutreachDraft, Property } from "./types";

/**
 * Deterministic outreach drafts. Every sentence is built from the lead and listing fields, so nothing in a
 * draft is invented. Drafts are proposals: the agent approves or dismisses each one, and nothing is sent.
 */

export const DAY = 86_400_000;
export const COLD_AFTER_DAYS = 30;
export const ALERT_MIN_FIT = 70;

const money = (n: number) => `$${n.toLocaleString("en-US")}`;
const firstName = (l: Lead) => l.name.split(/\s+/)[0];
const isOpen = (l: Lead) => l.stage !== "closed" && l.stage !== "archived";

export function daysSinceContact(l: Lead, now: number): number {
  return Math.floor((now - Date.parse(l.lastContactAt ?? l.createdAt)) / DAY);
}

export function isCold(l: Lead, now: number): boolean {
  return isOpen(l) && daysSinceContact(l, now) > COLD_AFTER_DAYS;
}

/** Open buyers this listing fits well enough to hear about it first, best fit first. */
export function buyersToAlert(p: Property, leads: Lead[]): { lead: Lead; fit: number; reasons: string[] }[] {
  if (p.status !== "active") return [];
  return leads
    .filter(isOpen)
    .map((lead) => ({ lead, m: fitFor(lead, p) }))
    .filter(({ m }) => m.fit >= ALERT_MIN_FIT && m.concerns.length === 0)
    .sort((a, b) => b.m.fit - a.m.fit)
    .map(({ lead, m }) => ({ lead, fit: m.fit, reasons: m.reasons }));
}

let seq = 0;
const newId = (prefix: string) => `${prefix}-${Date.now().toString(36)}-${(seq++).toString(36)}`;

/** Changes only the greeting and the closing line; the facts in the middle are the same for every tone. */
export const DRAFT_TONES = ["friendly", "formal", "sales"] as const;
export type DraftTone = (typeof DRAFT_TONES)[number];
export const TONE_LABEL: Record<DraftTone, string> = { friendly: "Friendly", formal: "Formal", sales: "Sales" };
export const isTone = (v: unknown): v is DraftTone => DRAFT_TONES.includes(v as DraftTone);

const greet = (lead: Lead, tone: DraftTone) => (tone === "formal" ? `Dear ${lead.name},` : `Hi ${firstName(lead)},`);
const VISIT_CLOSE: Record<DraftTone, string> = {
  friendly: "Would you like to see it this week? Reply with a day that works and I'll set it up.",
  formal: "Should you wish to arrange a viewing, please let me know which day suits you and I will organise it.\n\nKind regards",
  sales: "Reply with a day this week and I'll book your viewing straight away.",
};
const CHECKIN_CLOSE: Record<DraftTone, string> = {
  friendly: "Is your search still on? If your plans changed, just let me know and I'll stop sending updates.",
  formal: "Could you confirm whether your search is still active? If your plans have changed, I will stop sending updates.\n\nKind regards",
  sales: "Still searching? Reply and I'll book you a visit this week. If your plans changed, say so and I'll stop the updates.",
};

export function matchAlertDraft(p: Property, lead: Lead, reasons: string[], now: number, tone: DraftTone = "friendly"): OutreachDraft {
  const fits = reasons.map((r) => `• ${r.charAt(0).toLowerCase()}${r.slice(1)}`).join("\n");
  return {
    id: newId("draft-match"),
    kind: "new_match",
    leadId: lead.id,
    propertyIds: [p.id],
    subject: `${p.title} — a listing that fits what you asked for`,
    body: [
      greet(lead, tone),
      ``,
      `A listing just came up that matches your brief: ${p.title}, ${p.address} in ${p.zone}. ${money(p.price)}, ${p.beds} bedrooms, ${p.sqm} m².`,
      ``,
      `Why I thought of you:`,
      fits,
      ``,
      VISIT_CLOSE[tone],
    ].join("\n"),
    why: [`Fit ${fitFor(lead, p).fit}/100 with their budget, zone and bedrooms`, ...reasons],
    status: "pending",
    createdAt: new Date(now).toISOString(),
  };
}

export function reactivationDraft(lead: Lead, properties: Property[], now: number, tone: DraftTone = "friendly"): OutreachDraft {
  const picks = matchProperties(lead, properties.filter((p) => p.status === "active"), 2).filter((m) => m.fit >= 50);
  const days = daysSinceContact(lead, now);
  const listing = picks.length
    ? `${picks.length === 1 ? "A listing that fits" : "Two listings that fit"} what you told me:\n${picks.map((m) => `• ${m.property.title} (${m.property.zone}) — ${money(m.property.price)}, ${m.property.beds} bedrooms`).join("\n")}`
    : `I don't have a perfect match today, but new listings come in every week.`;
  return {
    id: newId("draft-react"),
    kind: "reactivation",
    leadId: lead.id,
    propertyIds: picks.map((m) => m.property.id),
    subject: `Still looking${lead.zones.length ? ` in ${lead.zones.join(" or ")}` : ""}?`,
    body: [
      greet(lead, tone),
      ``,
      `It's been a while since we spoke, so I wanted to check in.`,
      ``,
      listing,
      ``,
      CHECKIN_CLOSE[tone],
    ].join("\n"),
    why: [`No contact in ${days} days (cold after ${COLD_AFTER_DAYS})`, ...(picks.length ? [`${picks.length} active listing${picks.length === 1 ? "" : "s"} fit their brief`] : ["No strong match yet — a check-in only"])],
    status: "pending",
    createdAt: new Date(now).toISOString(),
  };
}
