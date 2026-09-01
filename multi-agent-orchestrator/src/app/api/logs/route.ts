import {
  isSupabaseConfigured,
  listLogsForRun,
  listRecentRuns,
} from "@/lib/supabase-logs";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const configured = isSupabaseConfigured();
  if (!configured) {
    return Response.json({ configured, runs: [], logs: [] });
  }

  const url = new URL(req.url);
  const runId = url.searchParams.get("runId");

  if (runId) {
    const logs = await listLogsForRun(runId);
    return Response.json({ configured, logs });
  }

  const runs = await listRecentRuns();
  return Response.json({ configured, runs });
}
