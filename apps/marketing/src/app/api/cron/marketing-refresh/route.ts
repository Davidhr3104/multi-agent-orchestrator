import { cronAuth, runMarketingRefresh } from "@/lib/marketing-refresh";

export const runtime = "nodejs";
export const maxDuration = 60;

/** Vercel Cron (see vercel.json). Vercel sends `Authorization: Bearer $CRON_SECRET`. */
export async function GET(req: Request) {
  const auth = cronAuth(req);
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status });
  try {
    return Response.json(await runMarketingRefresh());
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
