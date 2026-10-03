import { requireOperator } from "@helix/core/operator";
import { currentDeskMode } from "@/lib/store";
import { isTwilioConfigured, sendTwilioMessage, type TwilioChannel } from "@/lib/twilio";

export const runtime = "nodejs";

/**
 * Sends one SMS / WhatsApp message through Twilio. The caller must pass `confirmed: true`, which the
 * UI only sets after a person pressed Send on the exact text and number shown to them.
 */
export async function POST(req: Request) {
  const denied = requireOperator(req);
  if (denied) return denied;
  let body: { to?: unknown; body?: unknown; channel?: unknown; confirmed?: unknown };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "JSON body required" }, { status: 400 });
  }
  if (body.confirmed !== true) {
    return Response.json({ error: "Sending a message needs an explicit human confirmation (confirmed: true)." }, { status: 428 });
  }
  if (currentDeskMode() === "demo") {
    return Response.json({ sent: false, demo: true, message: "Demo desk: nothing was sent through Twilio." });
  }
  if (!isTwilioConfigured()) {
    return Response.json({ sent: false, error: "Twilio is not connected." }, { status: 409 });
  }
  const channel: TwilioChannel = body.channel === "whatsapp" ? "whatsapp" : "sms";
  const r = await sendTwilioMessage({ to: String(body.to ?? ""), body: String(body.body ?? ""), channel });
  if (!r.ok) return Response.json({ sent: false, error: r.error }, { status: r.status });
  return Response.json({ sent: true, sid: r.sid, twilioStatus: r.status, channel: r.channel, to: r.to });
}
