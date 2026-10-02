import { deskErrorResponse } from "@/lib/http-error";
import { approveFromReviewToken, commentFromReviewToken } from "@/lib/store";

export const runtime = "nodejs";

export async function POST(req: Request) {
  let body: { token?: unknown; id?: unknown; action?: unknown; body?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return Response.json({ error: "JSON body required" }, { status: 400 });
  }
  if (typeof body.token !== "string" || typeof body.id !== "string") return Response.json({ error: "A review token and a post are required." }, { status: 400 });
  try {
    if (body.action === "comment" && typeof body.body === "string") {
      const ok = await commentFromReviewToken(body.token, body.id, body.body);
      if (!ok) return Response.json({ error: "This review link is not active." }, { status: 404 });
      return Response.json({ ok: true });
    }
    const ok = await approveFromReviewToken(body.token, body.id);
    if (!ok) return Response.json({ error: "This review link is not active." }, { status: 404 });
    return Response.json({ ok: true });
  } catch (err) {
    const mapped = deskErrorResponse(err);
    if (mapped) return mapped;
    throw err;
  }
}
