import { getSecret } from "@helix/core";
import type { DailyMarketingBrief } from "./daily-brief";
import { formatDailyBriefText } from "./daily-brief";
import type { WasteReport } from "./waste-report";

export function isSlackConfigured(): boolean {
  return Boolean(getSecret("SLACK_WEBHOOK_URL"));
}

export async function notifySlackDailyBrief(brief: DailyMarketingBrief): Promise<boolean> {
  const url = getSecret("SLACK_WEBHOOK_URL");
  if (!url) return false;
  const text = formatDailyBriefText(brief);
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      text,
      blocks: [{ type: "section", text: { type: "mrkdwn", text: `*Daily Marketing brief*\n${text}` } }],
    }),
    signal: AbortSignal.timeout(8_000),
  }).catch(() => null);
  return Boolean(res?.ok);
}

export function formatWasteReportText(report: WasteReport, syncLines: string[] = []): string {
  const m = report.metrics;
  const lines = [
    `${m.from} → ${m.to}: $${m.spendOnSpam.toFixed(2)} of $${m.totalSpend.toFixed(2)} spend went to spam leads (${Math.round(m.wastePct * 100)}%).`,
    ...syncLines,
    ...report.narrative.campaigns.slice(0, 3).map((c) => `  • ${c.name}: ${c.why}`),
    report.proposals.length
      ? `${report.proposals.length} proposal(s) waiting for a person to confirm in Helix (${report.proposals.map((p) => `${p.action === "pause_campaign" ? "pause" : "scale"} ${p.label}`).join(", ")}). Nothing was paused or scaled automatically.`
      : "No pause/scale proposals.",
    report.engine === "claude"
      ? `Explained by Claude · estimated AI cost $${(report.aiCost?.estimatedUsd ?? 0).toFixed(4)}`
      : "Deterministic analysis (no AI)",
  ];
  const app = process.env.HELIX_MARKETING_URL?.trim();
  if (app) lines.push(`Review: ${app.replace(/\/$/, "")}/waste`);
  return lines.join("\n");
}

export async function notifySlackWasteReport(report: WasteReport, syncLines: string[] = []): Promise<boolean> {
  const url = getSecret("SLACK_WEBHOOK_URL");
  if (!url) return false;
  const text = formatWasteReportText(report, syncLines);
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      text,
      blocks: [{ type: "section", text: { type: "mrkdwn", text: `*Ad spend waste report*\n${text}` } }],
    }),
    signal: AbortSignal.timeout(8_000),
  }).catch(() => null);
  return Boolean(res?.ok);
}
