import { corpusStats, ingestCorpusDoc, listCorpusDocs } from "@/lib/corpus-store";
import { recordAudit } from "@/lib/store";
import { requireOperator, operatorActor } from "@helix/core/operator";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const stats = corpusStats();
  return Response.json({
    docs: listCorpusDocs(),
    docCount: stats.docCount,
    chunkCount: stats.chunkCount,
  });
}

export async function POST(req: Request) {
  const denied = requireOperator(req);
  if (denied) return denied;
  let body: { title?: string; body?: string; practiceArea?: string } = {};
  try {
    body = (await req.json()) as typeof body;
  } catch {
    body = {};
  }
  const result = ingestCorpusDoc({
    title: body.title ?? "",
    body: body.body ?? "",
    practiceArea: body.practiceArea,
  });
  if ("error" in result) {
    return Response.json({ error: result.error }, { status: 400 });
  }
  await recordAudit(operatorActor(req), "corpus", `Ingested firm doc: ${result.title}`);
  return Response.json({ doc: result, ...corpusStats() });
}
