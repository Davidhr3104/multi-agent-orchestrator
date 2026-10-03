import { scoreRfpHeuristic, type RfpIngestInput, type StoredRfp } from "@helix/core";
import type { AuditEvent } from "@/lib/audit-types";
import { isoDay } from "@/lib/desk-metrics";
import { goNoGo } from "@/lib/rfp-intel";

/**
 * Demo desk seed. Pure: everything is derived from `now`, so the story is the same on every page and every run.
 *
 * Story (each RFP says the same thing everywhere: Deadlines, Analytics, Outcomes, Audit):
 * - Medical record abstraction  GO, bid $85,000, WON at $92,000. Submitted 14 days ago, so closed.
 * - SPI coding                  GO, bid $42,000, LOST (incumbent kept it on price). Closed.
 * - County IT                   NO-GO, no bid. Closed. Its dates are upcoming but nobody is chasing them.
 * - Clinical NLP (thin posting) CONDITIONAL, pending a clearer scope. Undated.
 * - Workers' comp IME review    Open, awaiting a partner decision, due in 9 days.
 */

const DAY = 86_400_000;
const HOUR = 3_600_000;

export type DemoSeed = {
  rfps: StoredRfp[];
  audit: AuditEvent[]; // newest first
  comms: Record<string, { id: string; at: string; kind: "email" | "call" | "meeting" | "note"; text: string }[]>;
};

export function demoSamples(now: number): RfpIngestInput[] {
  const d = (n: number) => isoDay(now + n * DAY);
  const long = (n: number) => new Date(now + n * DAY).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
  return [
    {
      title: "Medical record abstraction — mass tort docket",
      issuer: "Northstar PI Consortium",
      body: `Due: ${d(-14)}. Q&A deadline: ${d(-21)}. Budget $85,000. Method: BEAR. Need clinical chart review and IME summarization for personal injury files in Texas. Submit by ${long(-14)}. Malpractice coverage $2M required. Incumbent Harbor Review Group. Penalty of 10% for late deliverables.`,
    },
    {
      title: "SPI coding for workers' compensation clinic",
      issuer: "Harbor Occupational Health",
      body: `Deadline ${d(-3)}. $42,000. SPI preferred. Extract ICD and work-status from clinical notes. Injury clinic, not a software vendor RFP. Five years experience in workers' compensation coding. E&O insurance required.`,
    },
    {
      title: "County IT — Kubernetes refresh",
      issuer: "Lake County CIO",
      body: `Due ${d(30)}. $210,000 for cluster migration and SaaS catalog sync. No medical records. Shopify-adjacent vendor portal. SOC2 Type II mandatory. Incumbent Nimbus Cloud. IP ownership assigned to County. Site visit ${d(13)}.`,
    },
    {
      title: "Clinical NLP RFP (thin posting)",
      issuer: "Unspecified",
      body: "Looking for AI help with documents. Timeline TBD. Method not stated. ISO 27001 preferred.",
    },
    {
      title: "IME summarization — Gulf Coast claims",
      issuer: "Gulf Coast Claims Group",
      body: `Due: ${d(9)}. Q&A deadline: ${d(3)}. Budget $64,000. Method: BEAR. Independent medical exam summarization for personal injury files in Texas. E&O coverage $2M required.`,
    },
  ];
}

export function buildDemoSeed(now: number, profile: string): DemoSeed {
  const samples = demoSamples(now);
  const created = [-24, -10, -6, -2, -1];
  const rfps: StoredRfp[] = samples.map((sample, i) => {
    const scored = scoreRfpHeuristic(sample);
    return {
      ...scored,
      id: `seed-${sample.title.replace(/[^a-z0-9]/gi, "").slice(0, 14)}`,
      createdAt: new Date(now + created[i] * DAY).toISOString(),
      runId: `seed-run-${i}`,
      title: sample.title,
      issuer: sample.issuer ?? "unspecified",
      body: sample.body,
      clientProfile: sample.clientProfile ?? profile,
      corpusStatus: "not_asked",
    };
  });
  const by = (prefix: string) => rfps.find((r) => r.title.startsWith(prefix))!;
  const medical = by("Medical record");
  const spi = by("SPI coding");
  const county = by("County IT");
  const nlp = by("Clinical NLP");
  const gulf = by("IME summarization");
  const at = (n: number) => new Date(now + n * DAY).toISOString();

  medical.needsReview = false;
  medical.partnerDecision = {
    verdict: "GO",
    coiCleared: true,
    bidAmount: "$85,000",
    notes: "Strong BEAR fit — clinical chart review core practice.",
    decidedBy: "Maya Chen",
    decidedAt: at(-22),
    outcome: "won",
    outcomeAt: at(-12),
    wonAmount: "$92,000",
  };
  spi.needsReview = false;
  spi.partnerDecision = {
    verdict: "GO",
    coiCleared: true,
    bidAmount: "$42,000",
    notes: "SPI preferred — pursued.",
    decidedBy: "Luis Ortega",
    decidedAt: at(-9),
    outcome: "lost",
    outcomeAt: at(-1),
    outcomeNotes: "Incumbent retained on price.",
  };
  county.needsReview = false;
  county.partnerDecision = {
    verdict: "NO-GO",
    coiCleared: true,
    bidAmount: "$210,000",
    notes: "No medical records — outside practice.",
    decidedBy: "Priya Shah",
    decidedAt: at(-5),
    outcome: "no_bid",
    outcomeAt: at(-5),
  };
  nlp.needsReview = true;
  nlp.partnerDecision = {
    verdict: "CONDITIONAL",
    coiCleared: false,
    bidAmount: "Unspecified",
    notes: "Thin posting — need clearer scope before GO.",
    decidedBy: "Luis Ortega",
    decidedAt: at(-1),
    outcome: "pending",
  };
  gulf.needsReview = true;

  // Chronological, with staggered times so the log reads as a real week of work. Reversed at the end (newest first).
  const t = (days: number, hours: number) => new Date(now + days * DAY + hours * HOUR).toISOString();
  const verdictLine = (r: StoredRfp) => {
    const g = goNoGo(r);
    return `${r.title}: ${g.verdict} (${g.score}) via ${r.partnerDecision ? "partner decision" : "desk heuristic"}`;
  };
  const chrono: Omit<AuditEvent, "id">[] = [
    { at: t(-24, -3), actor: "system", action: "seed", detail: `Loaded evaluation desk with ${rfps.length} RFPs` },
    { at: t(-24, -2), actor: "Maya Chen", action: "ingest", detail: `${medical.title} scored ${medical.method} / ${medical.tier}` },
    { at: t(-24, -1), actor: "ethics", action: "coi", detail: verdictLine(medical) },
    { at: t(-23, -5), actor: "pricing", action: "quote", detail: `${medical.title}: quote generated via heuristic` },
    { at: t(-22, -4), actor: "Maya Chen", action: "partner", detail: `${medical.title}: GO · bid $85,000` },
    { at: t(-12, -6), actor: "Maya Chen", action: "outcome", detail: `${medical.title}: won` },
    { at: t(-10, -7), actor: "Luis Ortega", action: "ingest", detail: `${spi.title} scored ${spi.method} / ${spi.tier}` },
    { at: t(-10, -3), actor: "Luis Ortega", action: "review", detail: `${spi.title} marked for partner review` },
    { at: t(-9, -8), actor: "ethics", action: "coi", detail: verdictLine(spi) },
    { at: t(-9, -2), actor: "pricing", action: "quote", detail: `${spi.title}: quote generated via heuristic` },
    { at: t(-1, -9), actor: "Luis Ortega", action: "outcome", detail: `${spi.title}: lost` },
    { at: t(-6, -4), actor: "Priya Shah", action: "compliance", detail: `${county.title} flagged SOC2 + IP assignment` },
    { at: t(-5, -6), actor: "ethics", action: "coi", detail: verdictLine(county) },
    { at: t(-5, -1), actor: "Priya Shah", action: "partner", detail: `${county.title}: NO-GO · capacity avoided` },
    { at: t(-2, -5), actor: "system", action: "ingest", detail: `${nlp.title} scored ${nlp.method} / ${nlp.tier}` },
    { at: t(-1, -3), actor: "Luis Ortega", action: "partner", detail: `${nlp.title}: CONDITIONAL · scope unclear` },
    { at: t(-1, -2), actor: "Maya Chen", action: "ingest", detail: `${gulf.title} scored ${gulf.method} / ${gulf.tier}` },
    { at: t(0, -4), actor: "ethics", action: "coi", detail: verdictLine(gulf) },
    { at: t(0, -3), actor: "pricing", action: "quote", detail: `${gulf.title}: quote generated via heuristic` },
  ];
  const audit = chrono
    .map((e, i) => ({ ...e, id: `seed-a-${String(i).padStart(2, "0")}` }))
    .sort((a, b) => b.at.localeCompare(a.at));

  return {
    rfps,
    audit,
    comms: {
      [medical.id]: [
        { id: "c1", at: t(-23, -2), kind: "email", text: "Sent capability deck to Northstar intake counsel." },
        { id: "c2", at: t(-22, -6), kind: "call", text: "15m scoping call — they want BEAR samples by Friday." },
      ],
    },
  };
}
