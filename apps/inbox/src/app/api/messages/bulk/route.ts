import { patchMessage, applyDeskPatches } from "@/lib/store";
import {
  jsonWithDeskCookie,
  patchFromThread,
  readDeskCookie,
  upsertDeskPatch,
} from "@/lib/desk-state-cookie";

export const runtime = "nodejs";

export async function POST(req: Request) {
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

  const results = [];
  for (const id of ids) {
    if (action === "route") {
      const message = await patchMessage(id, { status: "routed", needsReview: false, isRead: true }, {
        actionType: "bulk_route",
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
        { actionType: "bulk_block", humanOverride: true }
      );
      if (message) {
        state = upsertDeskPatch(state, id, patchFromThread(message));
        results.push(message);
      }
    } else if (action === "approve") {
      const message = await patchMessage(id, { status: "routed", needsReview: false, isRead: true }, {
        actionType: "bulk_approve",
        humanOverride: true,
      });
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
