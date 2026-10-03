import { getSecret } from "@helix/core";
import { buildOrderProposals, lastPollRun } from "@/lib/order-automation";
import { isSlackConfigured } from "@/lib/slack";
import { currentDeskMode, lastShopifySyncAt, listOrders } from "@/lib/store";

export const runtime = "nodejs";

/** The approval queue is derived from stored orders, so it survives serverless restarts when Supabase is on. */
export async function GET() {
  const proposals = await buildOrderProposals(await listOrders());
  return Response.json({
    mode: currentDeskMode(),
    proposals,
    lastRun: lastPollRun(),
    lastShopifySyncAt: lastShopifySyncAt(),
    cronConfigured: Boolean(getSecret("CRON_SECRET")),
    slackConfigured: isSlackConfigured(),
  });
}
