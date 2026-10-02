import { deskWriteDenied, humanActor } from "@/lib/ai-desk";
import { deskErrorResponse } from "@/lib/http-error";
import { cascadePost, composeFromText, ensureReviewToken, evergreenCopy, fillOpenDays, setAutopilot } from "@/lib/store";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const denied = deskWriteDenied(req);
  if (denied) return denied;
  let body: { action?: unknown; text?: unknown; id?: unknown; months?: unknown; on?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return Response.json({ error: "JSON body required" }, { status: 400 });
  }
  const actor = humanActor(req);
  try {
    if (body.action === "compose" && typeof body.text === "string") {
      const post = await composeFromText(body.text, actor);
      return Response.json({ message: post.status === "needs_review" ? "Draft is in review. Nothing was published." : "Draft saved. Nothing was published.", href: `/posts/${post.id}` });
    }
    if (body.action === "fill") {
      const count = await fillOpenDays(actor);
      return Response.json({ message: count ? `Added ${count} draft${count === 1 ? "" : "s"} for empty days. Each one still needs approval.` : "The next 3 days already have posts." });
    }
    if (body.action === "cascade" && typeof body.id === "string") {
      const ids = await cascadePost(body.id, actor);
      return Response.json({ message: `Added ${ids.length} channel draft${ids.length === 1 ? "" : "s"}.`, href: `/posts/${ids[0]}` });
    }
    if (body.action === "evergreen" && typeof body.id === "string") {
      const months = body.months === 6 ? 6 : 3;
      const post = await evergreenCopy(body.id, months, actor);
      return Response.json({ message: `Scheduled a later copy ${months} months out. It is waiting for approval.`, href: `/posts/${post.id}` });
    }
    if (body.action === "autopilot") {
      const on = body.on === true;
      const result = await setAutopilot(on, actor);
      const message = on
        ? result.filled
          ? `Autopilot added ${result.filled} draft${result.filled === 1 ? "" : "s"} for empty days. Each one still needs approval.`
          : "Autopilot is on. The next 3 days already have posts."
        : "Autopilot is off.";
      return Response.json({ message, on: result.on });
    }
    if (body.action === "review-link") {
      const token = await ensureReviewToken();
      return Response.json({ message: "Review link is ready on this desk.", href: `/review/${token}` });
    }
    return Response.json({ error: "Unknown action" }, { status: 400 });
  } catch (err) {
    const mapped = deskErrorResponse(err);
    if (mapped) return mapped;
    throw err;
  }
}
