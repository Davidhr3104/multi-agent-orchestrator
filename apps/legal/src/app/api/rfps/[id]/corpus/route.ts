import { patchRfp } from "@/lib/store";

export const runtime = "nodejs";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const rfp = await patchRfp(id, { corpusStatus: "mocked" });
  if (!rfp) return Response.json({ error: "RFP not found" }, { status: 404 });
  return Response.json({
    rfp,
    note: "Corpus query mocked. pgvector RAG is out of this MVP.",
  });
}
