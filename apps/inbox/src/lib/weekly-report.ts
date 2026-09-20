import type { EmailThread } from "@/lib/types";
import { summarizeInboxSla } from "@/lib/sla";

export type WeeklyReport = {
  periodStart: string;
  periodEnd: string;
  threadsHandled: number;
  spamBlocked: number;
  autoHandled: number;
  handedOffToLeads: number;
  hoursSaved: number;
  medianReplyAgeMin: number | null;
  breachCount: number;
  topSenders: { email: string; count: number }[];
};

function inWeek(thread: EmailThread, start: number, end: number): boolean {
  const t = Date.parse(thread.receivedAt || thread.createdAt);
  return Number.isFinite(t) && t >= start && t < end;
}

/**
 * A week's worth of "what Helix for Inbox did for you" — the story an EA or
 * founder can hand to their boss. periodEnd is exclusive; defaults to the
 * trailing 7 days ending now.
 */
export function summarizeWeek(
  allThreads: EmailThread[],
  opts?: { vipSenders?: string[]; now?: number }
): WeeklyReport {
  const now = opts?.now ?? Date.now();
  const periodEndMs = now;
  const periodStartMs = now - 7 * 86_400_000;

  const weekThreads = allThreads.filter((t) => inWeek(t, periodStartMs, periodEndMs));
  const sla = summarizeInboxSla(weekThreads, { vipSenders: opts?.vipSenders, now });

  const senderCounts = new Map<string, number>();
  for (const t of weekThreads) {
    senderCounts.set(t.fromEmail, (senderCounts.get(t.fromEmail) ?? 0) + 1);
  }
  const topSenders = [...senderCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([email, count]) => ({ email, count }));

  const handedOffToLeads = weekThreads.filter((t) => Boolean(t.handedOffAt)).length;

  return {
    periodStart: new Date(periodStartMs).toISOString(),
    periodEnd: new Date(periodEndMs).toISOString(),
    threadsHandled: weekThreads.length,
    spamBlocked: sla.spamBlocked,
    autoHandled: sla.autoHandled,
    handedOffToLeads,
    hoursSaved: sla.hoursSaved,
    medianReplyAgeMin: sla.medianOpenAgeMin,
    breachCount: sla.breachCount,
    topSenders,
  };
}

export function formatWeeklyReportText(report: WeeklyReport): string {
  const start = new Date(report.periodStart).toLocaleDateString("en-US", { month: "short", day: "numeric" });
  const end = new Date(report.periodEnd).toLocaleDateString("en-US", { month: "short", day: "numeric" });
  const lines = [
    `Weekly Inbox report — ${start} to ${end}`,
    `${report.threadsHandled} threads handled · ${report.hoursSaved}h saved`,
    `${report.spamBlocked} spam blocked · ${report.autoHandled} auto-handled · ${report.handedOffToLeads} handed off to Leads`,
    report.breachCount > 0 ? `${report.breachCount} SLA breaches this week` : "No SLA breaches this week",
  ];
  return lines.join("\n");
}
