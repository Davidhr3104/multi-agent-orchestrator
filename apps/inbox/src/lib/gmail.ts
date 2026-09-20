import {
  getValidGmailAccessToken,
  getValidGmailAccessTokenForAccount,
  isGmailAccountConfigured,
} from "@/lib/gmail-oauth";
import { supabaseListEmailAccounts } from "@/lib/supabase-desk";
import { DEFAULT_WORKSPACE_ID } from "@/lib/types";

export type GmailIngest = {
  fromName: string;
  fromEmail: string;
  subject: string;
  body: string;
  externalThreadId: string;
  gmailMessageId: string;
  rfcMessageId?: string;
  emailAccountId?: string;
};

/** True if EITHER a real OAuth account or the legacy pasted token exists — actual token validity/refresh is checked per-call in fetchGmailInbox. */
export async function isGmailConfigured(): Promise<boolean> {
  const accounts = await supabaseListEmailAccounts(DEFAULT_WORKSPACE_ID);
  return accounts.some((a) => Boolean(a.accessToken)) || isGmailAccountConfigured();
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

function b64urlEncode(data: string): string {
  return Buffer.from(data, "utf8").toString("base64url");
}

/**
 * Sends a reply via the Gmail API into the original thread — uses the
 * recipient's own Gmail message id (threadId) plus RFC In-Reply-To/References
 * headers built from the original Message-Id, so it lands as a reply the
 * recipient sees in their existing conversation, not a disconnected new
 * email (which is what the Resend fallback sends).
 */
export async function sendGmailReply(input: {
  to: string;
  fromEmail: string;
  subject: string;
  text: string;
  threadId: string;
  inReplyToRfcId?: string;
  /** Which connected mailbox to send from — required when the workspace has more than one (ops@, support@, ...); falls back to the workspace's first mailbox when omitted. */
  emailAccountId?: string;
}): Promise<{ id: string; threadId: string } | { error: string; status: number }> {
  const resolved = input.emailAccountId
    ? await getValidGmailAccessTokenForAccount(input.emailAccountId)
    : await getValidGmailAccessToken();
  if (!resolved.ok) {
    return { error: resolved.error, status: 409 };
  }

  const subject = input.subject.startsWith("Re:") ? input.subject : `Re: ${input.subject}`;
  const headerLines = [
    `To: ${input.to}`,
    `From: ${input.fromEmail}`,
    `Subject: ${subject}`,
    "MIME-Version: 1.0",
    "Content-Type: text/plain; charset=UTF-8",
  ];
  if (input.inReplyToRfcId) {
    headerLines.push(`In-Reply-To: ${input.inReplyToRfcId}`, `References: ${input.inReplyToRfcId}`);
  }
  const raw = b64urlEncode(`${headerLines.join("\r\n")}\r\n\r\n${input.text}`);

  const res = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
    method: "POST",
    headers: { Authorization: `Bearer ${resolved.token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ raw, threadId: input.threadId }),
    signal: AbortSignal.timeout(15_000),
  });
  const payload = (await res.json().catch(() => ({}))) as { id?: string; threadId?: string; error?: { message?: string } };
  if (!res.ok || !payload.id) {
    return { error: payload.error?.message || `Gmail send HTTP ${res.status}`, status: 502 };
  }
  return { id: payload.id, threadId: payload.threadId || input.threadId };
}

/** Syncs one specific connected mailbox by account id — the multi-mailbox path used by sync/route.ts. */
export async function fetchGmailInboxForAccount(
  accountId: string,
  limit = 15
): Promise<GmailIngest[] | { error: string; status: number }> {
  const resolved = await getValidGmailAccessTokenForAccount(accountId);
  if (!resolved.ok) {
    return { error: resolved.error, status: 409 };
  }
  const rows = await fetchWithToken(resolved.token, limit);
  if ("error" in rows) return rows;
  return rows.map((r) => ({ ...r, emailAccountId: accountId }));
}

/** Legacy single-mailbox path: resolves the workspace's first connected account (or the legacy pasted token). */
export async function fetchGmailInbox(limit = 15): Promise<GmailIngest[] | { error: string; status: number }> {
  const resolved = await getValidGmailAccessToken();
  if (!resolved.ok) {
    return { error: resolved.error, status: 409 };
  }
  const rows = await fetchWithToken(resolved.token, limit);
  if ("error" in rows) return rows;
  return rows.map((r) => ({ ...r, emailAccountId: resolved.account?.id }));
}

async function fetchWithToken(token: string, limit: number): Promise<GmailIngest[] | { error: string; status: number }> {
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
    const rfcMessageId = header(headers, "Message-Id") || header(headers, "Message-ID") || undefined;
    out.push({
      fromName: from.name,
      fromEmail: from.email,
      subject,
      body,
      externalThreadId: msg.threadId || row.id,
      gmailMessageId: row.id,
      rfcMessageId,
    });
  }
  return out;
}
