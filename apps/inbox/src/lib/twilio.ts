import { getSecret } from "@helix/core";

/**
 * Twilio Messages API (SMS + WhatsApp). Only active when TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN and
 * TWILIO_FROM are set. Callers must have an explicit human confirmation before calling send —
 * this module never decides that on its own.
 */

export type TwilioChannel = "sms" | "whatsapp";

export type TwilioSendResult =
  | { ok: true; sid: string; status: string; channel: TwilioChannel; to: string }
  | { ok: false; error: string; status: number };

const E164 = /^\+[1-9]\d{6,14}$/;
export const TWILIO_BODY_LIMIT = 1600;

export function isTwilioConfigured(): boolean {
  return Boolean(getSecret("TWILIO_ACCOUNT_SID") && getSecret("TWILIO_AUTH_TOKEN") && getSecret("TWILIO_FROM"));
}

export function twilioStatus(): { configured: boolean; from: string | null } {
  if (!isTwilioConfigured()) return { configured: false, from: null };
  const from = getSecret("TWILIO_FROM").replace(/^whatsapp:/, "");
  return { configured: true, from: from.length > 4 ? `…${from.slice(-4)}` : from };
}

export function normalizePhone(raw: string): string | null {
  const cleaned = raw.replace(/^whatsapp:/i, "").replace(/[\s().-]/g, "");
  return E164.test(cleaned) ? cleaned : null;
}

function address(phone: string, channel: TwilioChannel): string {
  return channel === "whatsapp" ? `whatsapp:${phone}` : phone;
}

export async function sendTwilioMessage(input: { to: string; body: string; channel: TwilioChannel }): Promise<TwilioSendResult> {
  const sid = getSecret("TWILIO_ACCOUNT_SID");
  const token = getSecret("TWILIO_AUTH_TOKEN");
  const fromRaw = getSecret("TWILIO_FROM");
  if (!sid || !token || !fromRaw) {
    return { ok: false, status: 409, error: "Twilio is not connected: set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN and TWILIO_FROM." };
  }
  const to = normalizePhone(input.to);
  if (!to) return { ok: false, status: 400, error: `"${input.to}" is not a phone number in E.164 format (e.g. +5215512345678).` };
  const from = normalizePhone(fromRaw);
  if (!from) return { ok: false, status: 409, error: "TWILIO_FROM is not a valid E.164 phone number." };
  const body = input.body.trim();
  if (!body) return { ok: false, status: 400, error: "Message body is empty." };
  if (body.length > TWILIO_BODY_LIMIT) return { ok: false, status: 400, error: `Message is longer than ${TWILIO_BODY_LIMIT} characters.` };

  let res: Response;
  try {
    res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(sid)}/Messages.json`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({ To: address(to, input.channel), From: address(from, input.channel), Body: body }),
      signal: AbortSignal.timeout(10_000),
    });
  } catch (err) {
    return { ok: false, status: 502, error: `Twilio did not respond: ${err instanceof Error ? err.message : String(err)}` };
  }
  const data = (await res.json().catch(() => ({}))) as { sid?: string; status?: string; message?: string; code?: number };
  if (!res.ok || !data.sid) {
    return { ok: false, status: 502, error: `Twilio rejected the message (${res.status})${data.message ? `: ${data.message}` : ""}` };
  }
  return { ok: true, sid: data.sid, status: data.status ?? "queued", channel: input.channel, to };
}
