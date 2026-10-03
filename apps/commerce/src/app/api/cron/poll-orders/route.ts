import { checkCronAuth, pollNewOrders } from "@/lib/order-automation";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Vercel Cron target (see vercel.json). Requires `Authorization: Bearer <CRON_SECRET>`, which Vercel
 * sends automatically when CRON_SECRET is set. Scores new Shopify orders and queues proposals only.
 */
export async function GET(req: Request) {
  const auth = checkCronAuth(req);
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status });
  const run = await pollNewOrders();
  return Response.json(run, { status: run.ok ? 200 : 502 });
}
