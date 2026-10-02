import type { ActionProposal } from "@helix/core";
import { buyersToAlert, isCold } from "./outreach";
import { matchProperties } from "./scoring";
import { needsFeedback, parseWhen } from "./showings";
import type { ScoredLead } from "./store";
import type { MarketZone, OutreachDraft, Property, Showing } from "./types";

/**
 * Deterministic stand-in for Claude, used only on the demo desk when no ANTHROPIC_API_KEY is set. Every name,
 * number and link in a reply comes from the desk data passed in. Replies link to the lead or property they
 * mention as [label](/path) and cite the field they used. It never invents data.
 */

export type DemoReply = { answer: string; command?: boolean; proposal?: ActionProposal };

const money = (n: number) => `$${n.toLocaleString("en-US")}`;
const lk = (l: ScoredLead) => `[${l.name}](/leads/${l.id})`;
const pk = (p: Property) => `[${p.title}](/properties/${p.id})`;
const DAY = 86_400_000;

const STOP = new Set(["the", "for", "and", "who", "what", "which", "best", "fits", "fit", "match", "matches", "buyer", "buyers", "property", "listing", "about", "tell", "show", "me"]);
const tokens = (t: string) => (t.toLowerCase().match(/[a-z0-9]{3,}/g) ?? []).filter((w) => !STOP.has(w));

function findLead(q: string, leads: ScoredLead[]): ScoredLead | undefined {
  return leads.find((l) => q.includes(l.name.toLowerCase())) ?? leads.find((l) => tokens(l.name).some((t) => q.includes(t)));
}

function findProperty(q: string, props: Property[]): Property | undefined {
  const words = new Set(tokens(q));
  const scored = props
    // Unique words only: "Riverside" appearing in both the title and the zone must not count twice.
    .map((p) => ({ p, score: [...new Set(tokens(`${p.title} ${p.address} ${p.zone}`))].filter((t) => words.has(t)).length }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score);
  return scored[0] && scored[0].score >= 2 ? scored[0].p : scored.length === 1 ? scored[0].p : undefined;
}

function summary(leads: ScoredLead[], props: Property[]): string {
  const active = props.filter((p) => p.status === "active").length;
  const hot = leads.filter((l) => l.buyer.tier === "hot");
  const open = leads.filter((l) => l.stage !== "closed" && l.stage !== "archived");
  const avg = Math.round(leads.reduce((s, l) => s + l.buyer.score, 0) / Math.max(1, leads.length));
  return `You have ${active} active listings and ${open.length} open buyers (average score ${avg}). ${hot.length} are hot: ${hot.slice(0, 4).map(lk).join(", ")}${hot.length > 4 ? ` and ${hot.length - 4} more` : ""}.`;
}

function hotLeads(leads: ScoredLead[]): string {
  const hot = leads.filter((l) => l.buyer.tier === "hot" && l.stage !== "closed" && l.stage !== "archived");
  if (hot.length === 0) return "No hot buyers right now.";
  return `${hot.length} hot buyers, best first:\n${hot
    .map((l) => `• ${lk(l)} — score ${l.buyer.score}: ${l.buyer.factors.filter((f) => f.points / f.max >= 0.8).map((f) => f.detail.toLowerCase()).slice(0, 2).join(", ")}`)
    .join("\n")}`;
}

function matchesFor(l: ScoredLead, props: Property[]): string {
  const m = matchProperties(l, props);
  if (m.length === 0) return `I don't have an active listing that fits ${lk(l)} yet.`;
  return `Best matches for ${lk(l)} (budget ${money(l.budget)}${l.zones.length ? `, wants ${l.zones.join(" or ")}` : ""}):\n${m
    .map((x) => `• ${pk(x.property)} — fit ${x.fit}: ${[...x.reasons.slice(0, 2), ...x.concerns.slice(0, 1)].join("; ")}`)
    .join("\n")}`;
}

function buyersFor(p: Property, leads: ScoredLead[]): string {
  const ranked = leads
    .filter((l) => l.stage !== "closed" && l.stage !== "archived")
    .map((l) => ({ l, m: matchProperties(l, [p], 1)[0] }))
    .filter((x) => x.m && x.m.fit >= 60)
    .sort((a, b) => b.m.fit - a.m.fit || b.l.buyer.score - a.l.buyer.score)
    .slice(0, 3);
  if (ranked.length === 0) return `No open buyer is a strong fit for ${pk(p)} yet.`;
  return `Top buyers for ${pk(p)} (${money(p.price)}, ${p.zone}):\n${ranked.map((x) => `• ${lk(x.l)} — fit ${x.m.fit}, score ${x.l.buyer.score}: ${x.m.reasons.slice(0, 2).join("; ")}`).join("\n")}`;
}

function cold(leads: ScoredLead[], now: number): string {
  const stale = leads.filter((l) => l.stage !== "closed" && l.stage !== "archived" && now - Date.parse(l.lastContactAt ?? l.createdAt) > 30 * DAY);
  if (stale.length === 0) return "Every open buyer has been contacted in the last 30 days.";
  return `${stale.length} buyers haven't heard from you in 30+ days:\n${stale.map((l) => `• ${lk(l)} — ${Math.floor((now - Date.parse(l.lastContactAt ?? l.createdAt)) / DAY)} days, score ${l.buyer.score} (${l.buyer.tier})`).join("\n")}\nSay "draft check-ins for cold buyers" and I'll write them for your approval — nothing is sent.`;
}

function market(z: MarketZone | null, props: Property[]): string {
  if (!z) return "There is no market data on this desk yet.";
  const inZone = props.filter((p) => p.zone === z.name && p.status === "active");
  return `${z.name} (DEMO DATA — not a real market report): average ${money(z.avgPricePerSqm)} per m², median ${z.medianDaysOnMarket} days on market, ${z.yoyChangePct >= 0 ? "+" : ""}${z.yoyChangePct}% year over year. Your active listings there: ${inZone.map(pk).join(", ") || "none"}.`;
}

function explainLead(l: ScoredLead): string {
  return `${lk(l)} scored ${l.buyer.score} (${l.buyer.tier}), ${Math.round(l.buyer.confidence * 100)}% confidence.\n${l.buyer.factors.map((f) => `• ${f.label}: ${f.points}/${f.max} — ${f.detail}`).join("\n")}\nStage: ${l.stage}.`;
}

function explainProperty(p: Property): string {
  return `${pk(p)} — ${money(p.price)}, ${p.sqm} m², ${p.beds} bd / ${p.baths} ba in ${p.zone}. ${p.status === "active" ? `Active for ${p.daysOnMarket} days.` : `Status: ${p.status}.`} Amenities: ${p.amenities.join(", ")}.`;
}

const HELP =
  "I can summarize your pipeline, list hot buyers, find the best properties for a buyer or the best buyers for a property, spot buyers that went cold, and show the (demo) market snapshot. I can also draft alerts for the buyers a listing fits and check-ins for cold buyers — you approve every message — and book showings on your calendar (\"book a showing for Ana Torres tomorrow at 5pm\"). Try: \"Who are my hottest buyers?\" or \"Notify buyers about the Riverside loft\".";

/** Requests to write outreach. Drafting runs (with Undo); approving always waits for the agent. */
function outreachCommand(q: string, lead: ScoredLead | undefined, prop: Property | undefined, leads: ScoredLead[], drafts: OutreachDraft[], now: number): DemoReply | null {
  if (/\b(notify|alert)\b|who should (hear|know)|send .*(listing|property) to/.test(q)) {
    if (!prop) return { answer: 'Which listing? e.g. "notify buyers about the Riverside loft".' };
    const fits = buyersToAlert(prop, leads);
    if (prop.status !== "active") return { answer: `${pk(prop)} is ${prop.status}, so I wouldn't alert buyers about it.` };
    if (fits.length === 0) return { answer: `No open buyer is a strong fit for ${pk(prop)} yet (fit 70+ with no concerns).` };
    return {
      answer: `${fits.length} open buyer${fits.length === 1 ? "" : "s"} fit ${pk(prop)}: ${fits.map((f) => lk(f.lead as ScoredLead)).join(", ")}. I'll draft a message for each.`,
      command: true,
      proposal: { action: "draft_match_alerts", summary: `Draft new-listing alerts for ${prop.title}`, targets: [{ id: prop.id, label: prop.title }] },
    };
  }
  if (/(draft|write|prepare).*(check.?in|follow.?up|reactivat)|reactivate|re-?engage/.test(q)) {
    const cold = (lead ? [lead] : leads).filter((l) => isCold(l, now));
    if (cold.length === 0) return { answer: lead ? `${lk(lead)} was contacted recently — no check-in needed.` : "No open buyer has gone 30+ days without contact." };
    return {
      answer: `${cold.length} cold buyer${cold.length === 1 ? "" : "s"}: ${cold.map(lk).join(", ")}. I'll draft a check-in for each with listings that fit.`,
      command: true,
      proposal: { action: "draft_reactivation", summary: `Draft check-ins for ${cold.length} cold buyer${cold.length === 1 ? "" : "s"}`, targets: cold.map((l) => ({ id: l.id, label: l.name })) },
    };
  }
  if (/\bapprove\b/.test(q)) {
    const pending = drafts.filter((d) => d.status === "pending" && (!lead || d.leadId === lead.id));
    if (pending.length === 0) return { answer: lead ? `There's no pending draft for ${lk(lead)}.` : "There are no drafts waiting for approval. Open [Outreach](/outreach) to see them." };
    if (!lead && !/\ball\b/.test(q)) return { answer: `${pending.length} drafts are waiting in [Outreach](/outreach). Say "approve the draft for <buyer>" or review them there.` };
    const label = (d: OutreachDraft) => `${leads.find((l) => l.id === d.leadId)?.name ?? d.leadId}: ${d.subject}`;
    return {
      answer: `Ready to approve ${pending.length} draft${pending.length === 1 ? "" : "s"}. Approving marks them ready to send; nothing is sent from this desk.`,
      command: true,
      proposal: { action: "approve_draft", summary: `Approve ${pending.length} outreach draft${pending.length === 1 ? "" : "s"}`, targets: pending.map((d) => ({ id: d.id, label: label(d) })) },
    };
  }
  return null;
}

const when = (iso: string) => new Date(iso).toLocaleString("en-US", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

/** Booking and reading the agent's own calendar. Nothing here syncs anywhere or notifies anyone. */
function showingCommand(q: string, lead: ScoredLead | undefined, prop: Property | undefined, leads: ScoredLead[], props: Property[], showings: Showing[], now: number): DemoReply | null {
  if (/\b(book|schedule|set up|arrange)\b.*\b(showing|visit|viewing|tour)\b/.test(q)) {
    if (!lead) return { answer: 'Who is the showing for? e.g. "book a showing for Ana Torres at the Riverside loft tomorrow at 5pm".' };
    const listing = prop ?? props.find((p) => p.id === lead.interestedIn);
    if (!listing) return { answer: `Which listing should ${lk(lead)} see? Name it and a time, e.g. "at the Maple Court 2-Bed on friday at 11am".` };
    const at = parseWhen(q, now);
    if (!at) return { answer: `When should ${lk(lead)} see ${pk(listing)}? Give a day and a time, e.g. "tomorrow at 5pm".` };
    const startsAt = at.toISOString();
    return {
      answer: `Booking ${lk(lead)} at ${pk(listing)} for ${when(startsAt)} (45 min). It goes on this desk's calendar only — no invite is sent.`,
      command: true,
      proposal: {
        action: "schedule_showing",
        summary: `Book ${lead.name} at ${listing.title}, ${when(startsAt)}`,
        targets: [{ id: lead.id, label: lead.name }],
        params: { propertyId: listing.id, startsAt, durationMin: 45 },
      },
    };
  }
  if (/\b(showings?|agenda|calendar|viewings?)\b|what'?s on (today|tomorrow|my)|my day\b/.test(q)) {
    const name = (id: string) => leads.find((l) => l.id === id);
    const title = (id: string) => props.find((p) => p.id === id);
    const line = (s: Showing) => {
      const l = name(s.leadId);
      const p = title(s.propertyId);
      return `- ${when(s.startsAt)} — ${l ? lk(l) : "unknown buyer"} at ${p ? pk(p) : "unknown listing"} ([open](/calendar/${s.id}))`;
    };
    const late = showings.filter((s) => needsFeedback(s, now));
    const next = showings.filter((s) => s.status === "scheduled" && Date.parse(s.startsAt) > now).slice(0, 5);
    const parts = [
      next.length ? `**Coming up**\n${next.map(line).join("\n")}` : "No showings coming up.",
      late.length ? `**Waiting for your feedback**\n${late.map(line).join("\n")}` : "",
      "The calendar isn't synced to Google or Outlook yet, so nothing here sent an invite.",
    ];
    return { answer: parts.filter(Boolean).join("\n\n") };
  }
  return null;
}

export function buildDemoReply(
  question: string,
  leads: ScoredLead[],
  props: Property[],
  zone: MarketZone | null,
  now: number,
  drafts: OutreachDraft[] = [],
  showings: Showing[] = []
): DemoReply {
  const q = question.trim().toLowerCase();
  if (leads.length === 0 && props.length === 0) return { answer: "There are no properties or buyers on this desk yet." };

  const lead = findLead(q, leads);
  const prop = findProperty(q, props);
  const cmd = showingCommand(q, lead, prop, leads, props, showings, now) ?? outreachCommand(q, lead, prop, leads, drafts, now);
  if (cmd) return cmd;
  const wantsMatch = /match|fit|suits?|recommend|which propert|who.*(buy|interested)|buyers? for/.test(q);

  if (lead && wantsMatch && !prop) return { answer: matchesFor(lead, props) };
  if (prop && wantsMatch) return { answer: buyersFor(prop, leads) };
  if (lead) return { answer: explainLead(lead) };
  if (prop) return { answer: explainProperty(prop) };
  if (/cold|stale|reactivat|no reply|went quiet|follow.?up/.test(q)) return { answer: cold(leads, now) };
  if (/hot|hottest|best buyer|top buyer|ready to buy|priorit/.test(q)) return { answer: hotLeads(leads) };
  if (/market|price per|comparable|zone|neighbou?rhood|days on market/.test(q)) return { answer: market(zone, props) };
  if (/summar|overview|pipeline|how.*(doing|going|looking)|status/.test(q)) return { answer: summary(leads, props) };
  return { answer: HELP };
}
