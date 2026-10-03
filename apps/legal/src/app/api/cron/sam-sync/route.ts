import { verifyCronRequest } from "@/lib/cron-auth";
import { importSamOpportunities, profileImportFilters } from "@/lib/sam-import";
import { deskStatus } from "@/lib/store";

export const runtime = "nodejs";
export const maxDuration = 300;

/**
 * Daily SAM.gov sync (see vercel.json). Queues new notices that match the firm profile as "proposed for
 * review". It never records a Go/No-Go: the partner does that in the desk.
 */
export async function GET(req: Request) {
  const auth = verifyCronRequest(req);
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status });

  await deskStatus();
  // Two days back with dedupe by notice ID, so a late or skipped run does not drop notices.
  const result = await importSamOpportunities({ filters: profileImportFilters(2), via: "cron" });
  return Response.json(result, { status: result.status === "error" ? 502 : 200 });
}
