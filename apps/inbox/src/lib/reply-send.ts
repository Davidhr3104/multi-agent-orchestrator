import type { InboxMessage } from "@/lib/types";
import { getMessage, listThreadMessages, patchMessage } from "@/lib/store";
import { sendReply } from "@/lib/send";
import { sendGmailReply } from "@/lib/gmail";
import { supabaseGetEmailAccount, supabaseGetEmailAccountById } from "@/lib/supabase-desk";
import { DEFAULT_TO_EMAIL, DEFAULT_WORKSPACE_ID } from "@/lib/types";
import { guardrailReason } from "@/lib/agent-profile";

export type SendResult =
  | { ok: true; message: InboxMessage; sentId: string; sentVia: "gmail" | "resend" }
  | { ok: false; status: number; error: string };

/**
 * One implementation of "send this thread's reply", shared by the inspector's Send button and
 * Helix AI. It never fails silently and never falls back to a different provider without saying so.
 */
export async function sendThreadReply(id: string, actor: string, opts?: { human?: boolean }): Promise<SendResult> {
  const current = await getMessage(id);
  if (!current) return { ok: false, status: 404, error: "Not found" };
  const blocked = guardrailReason({ subject: current.subject, body: current.body, draft: current.draftReply });
  if (blocked && !opts?.human) return { ok: false, status: 409, error: blocked };

  const text = current.draftReply || current.body;
  // Reply from the exact mailbox that received this thread — a workspace can have several connected
  // (ops@, support@); falling back to "the" workspace account would send from the wrong alias.
  const account = current.emailAccountId
    ? await supabaseGetEmailAccountById(current.emailAccountId)
    : await supabaseGetEmailAccount(DEFAULT_WORKSPACE_ID);
  const canReplyInThread = Boolean(current.externalThreadId && account?.isConnected);

  let sentId: string;
  let sentVia: "gmail" | "resend";
  if (canReplyInThread) {
    const history = await listThreadMessages(id);
    const original = history[0];
    const gmailSent = await sendGmailReply({
      to: current.fromEmail,
      fromEmail: account?.emailAddress ?? DEFAULT_TO_EMAIL,
      subject: current.subject,
      text,
      threadId: current.externalThreadId!,
      inReplyToRfcId: original?.rfcMessageId,
      emailAccountId: account?.id,
    });
    if ("error" in gmailSent) return { ok: false, status: gmailSent.status, error: `Gmail reply failed: ${gmailSent.error}` };
    sentId = gmailSent.id;
    sentVia = "gmail";
  } else {
    const sent = await sendReply({ to: current.fromEmail, subject: current.subject, text });
    if ("error" in sent) return { ok: false, status: sent.status, error: sent.error };
    sentId = sent.id;
    sentVia = "resend";
  }

  const message = await patchMessage(
    id,
    { status: "sent", needsReview: false, isRead: true, lastReplySentAt: new Date().toISOString() },
    { actionType: `send:${actor}:${sentVia}`, humanOverride: true }
  );
  if (!message) return { ok: false, status: 404, error: "Not found" };
  return { ok: true, message, sentId, sentVia };
}
