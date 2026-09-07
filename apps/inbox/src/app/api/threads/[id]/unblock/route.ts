import { NextResponse } from "next/server";
import { patchMessage, applyDeskPatches } from "@/lib/store";
import {
  deskCookieHeader,
  patchFromThread,
  readDeskCookie,
  upsertDeskPatch,
} from "@/lib/desk-state-cookie";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  try {
    let state = readDeskCookie(req);
    applyDeskPatches(state.patches);
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
    if (!message) return NextResponse.json({ error: "Not found" }, { status: 404 });
    state = upsertDeskPatch(state, id, patchFromThread(message));
    return NextResponse.json(
      { success: true, message },
      { headers: { "Set-Cookie": deskCookieHeader(state) } }
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
