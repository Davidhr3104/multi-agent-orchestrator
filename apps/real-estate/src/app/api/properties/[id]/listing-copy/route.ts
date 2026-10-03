import { aiCtx, deskWriteDenied } from "@/lib/ai-desk";
import { writeListingCopy } from "@/lib/ai-copy";
import { getListingCopy, getProperty, logActivity, putListingCopy } from "@/lib/store";

export const runtime = "nodejs";

type Body = { action?: unknown; copy?: { portal?: unknown; social?: unknown; message?: unknown }; writer?: unknown };

/**
 * generate: Claude (or, without a key, the template) writes copy from the listing's own fields. Nothing is saved.
 * approve:  saves the agent's edited copy as approved. Helix still doesn't publish it anywhere.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = deskWriteDenied(req);
  if (denied) return denied;
  const { id } = await params;
  const p = await getProperty(id);
  if (!p) return Response.json({ error: "Listing not found." }, { status: 404 });
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return Response.json({ error: "JSON body required." }, { status: 400 });
  }

  if (body.action === "generate") return Response.json(await writeListingCopy(p));

  if (body.action === "approve") {
    const c = body.copy ?? {};
    const text = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");
    const portal = text(c.portal, 3000);
    const social = text(c.social, 1000);
    const message = text(c.message, 1000);
    if (!portal || !social || !message) return Response.json({ error: "All three texts are needed to approve." }, { status: 400 });
    const actor = aiCtx(req).actor;
    const approved = { propertyId: p.id, portal, social, message, writer: body.writer === "claude" ? ("claude" as const) : ("template" as const), approvedBy: actor, approvedAt: new Date().toISOString() };
    await putListingCopy(approved);
    await logActivity({ actor, action: "approve_listing_copy", kind: "run", via: "button", labels: [p.title], done: 1, failed: 0 });
    return Response.json({ approved });
  }

  if (body.action === "get") return Response.json({ approved: await getListingCopy(p.id) });
  return Response.json({ error: "action must be generate, approve or get." }, { status: 400 });
}
