import type { StoredRfp } from "@helix/core";

export type DeadlineHit = {
  label: string;
  date: string;
  days: number | null;
};

export type ComplianceGap = {
  label: string;
  severity: "red" | "amber";
  detail: string;
};

export type BattleCard = {
  names: string[];
  strengths: string[];
  weaknesses: string[];
  differentiators: string[];
};

export type Assignment = {
  attorney: string;
  role: "Partner" | "Specialist" | "Associate";
  initials: string;
  hours: number;
  workload: number;
  capacity: number;
  reason: string;
  conflict: string | null;
};

export type BodyDiff = {
  added: string[];
  removed: string[];
  shared: string[];
  modified: string[];
};

export type WinSlice = {
  key: string;
  wins: number;
  n: number;
  rate: number;
};

const DEADLINE_PATTERNS: { label: string; re: RegExp }[] = [
  { label: "Submission", re: /(?:due|deadline|submit by|submission)[:\s]+([A-Za-z]+\s+\d{1,2},\s+\d{4}|\d{4}-\d{2}-\d{2})/gi },
  { label: "Q&A", re: /Q&A(?:\s+deadline)?[:\s]+([A-Za-z]+\s+\d{1,2},\s+\d{4}|\d{4}-\d{2}-\d{2})/gi },
  { label: "Site visit", re: /site visit[:\s]+([A-Za-z]+\s+\d{1,2},\s+\d{4}|\d{4}-\d{2}-\d{2})/gi },
  { label: "Document delivery", re: /(?:document delivery|deliverables due)[:\s]+([A-Za-z]+\s+\d{1,2},\s+\d{4}|\d{4}-\d{2}-\d{2})/gi },
];

function parseDate(s: string): number | null {
  const t = Date.parse(s);
  return Number.isNaN(t) ? null : t;
}

export function extractDeadlines(rfp: StoredRfp, now: number): DeadlineHit[] {
  const hits: DeadlineHit[] = [];
  const seen = new Set<string>();
  const blob = `${rfp.deadline}\n${rfp.body}`;
  for (const { label, re } of DEADLINE_PATTERNS) {
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(blob))) {
      const date = m[1];
      const key = `${label}:${date}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const ts = parseDate(date);
      hits.push({
        label,
        date,
        days: ts == null ? null : (ts - now) / 86_400_000,
      });
    }
  }
  if (hits.length === 0 && rfp.deadline && !/unspecified|tbd/i.test(rfp.deadline)) {
    const ts = parseDate(rfp.deadline);
    hits.push({
      label: "Submission",
      date: rfp.deadline,
      days: ts == null ? null : (ts - now) / 86_400_000,
    });
  }
  return hits.sort((a, b) => (a.days ?? 999) - (b.days ?? 999));
}

export function countdownLabel(days: number | null): string {
  if (days == null) return "Date TBD";
  if (days < 0) return "Past due";
  if (days < 1) return `${Math.max(1, Math.round(days * 24))}h left`;
  const n = Math.ceil(days);
  return n === 1 ? "1 day left" : `${n} days left`;
}

export function nearestDeadline(rfp: StoredRfp, now: number): DeadlineHit | null {
  return extractDeadlines(rfp, now)[0] ?? null;
}

function stampIcs(iso: string): string | null {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return null;
  return new Date(t).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

function veventBlock(rfp: StoredRfp, hit: DeadlineHit): string | null {
  const start = stampIcs(hit.date);
  if (!start) return null;
  return [
    "BEGIN:VEVENT",
    `UID:${rfp.id}-${hit.label.replace(/\s+/g, "")}@helix.legal`,
    `DTSTAMP:${start}`,
    `DTSTART;VALUE=DATE:${start.slice(0, 8)}`,
    `SUMMARY:Helix · ${hit.label} · ${rfp.title}`,
    `DESCRIPTION:${hit.label} for ${rfp.issuer}`,
    "END:VEVENT",
  ].join("\r\n");
}

function saveIcs(vevents: string[], filename: string) {
  const ics = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Helix for Legal//EN", ...vevents, "END:VCALENDAR"].join(
    "\r\n"
  );
  const blob = new Blob([ics], { type: "text/calendar" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

export function downloadIcs(rfp: StoredRfp, now: number) {
  const vevents = extractDeadlines(rfp, now)
    .map((h) => veventBlock(rfp, h))
    .filter((v): v is string => Boolean(v));
  saveIcs(vevents, `${rfp.id}-deadlines.ics`);
}

export function downloadDeskCalendar(rfps: StoredRfp[], now: number) {
  const vevents = rfps.flatMap((rfp) =>
    extractDeadlines(rfp, now)
      .map((h) => veventBlock(rfp, h))
      .filter((v): v is string => Boolean(v))
  );
  saveIcs(vevents, "helix-legal-deadlines.ics");
}

export function googleCalendarUrl(hit: DeadlineHit, title: string): string {
  const t = Date.parse(hit.date);
  const day = Number.isNaN(t) ? "" : new Date(t).toISOString().slice(0, 10).replace(/-/g, "");
  const dates = day ? `${day}/${day}` : "";
  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(
    `${hit.label}: ${title}`
  )}&dates=${dates}`;
}

export function alertCadence(days: number | null): string {
  if (days == null) return "Date unclear — confirm in the RFP";
  if (days < 0) return "Past due — do not bid unless extended";
  if (days <= 1) return "Alert: 1 day out (email + Slack)";
  if (days <= 3) return "Alert: 3 days out (email + Slack)";
  if (days <= 7) return "Alert: 7 days out (email)";
  return "On calendar — next ping at 7 days";
}

export function complianceGaps(rfp: StoredRfp): ComplianceGap[] {
  const text = `${rfp.title} ${rfp.body}`.toLowerCase();
  const gaps: ComplianceGap[] = [];
  if (/\biso\s*27001\b|\bsoc\s*2\b|\bsoc2\b/.test(text)) {
    gaps.push({
      label: "Certifications",
      severity: "red",
      detail: "RFP asks for ISO/SOC2. Confirm the firm holds the cert before bidding.",
    });
  }
  if (/\b(\d+)\+?\s+years?\b/.test(text) && /experience/.test(text)) {
    gaps.push({
      label: "Minimum experience",
      severity: "amber",
      detail: "Minimum years of experience is stated. Map it to a named attorney.",
    });
  }
  if (/insur(ance|ed)|malpractice coverage|e&o/.test(text)) {
    gaps.push({
      label: "Insurance",
      severity: "amber",
      detail: "Insurance / E&O language found. Check limits vs. the ask.",
    });
  }
  if (/penalt|liquidated damages|indemnif/.test(text)) {
    gaps.push({
      label: "Penalty / indemnity",
      severity: "red",
      detail: "Penalty or indemnity clause — flag for partner review.",
    });
  }
  if (/\bip ownership|work for hire|assign all rights/.test(text)) {
    gaps.push({
      label: "IP ownership",
      severity: "amber",
      detail: "IP assignment language. Confirm template exceptions.",
    });
  }
  if (/\bbar admission|licensed attorney|good standing\b/.test(text)) {
    gaps.push({
      label: "Bar admission",
      severity: "red",
      detail: "Bar / good-standing language. Confirm counsel is admitted in the named jurisdiction.",
    });
  }
  if (/non-?compete|noncompete/.test(text)) {
    gaps.push({
      label: "Non-compete",
      severity: "amber",
      detail: "Non-compete clause. Partner must sign off before a bid goes out.",
    });
  }
  if (/\b(eu|gdpr|eea|european union)\b/.test(text) && !/\b(texas|california|new york|florida|united states|u\.s\.)\b/.test(text)) {
    gaps.push({
      label: "Jurisdiction conflict",
      severity: "red",
      detail: "RFP reads EU/GDPR-heavy. Firm desk is US-licensed — flag as possible No-Go.",
    });
  }
  if (rfp.tier === "cold") {
    gaps.push({
      label: "Fit",
      severity: "red",
      detail: "Match is cold — likely an eliminator vs. the client profile.",
    });
  }
  return gaps;
}

export function goNoGo(rfp: StoredRfp): { verdict: "GO" | "CONDITIONAL" | "NO-GO"; score: number; why: string } {
  const gaps = complianceGaps(rfp);
  const red = gaps.filter((g) => g.severity === "red").length;
  if (red >= 2 || rfp.tier === "cold") {
    return { verdict: "NO-GO", score: Math.max(8, 28 - red * 10), why: "Eliminator language or cold fit." };
  }
  if (red === 1 || gaps.length >= 2) {
    return { verdict: "CONDITIONAL", score: 58, why: "Bid only if gaps are cleared in HITL." };
  }
  return { verdict: "GO", score: Math.min(92, 70 + Math.round(rfp.matchScore / 5)), why: "No hard eliminators vs. the desk profile." };
}

export function battleCard(rfp: StoredRfp): BattleCard {
  const names = [
    ...new Set(
      [...`${rfp.body} ${rfp.title}`.matchAll(/\b(?:incumbent|versus|vs\.?|competitor)\s+([A-Z][A-Za-z0-9& .-]{2,40})/g)].map(
        (m) => m[1].trim().replace(/[.,;]+$/, "")
      )
    ),
  ].slice(0, 4);
  const inferred = names.length ? names : rfp.tier === "cold" ? ["Incumbent IT vendor"] : [];
  return {
    names: inferred,
    strengths: [
      "Clinical / injury-law desk already staffed",
      "Cited evidence on every extracted field",
    ],
    weaknesses: inferred.length
      ? ["Incumbent already knows the issuer’s templates"]
      : ["No named competitor — research the last awardee"],
    differentiators: [
      "Faster HITL review loop than a generalist firm",
      "BEAR/SPI method fluency in the proposal approach",
    ],
  };
}

export function assignTeam(rfp: StoredRfp): Assignment {
  if (rfp.method === "BEAR") {
    return {
      attorney: "Maya Chen",
      role: "Partner",
      initials: "MC",
      hours: 40,
      workload: 32,
      capacity: 40,
      reason: "BEAR chart-review load",
      conflict: /northstar/i.test(rfp.issuer) ? null : null,
    };
  }
  if (rfp.method === "SPI") {
    return {
      attorney: "Luis Ortega",
      role: "Specialist",
      initials: "LO",
      hours: 28,
      workload: 22,
      capacity: 40,
      reason: "SPI extraction + coding",
      conflict: null,
    };
  }
  const conflict = /lake county/i.test(rfp.issuer)
    ? `${rfp.issuer} sits on an existing county IT matter — conflict check required.`
    : null;
  return {
    attorney: "Priya Shah",
    role: "Associate",
    initials: "PS",
    hours: 16,
    workload: 11,
    capacity: 40,
    reason: "Non-clinical / other method",
    conflict,
  };
}

export function draftProposal(
  rfp: StoredRfp,
  profile: string,
  prior?: StoredRfp | null,
  extras?: { bidTarget?: string; coiVerdict?: string; coiWhy?: string }
): string {
  const assign = assignTeam(rfp);
  const battle = battleCard(rfp);
  const gaps = complianceGaps(rfp);
  const go = goNoGo(rfp);
  const bidLine = extras?.bidTarget
    ? `Smart Pricing target: ${extras.bidTarget}. Stated amount: ${rfp.amount}.`
    : `Stated amount: ${rfp.amount}. Confirm vs. the firm’s budget band in the client profile.`;
  const coiLine = extras?.coiVerdict
    ? `COI ${extras.coiVerdict}${extras.coiWhy ? ` — ${extras.coiWhy}` : ""}`
    : assign.conflict
      ? `Conflict flag: ${assign.conflict}`
      : `No issuer conflict flagged.`;
  return [
    `HELIX FOR LEGAL — proposal pack (partner review required)`,
    `${rfp.title}`,
    `Issuer: ${rfp.issuer}`,
    `Go/No-Go: ${go.verdict} (${go.score}) · ${go.why}`,
    coiLine,
    ``,
    `— PACK CHECKLIST —`,
    `[ ] Partner sign-off on Go/No-Go`,
    `[ ] COI cleared or CONDITIONAL conditions accepted`,
    `[ ] Bid target confirmed (${extras?.bidTarget ?? rfp.amount})`,
    gaps.length
      ? gaps.map((g) => `[ ] Compliance: ${g.label}`).join("\n")
      : `[ ] Compliance: no eliminators flagged`,
    `[ ] Proposal Word pack attached`,
    ``,
    `1. Executive summary`,
    `We propose a ${rfp.method} response for ${rfp.issuer}. Desk match ${rfp.matchScore} (${rfp.tier}). Lead ${assign.attorney} (${assign.role}), ~${assign.hours}h.`,
    ``,
    `2. Approach`,
    rfp.reasoning,
    prior ? `Prior similar matter used as template: ${prior.title}.` : `No prior twin on the desk — write Approach from the RFP body.`,
    ``,
    `3. Team qualifications`,
    `Lead: ${assign.attorney}, ${assign.role}. ${assign.reason}. Capacity ${assign.workload}h / ${assign.capacity}h this week.`,
    coiLine,
    ``,
    `4. Timeline`,
    `Submission: ${rfp.deadline}. Alerts fire at 7 / 3 / 1 day.`,
    ``,
    `5. Pricing`,
    bidLine,
    ``,
    `6. Competitive posture`,
    battle.names.length ? `Incumbent / named: ${battle.names.join(", ")}.` : `No incumbent named.`,
    ...battle.differentiators.map((d) => `• ${d}`),
    ``,
    `7. Compliance notes`,
    gaps.length ? gaps.map((g) => `• [${g.severity}] ${g.label}: ${g.detail}`).join("\n") : `No eliminators flagged.`,
    ``,
    `8. Firm profile (source)`,
    profile,
    ``,
    `— Draft generated for review. Not a filed proposal.`,
  ].join("\n");
}

export function downloadProposalDoc(
  rfp: StoredRfp,
  profile: string,
  prior?: StoredRfp | null,
  extras?: { bidTarget?: string; coiVerdict?: string; coiWhy?: string }
) {
  const text = draftProposal(rfp, profile, prior, extras);
  const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word"><head><meta charset="utf-8"><title>${rfp.title}</title></head><body><pre style="font-family:Calibri,sans-serif;white-space:pre-wrap">${text.replaceAll("<", "&lt;")}</pre></body></html>`;
  const blob = new Blob(["\ufeff" + html], { type: "application/msword" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `proposal-pack-${rfp.id}.doc`;
  a.click();
  URL.revokeObjectURL(a.href);
}

export function similarRfp(current: StoredRfp, all: StoredRfp[]): StoredRfp | null {
  const others = all.filter((r) => r.id !== current.id);
  if (!others.length) return null;
  const tokens = new Set(current.title.toLowerCase().split(/\W+/).filter((w) => w.length > 3));
  let best: StoredRfp | null = null;
  let score = 0;
  for (const r of others) {
    const t = r.title.toLowerCase().split(/\W+/);
    const n = t.filter((w) => tokens.has(w)).length + (r.method === current.method ? 2 : 0);
    if (n >= score) {
      score = n;
      best = r;
    }
  }
  return best;
}

export function diffBodies(a: string, b: string): BodyDiff {
  const split = (s: string) => s.split(/(?<=\.)\s+/).map((x) => x.trim()).filter((x) => x.length > 20);
  const sa = new Set(split(a));
  const sb = split(b);
  const uniqueB = [...new Set(sb)];
  const added = uniqueB.filter((s) => !sa.has(s)).slice(0, 8);
  const shared = uniqueB.filter((s) => sa.has(s)).slice(0, 6);
  const removed = [...sa].filter((s) => !uniqueB.includes(s)).slice(0, 6);
  const modified = added
    .map((s) => {
      const head = s.slice(0, 24).toLowerCase();
      const hit = [...sa].find((old) => old.slice(0, 24).toLowerCase() === head);
      return hit ? s : null;
    })
    .filter((s): s is string => Boolean(s))
    .slice(0, 4);
  return { added, removed, shared, modified };
}

export function winAnalytics(rfps: StoredRfp[]): { slices: WinSlice[]; insight: string } {
  const groups = new Map<string, StoredRfp[]>();
  for (const r of rfps) {
    const key = r.method;
    groups.set(key, [...(groups.get(key) ?? []), r]);
  }
  const slices: WinSlice[] = [...groups.entries()].map(([key, rows]) => {
    const wins = rows.filter((r) => r.tier === "hot").length;
    return { key, wins, n: rows.length, rate: rows.length ? Math.round((wins / rows.length) * 100) : 0 };
  });
  const best = [...slices].sort((a, b) => b.rate - a.rate)[0];
  const worst = [...slices].sort((a, b) => a.rate - b.rate)[0];
  const insight =
    best && worst && slices.length > 1
      ? `Modeled win rate is highest on ${best.key} (${best.rate}%) and weakest on ${worst.key} (${worst.rate}%). Hot = modeled win on this desk, not a closed-file archive.`
      : `Need more RFPs on the desk before practice-area patterns stabilize.`;
  return { slices, insight };
}

export function winProbability(rfp: StoredRfp, all: StoredRfp[]): number {
  const peers = all.filter((r) => r.method === rfp.method);
  const base = peers.length
    ? Math.round((peers.filter((r) => r.tier === "hot").length / peers.length) * 100)
    : rfp.matchScore;
  const go = goNoGo(rfp);
  const adj = go.verdict === "NO-GO" ? -22 : go.verdict === "CONDITIONAL" ? -8 : 6;
  return Math.max(8, Math.min(92, base + adj));
}

export function ingestProgress(logCount: number, running: boolean): number {
  if (!running && logCount === 0) return 0;
  if (!running) return 100;
  return Math.min(95, 12 + logCount * 14);
}

export function nextDeadline(rfps: StoredRfp[], now: number): { label: string; date: string } | null {
  const upcoming = rfps
    .map((r) => {
      const ts = Date.parse(r.deadline);
      return { r, ts };
    })
    .filter((x) => Number.isFinite(x.ts) && x.ts >= now)
    .sort((a, b) => a.ts - b.ts);
  if (!upcoming[0]) return null;
  return { label: upcoming[0].r.title, date: upcoming[0].r.deadline };
}
