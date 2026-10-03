import { applyDeskPatches, getPreferences, listAllThreads } from "@/lib/store";
import { DESK_WINDOW_DAYS } from "@/lib/desk-metrics";
import { summarizeInboxSla } from "@/lib/sla";
import { applyThreadPatches, readDeskCookie } from "@/lib/desk-state-cookie";
import { toInboxMessage } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const state = readDeskCookie(req);
  applyDeskPatches(state.patches);
  const prefs = await getPreferences();
  const threads = applyThreadPatches(await listAllThreads(), state.patches);
  const sla = summarizeInboxSla(threads, { vipSenders: prefs.vipSenders, windowDays: DESK_WINDOW_DAYS });
  const open = threads
    .filter((t) => t.status === "open" || t.status === "review")
    .map(toInboxMessage)
    .sort((a, b) => b.urgencyScore - a.urgencyScore);
  return Response.json({ sla, threads: open, vipSenders: prefs.vipSenders });
}
