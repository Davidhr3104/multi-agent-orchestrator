import { getSecret } from "@helix/core";
import { listOrders } from "@/lib/store";
import { summarizeDailyBrief } from "@/lib/daily-brief";
import { notifySlackDailyBrief } from "@/lib/slack";
import { supabaseUpsertDailyRiskSnapshot } from "@/lib/supabase-commerce";

export const runtime = "nodejs";

/**
 * GET returns today's brief as JSON. When called with a valid CRON_SECRET
 * bearer token (Vercel Cron sends this automatically when CRON_SECRET is
 * set as an env var), it also posts to Slack — see vercel.json for the
 * schedule. Without CRON_SECRET configured, stays JSON-only for anyone.
 */
export async function GET(req: Request) {
  const orders = await listOrders();
  const brief = summarizeDailyBrief(orders);

  const cronSecret = getSecret("CRON_SECRET");
  const authHeader = req.headers.get("authorization");
  const isCronTrigger = Boolean(cronSecret) && authHeader === `Bearer ${cronSecret}`;

  if (isCronTrigger) {
    const posted = await notifySlackDailyBrief(brief);
    await supabaseUpsertDailyRiskSnapshot({
      date: brief.date,
      ordersCount: brief.ordersToday,
      highRiskCount: brief.highRiskCount,
      highRiskUsd: brief.highRiskUsd,
      savedUsd: brief.savedTodayUsd,
    });
    return Response.json({ brief, postedToSlack: posted });
  }
  return Response.json({ brief, postedToSlack: false });
}
