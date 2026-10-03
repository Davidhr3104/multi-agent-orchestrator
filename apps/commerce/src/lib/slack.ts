import { getSecret } from "@helix/core";
import type { DailyOpsBrief } from "./daily-brief";
import { formatDailyBriefText } from "./daily-brief";

export function isSlackConfigured(): boolean {
  return Boolean(getSecret("SLACK_WEBHOOK_URL"));
}

export type SlackOrderAlertLine = { label: string; usd: number; currency: string; fraudScore: number; action: string };

/** Alert for newly polled orders. States plainly that nothing was approved or cancelled automatically. */
export async function notifySlackOrderAlert(lines: SlackOrderAlertLine[], deskUrl?: string): Promise<boolean> {
  const url = getSecret("SLACK_WEBHOOK_URL");
  if (!url || lines.length === 0) return false;
  const text = [
    `${lines.length} new Shopify order${lines.length === 1 ? "" : "s"} need a human decision in Helix:`,
    ...lines.map((l) => `  • ${l.label} — ${l.usd.toFixed(2)} ${l.currency} (score ${l.fraudScore}) → proposed: ${l.action}`),
    "Nothing was approved or cancelled automatically.",
    deskUrl ? `Review: ${deskUrl}` : "",
  ]
    .filter(Boolean)
    .join("\n");
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
    signal: AbortSignal.timeout(8_000),
  }).catch(() => null);
  return Boolean(res?.ok);
}

export async function notifySlackDailyBrief(brief: DailyOpsBrief): Promise<boolean> {
  const url = getSecret("SLACK_WEBHOOK_URL");
  if (!url) return false;
  const text = formatDailyBriefText(brief);
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      text,
      blocks: [{ type: "section", text: { type: "mrkdwn", text: `*Daily Commerce brief*\n${text}` } }],
    }),
    signal: AbortSignal.timeout(8_000),
  }).catch(() => null);
  return Boolean(res?.ok);
}
