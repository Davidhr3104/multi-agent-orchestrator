import {
  getMessage,
  listThreadMessages,
  patchMessage,
  regenerateSmartReply,
  snoozeThread,
  applyDeskPatches,
} from "@/lib/store";
import { queryInboxKb } from "@/lib/kb-store";
import {
  jsonWithDeskCookie,
  patchFromThread,
  readDeskCookie,
  upsertDeskPatch,
} from "@/lib/desk-state-cookie";
import { operatorActor, requireOperator } from "@helix/core/operator";
import { sendThreadReply } from "@/lib/reply-send";
import { sendToLeadsDesk } from "@/lib/leads-handoff";

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
  // I2: recompute kbHits on every read instead of trusting whatever was set
  // at ingest time — the ingest-time value lives only in the in-memory
  // thread object and does not survive a Supabase-backed cold start/restart,
  // so citations would silently vanish. Recomputing here is cheap (KB is a
  // small, cached, in-process corpus) and makes the drawer's citations
  // durable across restarts without a second migration/column.
  const kbHits = queryInboxKb({ subject: patched.subject, body: patched.body });
  return Response.json({ message: { ...patched, kbHits }, history });
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
      const result = await sendThreadReply(id, operatorActor(req));
      if (!result.ok) return Response.json({ error: result.error }, { status: result.status });
      state = upsertDeskPatch(state, id, patchFromThread(result.message));
      return jsonWithDeskCookie({ message: result.message, sentId: result.sentId, sentVia: result.sentVia }, state);
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
