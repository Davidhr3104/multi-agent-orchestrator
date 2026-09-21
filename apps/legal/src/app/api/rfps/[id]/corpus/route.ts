import { patchRfp, recordAudit, getRfp } from "@/lib/store";
import { queryFirmCorpus, corpusStats } from "@/lib/corpus-store";

export const runtime = "nodejs";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const existing = await getRfp(id);
  if (!existing) return Response.json({ error: "RFP not found" }, { status: 404 });

  const stats = corpusStats();
  if (stats.docCount === 0) {
    const rfp = await patchRfp(id, {
      corpusStatus: "unavailable",
      corpusHits: [],
    });
    return Response.json({
      rfp,
      hits: [],
      note: "Firm corpus empty — ingest playbooks under Documents before Ask corpus.",
    });
  }

  const hits = queryFirmCorpus(existing, 5);
  const corpusStatus = hits.length > 0 ? "live" : "unavailable";
  const rfp = await patchRfp(id, { corpusStatus, corpusHits: hits });
  if (!rfp) return Response.json({ error: "RFP not found" }, { status: 404 });

  await recordAudit(
    "ops",
    "corpus",
    hits.length
      ? `${rfp.title}: ${hits.length} live cite(s) from firm corpus`
      : `${rfp.title}: corpus queried — no overlapping precedents`
  );

  return Response.json({
    rfp,
    hits,
    note:
      hits.length > 0
        ? `Live corpus: ${hits.length} cite(s) from ${stats.docCount} firm document(s).`
        : "No firm precedents matched this RFP. Consider ingesting a closer playbook or mark NO-GO.",
  });
}
