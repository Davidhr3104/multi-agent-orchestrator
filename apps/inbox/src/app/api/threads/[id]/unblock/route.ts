import { NextResponse } from "next/server";
import { patchMessage } from "@/lib/store";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(_req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  try {
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
    return NextResponse.json({ success: true, message });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
