import { getSecret } from "@helix/core";
import { cronAuth, runSocialCron } from "@/lib/social/cron";

export const runtime = "nodejs";
export const maxDuration = 120;

/** Vercel Cron: ?task=refresh reads insights, ?task=weekly also prepares drafts for review and the weekly report. Never publishes. */
export async function GET(req: Request) {
  const auth = cronAuth(req.headers.get("authorization"), getSecret("CRON_SECRET"));
  if (auth === "no_secret") return Response.json({ error: "CRON_SECRET is not set, so this route is closed." }, { status: 503 });
  if (auth === "denied") return Response.json({ error: "Unauthorized" }, { status: 401 });
  const task = new URL(req.url).searchParams.get("task") === "weekly" ? "weekly" : "refresh";
  return Response.json(await runSocialCron(task));
}
