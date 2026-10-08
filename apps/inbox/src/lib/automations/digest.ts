import { deskCounts } from "@/lib/desk-metrics";
import { isSpamBlocked, slaBucketFor, TARGETS, threadAgeMin } from "@/lib/sla";
import type { EmailThread } from "@/lib/types";
import { SOURCES } from "./catalog";

/**
 * Deterministic content for an automation message. Every number is read from the same `deskCounts` the
 * dashboard, SLA page and weekly report use, so the 9 pm summary can never disagree with the screen.
 * No AI is involved here; if a tone pass is ever added it only rewrites these sentences, never the figures.
 */

export type SourceFacts = {
  received: number;
  awaitingReview: number;
  slaBreaches: number;
  spamBlocked: number;
  /** Subjects of the top threads that need a person, most urgent first (max 3). */
  needsYou: string[];
};

export type SourceOutput = { title: string; text: string; facts: SourceFacts };

const plural = (n: number, word: string) => `${n} ${n === 1 ? word : /(ch|s|x|sh)$/.test(word) ? `${word}es` : `${word}s`}`;

function needsYou(threads: EmailThread[]): EmailThread[] {
  return threads
    .filter((t) => t.needsReview && !isSpamBlocked(t) && t.status !== "archived" && t.status !== "sent")
    .sort((a, b) => b.urgencyScore - a.urgencyScore)
    .slice(0, 3);
}

function who(t: EmailThread): string {
  return t.fromName || t.fromEmail;
}

function worstBreaches(threads: EmailThread[], now: number, vipSenders: string[]): { thread: EmailThread; lateMin: number }[] {
  const rows: { thread: EmailThread; lateMin: number }[] = [];
  for (const thread of threads) {
    const bucket = slaBucketFor(thread, vipSenders);
    if (!bucket) continue;
    const target = TARGETS[bucket];
    const age = threadAgeMin(thread, now);
    if (age > target && thread.status !== "archived" && thread.status !== "sent" && !isSpamBlocked(thread)) rows.push({ thread, lateMin: Math.round(age - target) });
  }
  return rows.sort((a, b) => b.lateMin - a.lateMin).slice(0, 3);
}

function lateText(min: number): string {
  if (min < 60) return `${min} min late`;
  const h = Math.round((min / 60) * 10) / 10;
  return `${h} h late`;
}

export function buildSourceText(node: string, threads: EmailThread[], opts: { now: number; vipSenders?: string[] }): SourceOutput {
  if (!SOURCES[node]) throw new Error(`Unknown source "${node}".`);
  const vip = opts.vipSenders ?? [];
  const day = deskCounts(threads, { now: opts.now, windowDays: 1, vipSenders: vip });
  const need = needsYou(threads);
  const facts: SourceFacts = {
    received: day.total,
    awaitingReview: day.reviewCount,
    slaBreaches: day.breachCount,
    spamBlocked: day.spamBlocked,
    needsYou: need.map((t) => t.subject),
  };

  if (node === "inbox.sla_breaches") {
    // Breaches are about open threads at any age, so they use the page's default window, not the last 24 hours.
    const all = deskCounts(threads, { now: opts.now, vipSenders: vip });
    facts.slaBreaches = all.breachCount;
    const worst = worstBreaches(threads, opts.now, vip);
    const lines = worst.map((w) => `• ${who(w.thread)} — "${w.thread.subject}" (${lateText(w.lateMin)})`);
    const text =
      all.breachCount === 0
        ? "SLA check: no thread is past its reply target."
        : `SLA check: ${plural(all.breachCount, "thread")} past ${all.breachCount === 1 ? "its" : "their"} reply target.${lines.length ? `\n${lines.join("\n")}` : ""}`;
    return { title: "SLA breaches", text, facts };
  }

  const lines = [
    `Inbox digest — last 24 hours`,
    `• ${plural(day.total, "thread")} received`,
    `• ${day.reviewCount} waiting for your review`,
    `• ${plural(day.breachCount, "SLA breach")}`,
    `• ${day.spamBlocked} spam blocked`,
  ];
  if (need.length) {
    lines.push("Needs you:");
    for (const t of need) lines.push(`  – ${who(t)}: "${t.subject}"`);
  }
  return { title: "Inbox digest", text: lines.join("\n"), facts };
}
