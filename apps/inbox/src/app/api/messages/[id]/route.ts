import {
  getMessage,
  listThreadMessages,
  patchMessage,
  regenerateSmartReply,
  snoozeThread,
  applyDeskPatches,
} from "@/lib/store";
import {
  jsonWithDeskCookie,
  patchFromThread,
  readDeskCookie,
  upsertDeskPatch,
} from "@/lib/desk-state-cookie";
import { operatorActor, requireOperator } from "@helix/core/operator";
import { sendReply } from "@/lib/send";
import { sendGmailReply } from "@/lib/gmail";
import { sendToLeadsDesk } from "@/lib/leads-handoff";
import { supabaseGetEmailAccount, supabaseGetEmailAccountById } from "@/lib/supabase-desk";
import { DEFAULT_TO_EMAIL, DEFAULT_WORKSPACE_ID } from "@/lib/types";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const state = readDeskCookie(req);
  applyDeskPatches(state.patches);
  const message = await getMessage(id);
  if (!message) return Response.json({ error: "Not found" }, { status: 404 });
  const patched = state.patches[id] ? { ...message, ...state.patches[id] } : message;
  const history = await listThreadMessages(id);
  return Response.json({ message: patched, history });
}

export async function PATCH(req: Request, ctx: Ctx) {
  const denied = requireOperator(req);
  if (denied) return denied;
  const { id } = await ctx.params;
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const payload = body as {
    action?: string;
    until?: string;
    draftReply?: string;
    isStarred?: boolean;
    isRead?: boolean;
  };

  let state = readDeskCookie(req);
  applyDeskPatches(state.patches);

  try {
    if (payload.action === "approve" || payload.action === "send") {
      const current = await getMessage(id);
      if (!current) return Response.json({ error: "Not found" }, { status: 404 });

      const text = current.draftReply || current.body;
      // Reply from the exact mailbox that received this thread — a workspace
      // can have several connected (ops@, support@); falling back to "the"
      // workspace account would send from the wrong alias.
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
        if ("error" in gmailSent) {
          // Never fail silently and never fall back to a different provider
          // without saying so — a Gmail-thread reply failing and quietly
          // becoming a disconnected Resend email would confuse the sender
          // about whether/where the customer will actually see it.
          return Response.json({ error: `Gmail reply failed: ${gmailSent.error}` }, { status: gmailSent.status });
        }
        sentId = gmailSent.id;
        sentVia = "gmail";
      } else {
        const sent = await sendReply({ to: current.fromEmail, subject: current.subject, text });
        if ("error" in sent) {
          return Response.json({ error: sent.error }, { status: sent.status });
        }
        sentId = sent.id;
        sentVia = "resend";
      }

      const message = await patchMessage(
        id,
        { status: "sent", needsReview: false, isRead: true },
        { actionType: `send:${operatorActor(req)}:${sentVia}`, humanOverride: true }
      );
      if (!message) return Response.json({ error: "Not found" }, { status: 404 });
      state = upsertDeskPatch(state, id, patchFromThread(message));
      return jsonWithDeskCookie({ message, sentId, sentVia }, state);
    }
    if (payload.action === "handoff_leads") {
      const current = await getMessage(id);
      if (!current) return Response.json({ error: "Not found" }, { status: 404 });
      const result = await sendToLeadsDesk(current);
      if (!result.ok) {
        return Response.json({ error: result.error }, { status: 502 });
      }
      const message = await patchMessage(
        id,
        { routeTo: "Helix for Leads", handedOffAt: new Date().toISOString() },
        { actionType: `handoff_leads:${operatorActor(req)}`, humanOverride: true }
      );
      if (!message) return Response.json({ error: "Not found" }, { status: 404 });
      state = upsertDeskPatch(state, id, patchFromThread(message));
      return jsonWithDeskCookie({ message, leadId: result.leadId }, state);
    }
    if (payload.action === "route") {
      const message = await patchMessage(
        id,
        { status: "routed", needsReview: false, isRead: true },
        { actionType: `route:${operatorActor(req)}`, humanOverride: true }
      );
      if (!message) return Response.json({ error: "Not found" }, { status: 404 });
      state = upsertDeskPatch(state, id, patchFromThread(message));
      return jsonWithDeskCookie({ message }, state);
    }
    if (payload.action === "block") {
      const message = await patchMessage(
        id,
        {
          status: "blocked",
          needsReview: false,
          routeTo: "Spam",
          category: "spam",
          isRead: true,
        },
        { actionType: `block:${operatorActor(req)}`, humanOverride: true }
      );
      if (!message) return Response.json({ error: "Not found" }, { status: 404 });
      state = upsertDeskPatch(state, id, patchFromThread(message));
      return jsonWithDeskCookie({ message }, state);
    }
    if (payload.action === "unblock") {
      const message = await patchMessage(
        id,
        {
          status: "open",
          needsReview: true,
          category: "action_required",
          routeTo: "Sales · Deveku",
        },
        { actionType: "unblock", humanOverride: true }
      );
      if (!message) return Response.json({ error: "Not found" }, { status: 404 });
      state = upsertDeskPatch(state, id, patchFromThread(message));
      return jsonWithDeskCookie({ message }, state);
    }
    if (payload.action === "snooze") {
      const message = await snoozeThread(id, payload.until);
      if (!message) return Response.json({ error: "Not found" }, { status: 404 });
      state = upsertDeskPatch(state, id, patchFromThread(message));
      return jsonWithDeskCookie({ message }, state);
    }
    if (payload.action === "smart_reply") {
      const message = await regenerateSmartReply(id);
      if (!message) return Response.json({ error: "Not found" }, { status: 404 });
      state = upsertDeskPatch(state, id, patchFromThread(message));
      return jsonWithDeskCookie({ message }, state);
    }
    if (payload.action === "star") {
      const current = await getMessage(id);
      if (!current) return Response.json({ error: "Not found" }, { status: 404 });
      const message = await patchMessage(
        id,
        { isStarred: !current.isStarred },
        { actionType: "star", humanOverride: true }
      );
      if (!message) return Response.json({ error: "Not found" }, { status: 404 });
      state = upsertDeskPatch(state, id, patchFromThread(message));
      return jsonWithDeskCookie({ message }, state);
    }
    if (payload.action === "read") {
      const message = await patchMessage(
        id,
        { isRead: true },
        { actionType: "read", humanOverride: true }
      );
      if (!message) return Response.json({ error: "Not found" }, { status: 404 });
      state = upsertDeskPatch(state, id, patchFromThread(message));
      return jsonWithDeskCookie({ message }, state);
    }
    if (payload.draftReply != null) {
      const message = await patchMessage(
        id,
        { draftReply: String(payload.draftReply) },
        { actionType: "edit_draft", humanOverride: true }
      );
      if (!message) return Response.json({ error: "Not found" }, { status: 404 });
      state = upsertDeskPatch(state, id, patchFromThread(message));
      return jsonWithDeskCookie({ message }, state);
    }
    return Response.json({ error: "Unknown action" }, { status: 400 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return Response.json({ error: msg }, { status: 500 });
  }
}
