import { listAllThreads, patchMessage, regenerateSmartReply } from "@/lib/store";
import { getAgentProfile } from "@/lib/agent-profile";
import { isOverdue } from "@helix/core/inbox/business-days";

export const runtime = "nodejs";

export async function POST() {
  const hours = getAgentProfile().followUpHours;
  const threads = await listAllThreads();
  const drafted: string[] = [];
  for (const thread of threads) {
    if (thread.status !== "sent" || !thread.lastReplySentAt) continue;
    const elapsed = Date.now() - Date.parse(thread.lastReplySentAt);
    const due = isOverdue(thread.lastReplySentAt) || elapsed >= hours * 3_600_000;
    if (!due || thread.reasoning.includes("follow-up draft")) continue;
    const next = await regenerateSmartReply(thread.id);
    if (!next) continue;
    const draft = next.draftReply.startsWith("Following up")
      ? next.draftReply
      : `Following up — ${next.draftReply}`;
    await patchMessage(
      thread.id,
      { draftReply: draft, needsReview: true, reasoning: `${next.reasoning} · follow-up draft` },
      { actionType: "followup_draft", humanOverride: false }
    );
    drafted.push(thread.id);
  }
  return Response.json({ drafted, hours });
}
