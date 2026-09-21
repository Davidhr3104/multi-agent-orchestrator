import { reviewCatalogDraft } from "@/lib/store";

export const runtime = "nodejs";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  let body: { decision?: string } = {};
  try {
    body = (await req.json()) as { decision?: string };
  } catch {
    body = {};
  }
  if (body.decision !== "approved" && body.decision !== "rejected") {
    return Response.json({ error: "decision must be approved or rejected." }, { status: 400 });
  }
  const draft = await reviewCatalogDraft(id, body.decision);
  if (!draft) return Response.json({ error: "Draft not found" }, { status: 404 });
  return Response.json({ draft });
}
