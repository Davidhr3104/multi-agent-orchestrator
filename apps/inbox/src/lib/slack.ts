import { getSecret } from "@helix/core";
import type { EmailThread } from "@/lib/types";
import { formatWeeklyReportText, type WeeklyReport } from "@/lib/weekly-report";

export function isSlackConfigured(): boolean {
  return Boolean(getSecret("SLACK_WEBHOOK_URL"));
}

/** Posts the weekly hours-saved report to Slack. Returns false (not silent) when Slack isn't configured or the post fails — callers decide how to surface that. */
export async function notifySlackWeeklyReport(report: WeeklyReport): Promise<boolean> {
  const url = getSecret("SLACK_WEBHOOK_URL");
  if (!url) return false;
  const text = formatWeeklyReportText(report);
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      text,
      blocks: [{ type: "section", text: { type: "mrkdwn", text: `*Weekly Inbox report*\n${text}` } }],
    }),
    signal: AbortSignal.timeout(8_000),
  }).catch(() => null);
  return Boolean(res?.ok);
}

/** Fire-and-forget ping when a buyer-intent thread lands — never blocks ingest on Slack being down. */
export async function notifySlackLeadIntent(thread: EmailThread): Promise<void> {
  const url = getSecret("SLACK_WEBHOOK_URL");
  if (!url) return;
  await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      text: `Buyer intent detected in Inbox: ${thread.fromName} — ${thread.subject}`,
      blocks: [
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `*Buyer intent detected* — ${thread.fromName} <${thread.fromEmail}>\n${thread.subject}`,
          },
        },
      ],
    }),
    signal: AbortSignal.timeout(8_000),
  }).catch(() => undefined);
}
