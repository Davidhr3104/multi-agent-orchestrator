import type { BuyerScore, Lead, Property, PropertyMatch, ScoreFactor, Tier } from "./types";

/**
 * Deterministic buyer scoring and property matching. Nothing here calls a model: every point can be traced
 * to a field on the lead, which is what the "Why this?" panel shows.
 */

const money = (n: number) => `$${n.toLocaleString("en-US")}`;

export function tierFor(score: number): Tier {
  return score >= 85 ? "hot" : score >= 60 ? "warm" : "cold";
}

export function scoreBuyer(lead: Lead): BuyerScore {
  const factors: ScoreFactor[] = [];

  const budgetPts = lead.budget >= 900_000 ? 25 : lead.budget >= 500_000 ? 21 : lead.budget >= 250_000 ? 16 : lead.budget > 0 ? 9 : 0;
  factors.push({ label: "Budget", points: budgetPts, max: 25, detail: lead.budget > 0 ? `Up to ${money(lead.budget)}` : "No budget stated" });

  const t = lead.timelineMonths;
  const timePts = t === null ? 3 : t <= 1 ? 25 : t <= 3 ? 20 : t <= 6 ? 12 : 6;
  factors.push({ label: "Timeline", points: timePts, max: 25, detail: t === null ? "Timeline not stated" : t <= 1 ? "Wants to move within a month" : `Wants to move in ${t} months` });

  const finPts = lead.financing === "cash" ? 25 : lead.financing === "preapproved" ? 22 : lead.financing === "needs_financing" ? 10 : 4;
  const finLabel = { cash: "Cash buyer", preapproved: "Pre-approved mortgage", needs_financing: "Still needs financing", unknown: "Financing unknown" }[lead.financing];
  factors.push({ label: "Financing", points: finPts, max: 25, detail: finLabel });

  const specificity = (lead.zones.length > 0 ? 8 : 0) + (lead.bedsMin > 0 ? 4 : 0) + (lead.interestedIn ? 3 : 0);
  factors.push({ label: "Specificity", points: specificity, max: 15, detail: `${lead.zones.length ? `Targets ${lead.zones.join(", ")}` : "No zone given"}${lead.interestedIn ? "; asked about a specific listing" : ""}` });

  const engagement = lead.lastContactAt ? 10 : lead.message.length > 60 ? 6 : 2;
  factors.push({ label: "Engagement", points: engagement, max: 10, detail: lead.lastContactAt ? "Already in conversation" : lead.message.length > 60 ? "Wrote a detailed inquiry" : "Brief inquiry" });

  const score = Math.min(100, factors.reduce((s, f) => s + f.points, 0));
  const known = [lead.budget > 0, t !== null, lead.financing !== "unknown", lead.zones.length > 0].filter(Boolean).length;
  const confidence = Math.round((0.55 + known * 0.1) * 100) / 100;
  const top = [...factors].sort((a, b) => b.points / b.max - a.points / a.max)[0];
  return { score, tier: tierFor(score), confidence, factors, summary: `Scored ${score}: strongest signal is ${top.label.toLowerCase()} (${top.detail.toLowerCase()}).` };
}

export type FitPart = { label: "Budget" | "Location" | "Bedrooms" | "Availability"; points: number; max: number; detail: string; ok: boolean };

/** The four parts a fit score is made of, each traceable to one field on the lead and the listing. */
export function fitBreakdown(lead: Lead, p: Property): FitPart[] {
  const budget: FitPart =
    p.price <= lead.budget
      ? { label: "Budget", points: 40, max: 40, ok: true, detail: `Within budget (${money(p.price)} vs ${money(lead.budget)})` }
      : p.price <= lead.budget * 1.1
        ? { label: "Budget", points: 18, max: 40, ok: false, detail: `Slightly above budget (${money(p.price)})` }
        : { label: "Budget", points: 0, max: 40, ok: false, detail: lead.budget > 0 ? `Over budget by ${money(p.price - lead.budget)}` : "No budget stated" };
  const location: FitPart =
    lead.zones.length === 0
      ? { label: "Location", points: 10, max: 30, ok: true, detail: "No preferred zone given" }
      : lead.zones.includes(p.zone)
        ? { label: "Location", points: 30, max: 30, ok: true, detail: `In ${p.zone}, a zone they asked for` }
        : { label: "Location", points: 0, max: 30, ok: false, detail: `Outside their zones (${p.zone})` };
  const beds: FitPart =
    p.beds >= lead.bedsMin
      ? { label: "Bedrooms", points: 20, max: 20, ok: true, detail: lead.bedsMin > 0 ? `${p.beds} bedrooms covers their ${lead.bedsMin}+` : `${p.beds} bedrooms; no minimum given` }
      : { label: "Bedrooms", points: 0, max: 20, ok: false, detail: `Only ${p.beds} bedrooms, wants ${lead.bedsMin}+` };
  const status: FitPart =
    p.status === "active" ? { label: "Availability", points: 10, max: 10, ok: true, detail: "Active listing" } : { label: "Availability", points: 0, max: 10, ok: false, detail: `Listing is ${p.status}` };
  return [budget, location, beds, status];
}

/** How well a property fits a buyer's brief, 0-100, with plain reasons and concerns. */
export function fitFor(lead: Lead, p: Property): PropertyMatch {
  const parts = fitBreakdown(lead, p);
  const reasons = parts.filter((x) => x.ok && !(x.label === "Location" && lead.zones.length === 0) && !(x.label === "Bedrooms" && lead.bedsMin === 0) && x.label !== "Availability").map((x) => x.detail);
  const concerns = parts.filter((x) => !x.ok).map((x) => x.detail);
  return { property: p, fit: Math.min(100, parts.reduce((s, x) => s + x.points, 0)), reasons, concerns };
}

export function matchProperties(lead: Lead, properties: Property[], limit = 3): PropertyMatch[] {
  return properties
    .filter((p) => p.status === "active" || p.status === "reserved")
    .map((p) => fitFor(lead, p))
    .sort((a, b) => b.fit - a.fit || Number(b.property.id === lead.interestedIn) - Number(a.property.id === lead.interestedIn))
    .slice(0, limit);
}
