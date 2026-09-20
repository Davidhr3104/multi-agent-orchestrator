import { getSecret } from "@helix/core";

export function isResendConfigured(): boolean {
  return Boolean(getSecret("RESEND_API_KEY") && getSecret("RESEND_FROM"));
}

export async function sendReply(input: {
  to: string;
  subject: string;
  text: string;
}): Promise<{ id: string } | { error: string; status: number }> {
  const key = getSecret("RESEND_API_KEY");
  const from = getSecret("RESEND_FROM");
  if (!key || !from) {
    return {
      error: "RESEND_API_KEY and RESEND_FROM required. Paste them in Settings. Reply was not sent.",
      status: 409,
    };
  }
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [input.to],
      subject: input.subject.startsWith("Re:") ? input.subject : `Re: ${input.subject}`,
      text: input.text,
    }),
    signal: AbortSignal.timeout(15_000),
  });
  const payload = (await res.json().catch(() => ({}))) as { id?: string; message?: string };
  if (!res.ok || !payload.id) {
    return { error: payload.message || `Resend HTTP ${res.status}`, status: 502 };
  }
  return { id: payload.id };
}
