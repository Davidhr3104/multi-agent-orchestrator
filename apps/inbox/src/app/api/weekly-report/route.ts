import { getSecret } from "@helix/core";
import { getPreferences, listAllThreads } from "@/lib/store";
import { summarizeWeek } from "@/lib/weekly-report";
import { notifySlackWeeklyReport } from "@/lib/slack";

export const runtime = "nodejs";

/**
 * GET returns the current week's report as JSON — used by the /weekly-report
 * page. When called with a valid CRON_SECRET bearer token (Vercel Cron sends
 * this automatically when CRON_SECRET is set as an env var), it also posts
 * the report to Slack — this is the weekly delivery path, see vercel.json.
 * Without CRON_SECRET configured, the endpoint stays JSON-only for anyone —
 * that's an explicit tradeoff (see the secret's hint in Settings), not a
 * silent gap.
 */
export async function GET(req: Request) {
  const threads = await listAllThreads();
  const prefs = await getPreferences();
  const report = summarizeWeek(threads, { vipSenders: prefs.vipSenders });

  const cronSecret = getSecret("CRON_SECRET");
  const authHeader = req.headers.get("authorization");
  const isCronTrigger = Boolean(cronSecret) && authHeader === `Bearer ${cronSecret}`;

  if (isCronTrigger) {
    const posted = await notifySlackWeeklyReport(report);
    return Response.json({ report, postedToSlack: posted });
  }
  return Response.json({ report, postedToSlack: false });
}
