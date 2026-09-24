import { getSecret } from "@helix/core";
import type { DailyMarketingBrief } from "./daily-brief";
import { formatDailyBriefText } from "./daily-brief";

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
