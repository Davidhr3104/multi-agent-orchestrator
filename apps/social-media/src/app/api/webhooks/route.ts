import { deskWriteDenied } from "@/lib/ai-desk";
import { deskErrorResponse } from "@/lib/http-error";
import { addWebhook } from "@/lib/store";

export const runtime = "nodejs";

const EVENTS = ["post.approved", "post.internal_signoff", "post.rewritten", "post.autofix", "post.bulk_approved"];

export async function POST(req: Request) {
  const denied = deskWriteDenied(req);
  if (denied) return denied;
  let body: { url?: unknown; events?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return Response.json({ error: "JSON body required" }, { status: 400 });
  }
  if (typeof body.url !== "string") return Response.json({ error: "An https URL is required" }, { status: 400 });
  const events = Array.isArray(body.events) ? body.events.filter((event): event is string => EVENTS.includes(event as string)) : ["post.approved"];
  try {
    const hook = await addWebhook(body.url, events.length ? events : ["post.approved"]);
    return Response.json({ hook });
  } catch (err) {
    const mapped = deskErrorResponse(err);
    if (mapped) return mapped;
    throw err;
  }
}
