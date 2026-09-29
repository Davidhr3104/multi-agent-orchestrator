import type { ActionProposal } from "@helix/core";
import type { EmailThread } from "@/lib/types";

/**
 * Deterministic stand-in for Claude, used only on the demo desk when no ANTHROPIC_API_KEY is set.
 * Every sender, subject and score in a reply comes from the threads passed in; every proposal points at
 * a real thread id the action registry can act on. It never invents data.
 */

export type DemoReply = {
  answer: string;
  proposal?: ActionProposal;
  /** True when the operator explicitly asked for the change (vs. asking a question). */
  command?: boolean;
};

const STOP = new Set(["the", "email", "emails", "thread", "reply", "draft", "send", "snooze", "archive", "route", "for", "from", "and", "please", "message", "mail", "newsletter", "that", "this", "with"]);
const tokens = (t: string) => (t.toLowerCase().match(/[a-z0-9]{3,}/g) ?? []).filter((w) => !STOP.has(w));

const isActive = (t: EmailThread) => t.status !== "archived" && t.status !== "blocked" && t.status !== "sent" && t.category !== "spam";
const byUrgencyDesc = (a: EmailThread, b: EmailThread) => b.urgencyScore - a.urgencyScore;
const who = (t: EmailThread) => t.fromName || t.fromEmail;

/** Match by sender name or subject words. "the newsletter" is treated as a category hint. */
function findThread(q: string, threads: EmailThread[]): { t: EmailThread } | { ambiguous: EmailThread[] } | null {
  const words = new Set(tokens(q));
  const scored = threads
    .map((t) => {
      let score = tokens(`${t.fromName} ${t.fromEmail} ${t.subject}`).filter((w) => words.has(w)).length;
      if (/newsletter|digest/.test(q) && /newsletter|digest|weekly/i.test(`${t.fromName} ${t.fromEmail} ${t.subject}`)) score += 1;
      return { t, score };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score);
  if (scored.length === 0) return null;
  const top = scored.filter((x) => x.score === scored[0].score);
  return top.length === 1 ? { t: top[0].t } : { ambiguous: top.map((x) => x.t) };
}

function urgent(threads: EmailThread[]): string {
  const rows = threads.filter(isActive).filter((t) => t.urgencyScore >= 60).sort(byUrgencyDesc);
  if (rows.length === 0) return "Nothing urgent right now.";
  return `${rows.length} urgent thread${rows.length === 1 ? "" : "s"}, most urgent first:\n${rows
    .map((t) => `• ${who(t)} — "${t.subject}" (urgency ${t.urgencyScore}${t.needsReview ? ", awaiting your review" : ""})`)
    .join("\n")}`;
}

function needReply(threads: EmailThread[]): string {
  const rows = threads.filter(isActive).filter((t) => t.category === "action_required" || t.category === "meeting").sort(byUrgencyDesc);
  if (rows.length === 0) return "No open thread needs a reply.";
  return `${rows.length} thread${rows.length === 1 ? " needs" : "s need"} a reply:\n${rows
    .map((t) => `• ${who(t)} — "${t.subject}"${t.draftReply ? " (draft ready)" : ""}`)
    .join("\n")}`;
}

function ignorable(threads: EmailThread[]): string {
  const rows = threads.filter(isActive).filter((t) => t.category === "fyi" && t.urgencyScore < 40);
  if (rows.length === 0) return "Nothing here is safe to ignore — everything open needs a look.";
  return `You can ignore ${rows.length}: ${rows.map((t) => `${who(t)} ("${t.subject}")`).join(", ")}. Say "archive the ${who(rows[0])} email" and I'll clear it.`;
}

function summary(threads: EmailThread[]): string {
  const open = threads.filter(isActive);
  const review = open.filter((t) => t.needsReview);
  const top = [...open].sort(byUrgencyDesc)[0];
  if (!top) return "Your inbox is clear.";
  return `${open.length} open thread${open.length === 1 ? "" : "s"}, ${review.length} awaiting your review. Most urgent: ${who(top)} — "${top.subject}" (${top.urgencyScore}).`;
}

function explain(t: EmailThread): string {
  return `${who(t)} — "${t.subject}"\nCategory ${t.category.replace("_", " ")}, urgency ${t.urgencyScore}, confidence ${t.aiConfidence}%. Routed to ${t.routeTo}.\nWhy: ${t.reasoning}${t.draftReply ? `\nDraft reply: "${t.draftReply}"` : ""}`;
}

const unknown = (): DemoReply => ({ answer: "I couldn't find an email matching that in your inbox." });

function command(q: string, threads: EmailThread[]): DemoReply | null {
  const verb = q.match(/^(?:please )?(draft|write|reply|snooze|archive|route|send|forward)\b/)?.[1];
  if (!verb) return null;
  if (verb === "reply" && !/^reply to/.test(q)) return null;

  const pool = verb === "send" ? threads : threads.filter(isActive);
  const found = findThread(q, pool);
  if (!found) return unknown();
  if ("ambiguous" in found) return { answer: `That could be more than one email: ${found.ambiguous.map(who).join(", ")}. Which one do you mean?` };
  const t = found.t;
  const target = [{ id: t.id, label: `${who(t)} — ${t.subject}` }];
  const cmd = (action: string, say: string): DemoReply => ({ answer: say, command: true, proposal: { action, summary: say, targets: target } });

  if (verb === "draft" || verb === "write" || verb === "reply") return cmd("draft_reply", `Drafting a reply to ${who(t)}.`);
  if (verb === "snooze") return cmd("snooze_threads", `Snoozing ${who(t)}'s email.`);
  if (verb === "archive") return cmd("archive_threads", `Archiving ${who(t)}'s email.`);
  if (verb === "route") return cmd("route_threads", `Routing ${who(t)}'s email.`);
  if (verb === "send" || verb === "forward") return cmd("send_reply", `Sending the reply to ${who(t)}.`);
  return null;
}

const HELP =
  'I can tell you what is urgent, which emails need a reply, and what you can ignore. You can also tell me what to do — "Draft a reply to Maya Chen", "Snooze Priya Shah\'s email", "Archive the HVAC Weekly newsletter", "Send Maya Chen the reply" — and I only stop to ask before anything is emailed or when something urgent is involved.';

export function buildDemoReply(question: string, threads: EmailThread[]): DemoReply {
  const q = question.trim().toLowerCase();
  if (threads.length === 0) return { answer: "Your inbox is empty." };

  const cmd = command(q, threads);
  if (cmd) return cmd;

  if (/urgent|priority|important|asap/.test(q)) return { answer: urgent(threads) };
  if (/need.*repl|repl.*need|respond|answer/.test(q)) return { answer: needReply(threads) };
  if (/ignore|skip|noise|low priority|can wait/.test(q)) return { answer: ignorable(threads) };
  const named = findThread(q, threads.filter((t) => t.status !== "blocked"));
  if (named && "t" in named && !/summar|overview/.test(q)) return { answer: explain(named.t) };
  if (/summar|overview|inbox|how.*(doing|going|looking)|status/.test(q)) return { answer: summary(threads) };
  return { answer: HELP };
}
