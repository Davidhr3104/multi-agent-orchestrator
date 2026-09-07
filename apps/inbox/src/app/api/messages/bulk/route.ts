import { patchMessage } from "@/lib/store";

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

  const results = [];
  for (const id of ids) {
    if (action === "route") {
      results.push(
        await patchMessage(id, { status: "routed", needsReview: false, isRead: true }, {
          actionType: "bulk_route",
          humanOverride: true,
        })
      );
    } else if (action === "block") {
      results.push(
        await patchMessage(
          id,
          { status: "blocked", needsReview: false, category: "spam", routeTo: "Spam", isRead: true },
          { actionType: "bulk_block", humanOverride: true }
        )
      );
    } else if (action === "approve") {
      results.push(
        await patchMessage(id, { status: "archived", needsReview: false, isRead: true }, {
          actionType: "bulk_approve",
          humanOverride: true,
        })
      );
    }
  }

  return Response.json({
    ok: true,
    updated: results.filter(Boolean).length,
  });
}
