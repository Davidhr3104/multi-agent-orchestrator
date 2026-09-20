import { parseGhlWebhook, type LeadStreamEvent } from "@helix/core";
import { finishLeadIngest } from "@/lib/finish-ingest";

export const runtime = "nodejs";

/**
 * Inbound GHL form/webhook. Returns the scored lead as JSON (webhooks cannot consume SSE).
 * Maps campaign / UTM / phone when the payload includes them.
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
