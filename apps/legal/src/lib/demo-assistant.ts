import type { ActionProposal, StoredRfp } from "@helix/core";

/**
 * Deterministic stand-in for Claude, used only on the demo desk when no ANTHROPIC_API_KEY is set.
 * Every title, score and id in a reply comes from the RFPs passed in; every proposal points at a real
 * id the action registry can act on. It never invents data.
 */

export type DemoReply = {
  answer: string;
  proposal?: ActionProposal;
  /** True when the operator explicitly asked for the change (vs. asking a question). */
  command?: boolean;
};

const DAY = 86_400_000;
const STOP = new Set(["the", "for", "and", "rfp", "with", "from", "that", "this", "send", "run", "check", "add", "note", "prepare", "quote", "record", "conflict", "conflicts", "review", "partner", "fee", "price", "pricing"]);

function tokens(text: string): string[] {
  return (text.toLowerCase().match(/[a-z0-9]{3,}/g) ?? []).filter((t) => !STOP.has(t));
}

type Found = { rfp: StoredRfp } | { ambiguous: StoredRfp[] } | null;

/** Best title/issuer match by shared meaningful words. A tie is reported, never guessed. */
function findRfp(q: string, rfps: StoredRfp[]): Found {
  const words = new Set(tokens(q));
  const scored = rfps
    .map((r) => ({ r, score: tokens(`${r.title} ${r.issuer}`).filter((t) => words.has(t)).length }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score);
  if (scored.length === 0) return null;
  const top = scored.filter((x) => x.score === scored[0].score);
  return top.length === 1 ? { rfp: top[0].r } : { ambiguous: top.map((x) => x.r) };
}

const short = (r: StoredRfp) => r.title.split(/\s[—-]\s/)[0].replace(/\s*\([^)]*\)\s*$/, "");
const deadlineMs = (r: StoredRfp) => Date.parse(r.deadline);
const hasDeadline = (r: StoredRfp) => !Number.isNaN(deadlineMs(r));

function deadlineNote(r: StoredRfp, now: number): string {
  if (!hasDeadline(r)) return "no deadline stated";
  const days = Math.ceil((deadlineMs(r) - now) / DAY);
  if (days < 0) return `deadline ${r.deadline} (passed ${-days}d ago)`;
  return `deadline ${r.deadline} (in ${days}d)`;
}

function summary(rfps: StoredRfp[]): string {
  const by = (t: string) => rfps.filter((r) => r.tier === t).length;
  const review = rfps.filter((r) => r.needsReview);
  const top = [...rfps].sort((a, b) => b.matchScore - a.matchScore)[0];
  const parts = [`Your desk has ${rfps.length} RFPs: ${by("hot")} hot, ${by("warm")} warm and ${by("cold")} cold.`, `${top.title} leads at ${top.matchScore}.`];
  if (review.length) parts.push(`${review.length} flagged for partner review (${review.map(short).join(", ")}).`);
  const unverified = rfps.reduce((s, r) => s + r.unverifiedCount, 0);
  if (unverified) parts.push(`${unverified} facts are still unverified against the firm's documents.`);
  return parts.join(" ");
}

function attention(rfps: StoredRfp[], now: number): string {
  const items: string[] = [];
  for (const r of rfps.filter((x) => x.needsReview)) items.push(`• ${short(r)} — flagged for partner review (match ${r.matchScore})`);
  for (const r of rfps.filter((x) => !x.needsReview && x.unverifiedCount > 0)) items.push(`• ${short(r)} — ${r.unverifiedCount} unverified fact${r.unverifiedCount === 1 ? "" : "s"}`);
  for (const r of rfps.filter((x) => hasDeadline(x) && deadlineMs(x) < now && !x.partnerDecision?.outcome?.match(/won|lost|no_bid|withdrawn/))) items.push(`• ${short(r)} — ${deadlineNote(r, now)}`);
  if (items.length === 0) return "Nothing needs your attention right now.";
  return `${items.length} item${items.length === 1 ? "" : "s"} need your attention:\n${items.join("\n")}`;
}

function deadlines(rfps: StoredRfp[], now: number): string {
  const dated = rfps.filter(hasDeadline).sort((a, b) => deadlineMs(a) - deadlineMs(b));
  if (dated.length === 0) return "None of the RFPs state a deadline.";
  return `Deadlines, soonest first:\n${dated.map((r) => `• ${short(r)} — ${deadlineNote(r, now)}`).join("\n")}`;
}

function explain(r: StoredRfp, now: number): string {
  const decision = r.partnerDecision ? `Partner decision: ${r.partnerDecision.verdict}.` : "No partner decision yet.";
  return `${r.title} (${r.issuer}) matched ${r.matchScore} — ${r.tier}, ${Math.round(r.confidence * 100)}% confidence.\nWhy: ${r.reasoning}\n${deadlineNote(r, now)}; ${r.unverifiedCount} unverified fact${r.unverifiedCount === 1 ? "" : "s"}. ${decision}`;
}

const notFound = (q: string): DemoReply => ({ answer: `I couldn't find an RFP matching "${q}" on this desk.` });
const ambiguous = (rs: StoredRfp[]): DemoReply => ({ answer: `That could be more than one RFP: ${rs.map((r) => short(r)).join(", ")}. Which one do you mean?` });

function command(text: string, q: string, rfps: StoredRfp[]): DemoReply | null {
  const note = text.match(/^(?:please )?(?:add (?:a )?)?note\s+(?:to|on|for)\s+(.+?)\s*[:\-–]\s*(.+)$/i);
  const verdictMatch = q.match(/^(?:please )?(?:record|mark|set|log)\s+(no[- ]?go|conditional|go)\b/);
  const verb = q.match(/^(?:please )?(run|check|prepare|quote|price|send|flag|escalate)\b/)?.[1];
  if (!note && !verdictMatch && !verb) return null;

  const target = (from: string): { rfp: StoredRfp } | DemoReply => {
    const f = findRfp(from, rfps);
    if (!f) return notFound(from);
    if ("ambiguous" in f) return ambiguous(f.ambiguous);
    return f;
  };
  const one = (r: StoredRfp) => [{ id: r.id, label: r.title }];

  if (note) {
    const t = target(note[1]);
    if (!("rfp" in t)) return t;
    return { answer: `Adding a note to ${short(t.rfp)}.`, command: true, proposal: { action: "add_note", summary: `Add a note to ${short(t.rfp)}.`, targets: one(t.rfp), params: { note: note[2].trim() } } };
  }

  if (verdictMatch) {
    const raw = verdictMatch[1].replace(/\s|-/g, "");
    const verdict = raw === "nogo" ? "NO-GO" : raw === "conditional" ? "CONDITIONAL" : "GO";
    const t = target(q.slice(verdictMatch[0].length));
    if (!("rfp" in t)) return t;
    return {
      answer: `Recording ${verdict} on ${short(t.rfp)}.`,
      command: true,
      proposal: { action: "record_decision", summary: `Record ${verdict} on ${short(t.rfp)}.`, targets: one(t.rfp), params: { verdict } },
    };
  }

  if (verb === "run" || verb === "check") {
    if (!/conflict|coi|ethic/.test(q)) return null;
    const t = target(q);
    if (!("rfp" in t)) return t;
    return { answer: `Running the conflict check on ${short(t.rfp)}.`, command: true, proposal: { action: "run_conflict_check", summary: `Run a conflict check on ${short(t.rfp)}.`, targets: one(t.rfp) } };
  }
  if (verb === "prepare" || verb === "quote" || verb === "price") {
    if (!/quote|fee|pric/.test(q)) return null;
    const t = target(q);
    if (!("rfp" in t)) return t;
    return { answer: `Preparing a fee quote for ${short(t.rfp)}.`, command: true, proposal: { action: "run_pricing", summary: `Prepare a fee quote for ${short(t.rfp)}.`, targets: one(t.rfp) } };
  }
  if (verb === "send" || verb === "flag" || verb === "escalate") {
    if (!/review|partner|flag/.test(q)) return null;
    const t = target(q);
    if (!("rfp" in t)) return t;
    return { answer: `Sending ${short(t.rfp)} to partner review.`, command: true, proposal: { action: "flag_review", summary: `Send ${short(t.rfp)} to partner review.`, targets: one(t.rfp) } };
  }
  return null;
}

const HELP =
  'I can summarize your RFPs, tell you what needs attention, list deadlines and explain a match score. You can also tell me what to do — "Run a conflict check on the SPI coding RFP", "Prepare a fee quote for the County IT RFP", "Add a note to the SPI RFP: …", "Send the Clinical NLP RFP to partner review", "Record NO-GO on the County IT RFP" — and I only stop to ask when it needs a partner\'s call.';

export function buildDemoReply(question: string, rfps: StoredRfp[], now: number): DemoReply {
  const text = question.trim();
  const q = text.toLowerCase();
  if (rfps.length === 0) return { answer: "There are no RFPs on this desk yet." };

  const cmd = command(text, q, rfps);
  if (cmd) return cmd;

  if (/deadline|due|when/.test(q)) return { answer: deadlines(rfps, now) };
  if (/attention|review|urgent|flag|unverified|risk/.test(q)) return { answer: attention(rfps, now) };
  const named = findRfp(q, rfps);
  if (named && "rfp" in named && !/summar|overview|pipeline/.test(q)) return { answer: explain(named.rfp, now) };
  if (/summar|overview|pipeline|how.*(doing|going|looking)|status|rfps/.test(q)) return { answer: summary(rfps) };
  return { answer: HELP };
}
