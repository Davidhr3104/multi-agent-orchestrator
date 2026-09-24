import { getSecret } from "@helix/core";
import { getSnapshot } from "@/lib/store";
import { summarizeDailyBrief } from "@/lib/daily-brief";
import { notifySlackDailyBrief } from "@/lib/slack";

export const runtime = "nodejs";

/**
 * GET returns today's brief as JSON. When called with a valid CRON_SECRET
 * bearer token (Vercel Cron sends this automatically when CRON_SECRET is
 * set as an env var), it also posts to Slack — see vercel.json for the
 * schedule. Without CRON_SECRET configured, stays JSON-only for anyone.
 */
export async function GET(req: Request) {
  const snapshot = await getSnapshot("7d");
  const brief = summarizeDailyBrief(snapshot);

  const cronSecret = getSecret("CRON_SECRET");
  const authHeader = req.headers.get("authorization");
  const isCronTrigger = Boolean(cronSecret) && authHeader === `Bearer ${cronSecret}`;

  if (isCronTrigger) {
    const posted = await notifySlackDailyBrief(brief);
    return Response.json({ brief, postedToSlack: posted });
  }
  return Response.json({ brief, postedToSlack: false });
}
