import { DEFAULT_WORKSPACE_ID, DEFAULT_TO_EMAIL } from "@/lib/types";
import { getPreferences, listAiLogs, listAllThreads, applyDeskPatches } from "@/lib/store";
import { isSupabaseConfigured } from "@/lib/supabase-desk";
import { applyThreadPatches, readDeskCookie } from "@/lib/desk-state-cookie";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const state = readDeskCookie(req);
  applyDeskPatches(state.patches);
  const threads = applyThreadPatches(await listAllThreads(), state.patches);
  const preferences = await getPreferences();
  const logs = await listAiLogs();
  return Response.json({
    workspace: {
      id: DEFAULT_WORKSPACE_ID,
      name: "Northwind EA",
      email: DEFAULT_TO_EMAIL,
    },
    persistence: isSupabaseConfigured() ? "supabase" : "memory+cookie",
    counts: {
      open: threads.filter((t) => t.status === "open" || t.status === "review").length,
      review: threads.filter((t) => t.needsReview).length,
      routed: threads.filter((t) => t.status === "routed").length,
      blocked: threads.filter((t) => t.status === "blocked").length,
      starred: threads.filter((t) => t.isStarred).length,
    },
    preferences,
    recentActions: logs.slice(0, 8),
  });
}
