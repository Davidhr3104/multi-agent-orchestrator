import { getSecret } from "@helix/core";
import { claudeReady } from "@/lib/ai-claude";
import { isCronAuthorized, runNightlyMatching } from "@/lib/nightly";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Vercel Cron calls this nightly with "Authorization: Bearer $CRON_SECRET". It matches new or changed listings and
 * queues alert drafts for approval; it never sends a message. Without CRON_SECRET the route refuses to run.
 */
export async function GET(req: Request) {
  const secret = getSecret("CRON_SECRET");
  if (!secret) return Response.json({ error: "CRON_SECRET isn't set, so the nightly run is disabled." }, { status: 503 });
  if (!isCronAuthorized(req.headers.get("authorization"), secret)) return Response.json({ error: "Unauthorized." }, { status: 401 });
  const useAi = claudeReady() && getSecret("HELIX_NIGHTLY_AI").toLowerCase() !== "off";
  return Response.json(await runNightlyMatching({ useAi }));
}
