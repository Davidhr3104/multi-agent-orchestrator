import { checkCronAuth } from "@/lib/cron-auth";
import { runTriageCron } from "@/lib/cron-triage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: Request) {
  const denied = checkCronAuth(req);
  if (denied) return denied;
  return Response.json(await runTriageCron());
}
