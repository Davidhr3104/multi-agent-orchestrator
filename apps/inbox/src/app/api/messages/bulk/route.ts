import { currentDeskMode, getMessage, patchMessage, applyDeskPatches } from "@/lib/store";
import {
  jsonWithDeskCookie,
  patchFromThread,
  readDeskCookie,
  upsertDeskPatch,
} from "@/lib/desk-state-cookie";
import { operatorActor } from "@helix/core/operator";
import { sendReply } from "@/lib/send";
import { deskWriteDenied } from "@/lib/ai-desk";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const denied = deskWriteDenied(req);
  if (denied) return denied;
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const payload = body as { ids?: string[]; action?: string };
  const ids = Array.isArray(payload.ids) ? payload.ids.filter(Boolean) : [];
  const action = payload.action;
  if (!ids.length || !action) {
    return Response.json({ error: "ids and action required" }, { status: 400 });
  }

  let state = readDeskCookie(req);
  applyDeskPatches(state.patches);
  const actor = operatorActor(req);

  const results = [];
  for (const id of ids) {
    if (action === "route") {
      const message = await patchMessage(id, { status: "routed", needsReview: false, isRead: true }, {
        actionType: `bulk_route:${actor}`,
        humanOverride: true,
      });
      if (message) {
        state = upsertDeskPatch(state, id, patchFromThread(message));
        results.push(message);
      }
    } else if (action === "block") {
      const message = await patchMessage(
        id,
        { status: "blocked", needsReview: false, category: "spam", routeTo: "Spam", isRead: true },
        { actionType: `bulk_block:${actor}`, humanOverride: true }
      );
      if (message) {
        state = upsertDeskPatch(state, id, patchFromThread(message));
        results.push(message);
      }
    } else if (action === "approve") {
      const thread = await getMessage(id);
      if (!thread) continue;
      const demo = currentDeskMode() === "demo";
      if (!demo) {
        const sent = await sendReply({
          to: thread.fromEmail,
          subject: thread.subject,
          text: thread.draftReply || thread.body,
        });
        if ("error" in sent) {
          return Response.json({ error: sent.error, id }, { status: sent.status });
        }
      }
      const message = await patchMessage(
        id,
        { status: "sent", needsReview: false, isRead: true },
        { actionType: `bulk_send:${actor}${demo ? ":demo" : ""}`, humanOverride: true }
      );
      if (message) {
        state = upsertDeskPatch(state, id, patchFromThread(message));
        results.push(message);
      }
    }
  }

  return jsonWithDeskCookie(
    {
      ok: true,
      updated: results.length,
      messages: results,
    },
    state
  );
}
