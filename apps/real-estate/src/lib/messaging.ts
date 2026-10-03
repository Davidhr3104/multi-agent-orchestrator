import { getSecret } from "@helix/core";

/**
 * Real senders for approved drafts: email through Resend, SMS and WhatsApp through Twilio. Each one is active only
 * when its env vars are set, and reports "sent" only when the provider answered with a message id.
 */

export type Channel = "email" | "sms" | "whatsapp";
export const CHANNELS: Channel[] = ["email", "sms", "whatsapp"];
export const isChannel = (v: unknown): v is Channel => CHANNELS.includes(v as Channel);
export const CHANNEL_LABEL: Record<Channel, string> = { email: "Email", sms: "SMS", whatsapp: "WhatsApp" };

export type SendOk = { ok: true; provider: "resend" | "twilio"; providerId: string };
export type SendFail = { ok: false; error: string; notConfigured?: boolean };
export type SendResult = SendOk | SendFail;

export function resendConfig() {
  const apiKey = getSecret("RESEND_API_KEY");
  const from = getSecret("RESEND_FROM");
  return apiKey && from ? { apiKey, from } : null;
}

export function twilioConfig(channel: "sms" | "whatsapp") {
  const sid = getSecret("TWILIO_ACCOUNT_SID");
  const token = getSecret("TWILIO_AUTH_TOKEN");
  const from = (channel === "whatsapp" ? getSecret("TWILIO_WHATSAPP_FROM") : "") || getSecret("TWILIO_FROM");
  return sid && token && from ? { sid, token, from } : null;
}

export function channelReady(channel: Channel): boolean {
  return channel === "email" ? !!resendConfig() : !!twilioConfig(channel);
}

export const channelEnv: Record<Channel, string> = {
  email: "RESEND_API_KEY and RESEND_FROM",
  sms: "TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN and TWILIO_FROM",
  whatsapp: "TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN and TWILIO_FROM (or TWILIO_WHATSAPP_FROM)",
};

/** "+1 555 010 0101" -> "+15550100101"; null when it can't be an E.164 number. */
export function toE164(raw: string): string | null {
  const s = raw.trim();
  const digits = s.replace(/\D/g, "");
  if (digits.length < 8 || digits.length > 15) return null;
  if (s.startsWith("+")) return `+${digits}`;
  if (s.startsWith("00")) return `+${digits.slice(2)}`;
  return null;
}

const providerError = async (res: Response) => {
  try {
    const b = (await res.json()) as { message?: string; error?: { message?: string } };
    return (b.message ?? b.error?.message ?? "").slice(0, 200);
  } catch {
    return "";
  }
};

export async function sendEmailResend(msg: { to: string; subject: string; text: string }, fetchImpl: typeof fetch = fetch): Promise<SendResult> {
  const cfg = resendConfig();
  if (!cfg) return { ok: false, notConfigured: true, error: `Email isn't connected (set ${channelEnv.email}).` };
  try {
    const res = await fetchImpl("https://api.resend.com/emails", {
      method: "POST",
      headers: { authorization: `Bearer ${cfg.apiKey}`, "content-type": "application/json" },
      body: JSON.stringify({ from: cfg.from, to: [msg.to], subject: msg.subject, text: msg.text }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) {
      const detail = await providerError(res);
      return { ok: false, error: `Resend refused the email (${res.status})${detail ? `: ${detail}` : ""}.` };
    }
    const body = (await res.json().catch(() => null)) as { id?: string } | null;
    if (!body?.id) return { ok: false, error: "Resend answered without a message id, so delivery can't be confirmed." };
    return { ok: true, provider: "resend", providerId: body.id };
  } catch {
    return { ok: false, error: "Couldn't reach Resend." };
  }
}

export async function sendTwilio(msg: { to: string; body: string; channel: "sms" | "whatsapp" }, fetchImpl: typeof fetch = fetch): Promise<SendResult> {
  const cfg = twilioConfig(msg.channel);
  if (!cfg) return { ok: false, notConfigured: true, error: `${CHANNEL_LABEL[msg.channel]} isn't connected (set ${channelEnv[msg.channel]}).` };
  const to = toE164(msg.to);
  if (!to) return { ok: false, error: `"${msg.to}" isn't an international phone number (+country code).` };
  const prefix = msg.channel === "whatsapp" ? "whatsapp:" : "";
  const from = `${prefix}${cfg.from.replace(/^whatsapp:/, "")}`;
  try {
    const res = await fetchImpl(`https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(cfg.sid)}/Messages.json`, {
      method: "POST",
      headers: {
        authorization: `Basic ${Buffer.from(`${cfg.sid}:${cfg.token}`).toString("base64")}`,
        "content-type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({ To: `${prefix}${to}`, From: from, Body: msg.body }).toString(),
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) {
      const detail = await providerError(res);
      return { ok: false, error: `Twilio refused the message (${res.status})${detail ? `: ${detail}` : ""}.` };
    }
    const body = (await res.json().catch(() => null)) as { sid?: string; status?: string } | null;
    if (!body?.sid) return { ok: false, error: "Twilio answered without a message id, so delivery can't be confirmed." };
    return { ok: true, provider: "twilio", providerId: body.sid };
  } catch {
    return { ok: false, error: "Couldn't reach Twilio." };
  }
}
