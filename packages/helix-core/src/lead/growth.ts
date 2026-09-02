import { budgetNumber, inferIndustry } from "./intelligence";
import type { StoredLead } from "../types";

const DAY = 86_400_000;
const MIN_AGE_DAYS = 180;

export type ResurrectionHit = {
  lead: StoredLead;
  reason: string;
  scoreBoost: number;
};

export function zombieLeads(leads: StoredLead[], now = Date.now(), limit = 5): StoredLead[] {
  const cutoff = now - MIN_AGE_DAYS * DAY;
  return leads
    .filter((lead) => {
      if (lead.classification === "spam") return false;
      const archived = lead.pipelineStage === "lost";
      const cold = lead.tier === "cold";
      return (cold || archived) && new Date(lead.createdAt).getTime() < cutoff;
    })
    .slice(0, limit);
}

export function resurrectLeads(leads: StoredLead[], now = Date.now()): ResurrectionHit[] {
  const hits: ResurrectionHit[] = [];
  for (const lead of leads) {
    if (lead.classification === "spam") continue;
    const coldish =
      lead.tier === "cold" ||
      lead.pipelineStage === "lost" ||
      lead.classification === "info" ||
      lead.score < 55;
    if (!coldish) continue;
    const ageDays = (now - new Date(lead.createdAt).getTime()) / DAY;
    const blob = `${lead.message} ${lead.notes?.join(" ") ?? ""}`;
    const funded = /\b(series [a-c]|raised|funding|funded|ipo)\b/i.test(blob);
    const roleChange = /\b(new (title|role)|promoted|now (vp|ceo|director))\b/i.test(blob);
    const cooledOff = ageDays >= MIN_AGE_DAYS;
    if (!cooledOff && !funded && !roleChange) continue;

    const reasons = [
      cooledOff ? `${Math.round(ageDays)} days since last touch` : null,
      funded ? "funding signal in notes/message" : null,
      roleChange ? "role-change signal" : null,
    ].filter(Boolean);
    hits.push({
      lead,
      reason: reasons.join(" · "),
      scoreBoost: funded ? 18 : roleChange ? 12 : 8,
    });
  }
  return hits.sort((a, b) => b.scoreBoost - a.scoreBoost).slice(0, 8);
}

function tokens(lead: StoredLead): string[] {
  return [
    inferIndustry(lead),
    lead.source.toLowerCase(),
    lead.tier,
    lead.enrichment?.industry ?? "",
    (lead.company ?? "").toLowerCase().split(/\s/)[0] ?? "",
    budgetNumber(lead.budget) != null && budgetNumber(lead.budget)! >= 10000 ? "enterprise" : "smb",
  ].filter(Boolean);
}

export function lookalikeLeads(seed: StoredLead, pool: StoredLead[], limit = 5): StoredLead[] {
  const seedTok = new Set(tokens(seed));
  return pool
    .filter((l) => l.id !== seed.id && l.classification !== "spam")
    .map((l) => {
      const t = tokens(l);
      const overlap = t.filter((x) => seedTok.has(x)).length;
      return { l, overlap };
    })
    .filter((x) => x.overlap >= 2)
    .sort((a, b) => b.overlap - a.overlap || b.l.score - a.l.score)
    .slice(0, limit)
    .map((x) => x.l);
}

export function draftOutreachHeuristic(lead: StoredLead): { subject: string; body: string } {
  const company = lead.company || lead.enrichment?.company || "your team";
  const industry = lead.enrichment?.industry || inferIndustry(lead);
  const focus =
    industry === "hvac"
      ? "quote qualification"
      : industry === "tech"
        ? "inbound scoring"
        : "keeping junk out of the inbox";
  const subject = `${lead.name.split(" ")[0]}, a thought for ${company}`;
  const body = `Hi ${lead.name.split(" ")[0]},

I noticed ${company} is in ${industry} and inbound comes in via ${lead.source}. I imagine the focus right now is ${focus}.

We help teams like yours classify hot/warm/cold before the CRM fills up with noise. Current Helix score: ${lead.score} (${lead.tier}).

Do you have 15 minutes this week?

— Helix`;
  return { subject, body };
}

export type RoiSnapshot = {
  hoursSaved: number;
  pipelineUsd: number;
  spamBlocked: number;
  leadsScored: number;
};

export function roiMetrics(leads: StoredLead[]): RoiSnapshot {
  const minutes = 5;
  const hoursSaved = Math.round(((leads.length * minutes) / 60) * 10) / 10;
  const pipelineUsd = leads
    .filter((l) => l.classification === "lead" && l.tier === "hot")
    .reduce((s, l) => s + (budgetNumber(l.budget) ?? 0), 0);
  const spamBlocked = leads.filter((l) => l.classification === "spam").length;
  return { hoursSaved, pipelineUsd, spamBlocked, leadsScored: leads.length };
}

export type MeetingSlot = { label: string; start: string; url: string };

export function meetingSlots(baseUrl: string, now = new Date()): MeetingSlot[] {
  const slots: MeetingSlot[] = [];
  const cursor = new Date(now);
  cursor.setHours(10, 0, 0, 0);
  while (slots.length < 3) {
    cursor.setDate(cursor.getDate() + 1);
    const day = cursor.getDay();
    if (day === 0 || day === 6) continue;
    const start = new Date(cursor);
    const label = start.toLocaleString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "numeric",
    });
    const url = baseUrl
      ? `${baseUrl}${baseUrl.includes("?") ? "&" : "?"}date=${start.toISOString()}`
      : `https://calendly.com/helix-demo/${start.toISOString().slice(0, 10)}`;
    slots.push({ label, start: start.toISOString(), url });
    cursor.setHours(cursor.getHours() + 3);
  }
  return slots;
}
