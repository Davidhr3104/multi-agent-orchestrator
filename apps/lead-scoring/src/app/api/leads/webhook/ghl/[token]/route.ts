import { parseGhlWebhook, type LeadStreamEvent } from "@helix/core";
import { finishLeadIngest } from "@/lib/finish-ingest";
import { orgIdForWebhookToken } from "@/lib/org-auth";

export const runtime = "nodejs";

/**
 * Inbound GHL form/webhook, scoped to one org by a token in the URL — GHL
 * calls this server-to-server with no session/cookie, so org identity has
 * to be encoded in the URL, not read from a signed-in user.
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const orgId = await orgIdForWebhookToken(token);
  if (!orgId) {
    return Response.json({ error: "Unknown webhook token" }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "JSON inválido" }, { status: 400 });
  }

  const parsed = parseGhlWebhook(body);
  if (typeof parsed === "string") {
    return Response.json({ error: parsed }, { status: 400 });
  }

  const events: LeadStreamEvent[] = [];
  try {
    const lead = await finishLeadIngest(parsed, (event) => events.push(event), orgId);
    return Response.json({ lead, logs: events.filter((e) => e.type === "log").map((e) => e.log) });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return Response.json({ error: message }, { status: 500 });
  }
}
