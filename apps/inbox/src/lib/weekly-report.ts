import type { EmailThread } from "@/lib/types";
import { inWindow, summarizeInboxSla } from "@/lib/sla";

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

  // Same definition of "thread" and the same estimate as every other page: windowed by receivedAt.
  const weekThreads = allThreads.filter((t) => inWindow(t, 7, now));
  const sla = summarizeInboxSla(allThreads, { vipSenders: opts?.vipSenders, now, windowDays: 7 });

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
    report.breachCount > 0 ? `${report.breachCount} open threads past their SLA target` : "No open thread is past its SLA target",
  ];
  return lines.join("\n");
}
