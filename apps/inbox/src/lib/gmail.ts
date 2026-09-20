import { getSecret } from "@helix/core";

export type GmailIngest = {
  fromName: string;
  fromEmail: string;
  subject: string;
  body: string;
  externalThreadId: string;
};

export function isGmailConfigured(): boolean {
  return Boolean(getSecret("GMAIL_ACCESS_TOKEN"));
}

function b64url(data: string): string {
  return Buffer.from(data.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");
}

function header(headers: Array<{ name?: string; value?: string }> | undefined, name: string): string {
  return headers?.find((h) => h.name?.toLowerCase() === name.toLowerCase())?.value?.trim() || "";
}

function parseFrom(raw: string): { name: string; email: string } {
  const angle = raw.match(/^(.*?)<([^>]+)>/);
  if (angle) return { name: angle[1].trim().replace(/^"|"$/g, "") || angle[2], email: angle[2].trim() };
  if (raw.includes("@")) return { name: raw, email: raw };
  return { name: raw || "Unknown", email: raw };
}

function extractBody(payload: { mimeType?: string; body?: { data?: string }; parts?: unknown[] } | undefined): string {
  if (!payload) return "";
  if (payload.body?.data) return b64url(payload.body.data);
  const parts = Array.isArray(payload.parts) ? (payload.parts as Array<typeof payload>) : [];
  const text = parts.find((p) => p.mimeType === "text/plain");
  if (text?.body?.data) return b64url(text.body.data);
  const html = parts.find((p) => p.mimeType === "text/html");
  if (html?.body?.data) return b64url(html.body.data).replace(/<[^>]+>/g, " ");
  for (const part of parts) {
    const nested = extractBody(part);
    if (nested) return nested;
  }
  return "";
}

export async function fetchGmailInbox(limit = 15): Promise<GmailIngest[] | { error: string; status: number }> {
  const token = getSecret("GMAIL_ACCESS_TOKEN");
  if (!token) {
    return {
      error: "GMAIL_ACCESS_TOKEN required. Paste an OAuth access token in Settings.",
      status: 409,
    };
  }
  const listRes = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=${limit}&q=${encodeURIComponent("in:inbox newer_than:14d")}`,
    { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(15_000) }
  );
  if (!listRes.ok) {
    return { error: `Gmail list HTTP ${listRes.status}`, status: 502 };
  }
  const list = (await listRes.json()) as { messages?: Array<{ id?: string; threadId?: string }> };
  const out: GmailIngest[] = [];
  for (const row of list.messages ?? []) {
    if (!row.id) continue;
    const msgRes = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages/${row.id}?format=full`,
      { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(15_000) }
    );
    if (!msgRes.ok) continue;
    const msg = (await msgRes.json()) as {
      threadId?: string;
      snippet?: string;
      payload?: { headers?: Array<{ name?: string; value?: string }>; mimeType?: string; body?: { data?: string }; parts?: unknown[] };
    };
    const headers = msg.payload?.headers;
    const from = parseFrom(header(headers, "From"));
    const subject = header(headers, "Subject") || "(no subject)";
    const body = extractBody(msg.payload).trim() || msg.snippet || "";
    out.push({
      fromName: from.name,
      fromEmail: from.email,
      subject,
      body,
      externalThreadId: msg.threadId || row.id,
    });
  }
  return out;
}
