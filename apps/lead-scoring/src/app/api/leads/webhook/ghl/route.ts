import { parseGhlWebhook, type LeadStreamEvent } from "@helix/core";
import { finishLeadIngest } from "@/lib/finish-ingest";

export const runtime = "nodejs";

/**
 * Inbound GHL form/webhook — legacy, unscoped path. Kept for existing GHL
 * integrations already pointed at this URL; ingests into the legacy/no-org
 * bucket (same as before org tenancy existed). For per-org isolation, create
 * a new webhook URL in Settings and point GHL at
 * /api/leads/webhook/ghl/[token] instead — GHL calls this server-to-server
 * with no session, so org identity has to come from the URL itself, not a
 * signed-in user (see withOrgScope, which is for browser sessions).
 */
export async function POST(req: Request) {
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
    const lead = await finishLeadIngest(parsed, (event) => events.push(event));
    return Response.json({ lead, logs: events.filter((e) => e.type === "log").map((e) => e.log) });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return Response.json({ error: message }, { status: 500 });
  }
}
