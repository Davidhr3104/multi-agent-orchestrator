import { listAllThreads, listMessages } from "@/lib/store";
import type { ThreadStatus } from "@/lib/types";
import { toInboxMessage } from "@/lib/types";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const status = url.searchParams.get("status");
  const needsReview = url.searchParams.get("needs_review");

  if (needsReview === "1" || needsReview === "true" || status === "review") {
    const all = await listMessages();
    const threads = all.filter((t) => t.needsReview);
    return Response.json({ threads });
  }

  const all = await listAllThreads();
  let threads = all.map(toInboxMessage);

  if (status === "routed" || status === "blocked" || status === "open" || status === "archived") {
    const st = status as ThreadStatus;
    threads = threads.filter((t) => t.status === st);
  } else if (status === "spam") {
    threads = threads.filter((t) => t.category === "spam" || t.status === "blocked");
  }

  return Response.json({ threads });
}
