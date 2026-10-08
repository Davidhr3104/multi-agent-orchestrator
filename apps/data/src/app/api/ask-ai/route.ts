import { buildDataAskReply } from "@/lib/ask";
import { getBundle, listBundles } from "@/lib/store";
import { visitorFromRequest, withVisitorCookie } from "@/lib/visitor";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const visitor = visitorFromRequest(req);
  let body: { question?: string; datasetId?: string } = {};
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return withVisitorCookie(req, Response.json({ error: "JSON required." }, { status: 400 }));
  }
  const question = body.question?.trim();
  if (!question) return withVisitorCookie(req, Response.json({ error: "question required." }, { status: 400 }));
  const bundles = body.datasetId
    ? ([await getBundle(body.datasetId, visitor.id)].filter(Boolean) as NonNullable<Awaited<ReturnType<typeof getBundle>>>[])
    : await listBundles(visitor.id);
  const reply = buildDataAskReply(question, bundles);
  return withVisitorCookie(
    req,
    Response.json({
      answer: reply.answer,
      cites: reply.cites,
      engine: "fallback",
      demo: bundles.some((b) => b.dataset.invented),
    })
  );
}
