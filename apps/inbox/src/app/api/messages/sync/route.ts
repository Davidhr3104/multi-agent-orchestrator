import { fetchGmailInbox } from "@/lib/gmail";
import { ingestMessage, listAllThreads } from "@/lib/store";
import { requireOperator } from "@helix/core/operator";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const denied = requireOperator(req);
  if (denied) return denied;
  const fetched = await fetchGmailInbox();
  if ("error" in fetched) {
    return Response.json({ error: fetched.error }, { status: fetched.status });
  }
  const existing = await listAllThreads();
  const seen = new Set(existing.map((t) => t.externalThreadId).filter(Boolean));
  const ingested = [];
  for (const row of fetched) {
    if (seen.has(row.externalThreadId)) continue;
    seen.add(row.externalThreadId);
    ingested.push(await ingestMessage(row));
  }
  return Response.json({ imported: ingested.length, scanned: fetched.length });
}
