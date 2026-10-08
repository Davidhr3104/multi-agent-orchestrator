import type { DeskConnections } from "./catalog";

/**
 * What this Helix already does on a schedule, shown so the person can see it. These are the cron jobs in
 * vercel.json, not automations the new runner executes, so they are read-only here and their state is
 * "ready" only in the sense that the settings they need are present. It does not prove the last run happened.
 */

export type BuiltinInfo = {
  id: string;
  name: string;
  what: string;
  schedule: string;
  needs: { label: string; ok: boolean; fixUrl: string }[];
  ready: boolean;
};

export function builtinAutomations(conn: DeskConnections, ctx: { gmailConnected: boolean; cronSecret: boolean }): BuiltinInfo[] {
  const mk = (b: Omit<BuiltinInfo, "ready">): BuiltinInfo => ({ ...b, ready: b.needs.every((n) => n.ok) });
  return [
    mk({
      id: "builtin-weekly-report",
      name: "Weekly report to Slack",
      what: "Posts last week's threads handled, spam blocked and estimated hours saved.",
      schedule: "Mondays at 14:00 UTC (Vercel cron)",
      needs: [
        { label: "Slack webhook", ok: conn.slack, fixUrl: "/settings" },
        { label: "Cron secret", ok: ctx.cronSecret, fixUrl: "/settings" },
      ],
    }),
    mk({
      id: "builtin-daily-triage",
      name: "Daily mailbox triage",
      what: "Pulls new mail, classifies it and prepares drafts for your review. It never sends anything.",
      schedule: "Every day at 12:00 UTC (Vercel cron)",
      needs: [
        { label: "Gmail connected", ok: ctx.gmailConnected, fixUrl: "/integrations" },
        { label: "Cron secret", ok: ctx.cronSecret, fixUrl: "/settings" },
      ],
    }),
  ];
}
