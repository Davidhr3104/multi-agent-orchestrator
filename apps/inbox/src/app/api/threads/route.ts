import { listAllThreads, listMessages, applyDeskPatches } from "@/lib/store";
import type { ThreadStatus } from "@/lib/types";
import { toInboxMessage } from "@/lib/types";
import { applyThreadPatches, readDeskCookie } from "@/lib/desk-state-cookie";
import { isOverdue } from "@helix/core/inbox/business-days";
import { getAgentProfile } from "@/lib/agent-profile";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const status = url.searchParams.get("status");
  const needsReview = url.searchParams.get("needs_review");
  const overdueParam = url.searchParams.get("overdue");
  const state = readDeskCookie(req);
  applyDeskPatches(state.patches);

  if (needsReview === "1" || needsReview === "true" || status === "review") {
    const all = applyThreadPatches(await listMessages(), state.patches);
    const threads = all.filter((t) => t.needsReview);
    return Response.json({ threads });
  }

  const all = applyThreadPatches(
    (await listAllThreads()).map(toInboxMessage),
    state.patches
  );
  let threads = all;

  if (status === "routed" || status === "sent") {
    threads = threads.filter((t) => t.status === "routed" || t.status === "sent");
  } else if (status === "blocked" || status === "open" || status === "archived") {
    const st = status as ThreadStatus;
    threads = threads.filter((t) => t.status === st);
  } else if (status === "spam") {
    threads = threads.filter((t) => t.category === "spam" || t.status === "blocked");
  }

  if (overdueParam === "true") {
    const hours = getAgentProfile().followUpHours;
    threads = threads.filter((t) => {
      if (t.status !== "sent" || !t.lastReplySentAt) return false;
      const elapsed = Date.now() - Date.parse(t.lastReplySentAt);
      return isOverdue(t.lastReplySentAt) || elapsed >= hours * 3_600_000;
    });
  }

  return Response.json({ threads });
}
