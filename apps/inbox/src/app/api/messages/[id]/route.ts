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
    if (payload.action === "approve") {
      // Approve draft = send/handoff → routed (product copy: appears on Routed)
      const message = await patchMessage(
        id,
        { status: "routed", needsReview: false, isRead: true },
        { actionType: "approve", humanOverride: true }
      );
      if (!message) return Response.json({ error: "Not found" }, { status: 404 });
      state = upsertDeskPatch(state, id, patchFromThread(message));
      return jsonWithDeskCookie({ message }, state);
    }
    if (payload.action === "route") {
      const message = await patchMessage(
        id,
        { status: "routed", needsReview: false, isRead: true },
        { actionType: "route", humanOverride: true }
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
        { actionType: "block", humanOverride: true }
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
