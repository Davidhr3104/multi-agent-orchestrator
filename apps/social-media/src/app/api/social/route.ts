import { requireOperator } from "@helix/core/operator";
import { deskWriteDenied, humanActor } from "@/lib/ai-desk";
import { deskErrorResponse } from "@/lib/http-error";
import { draftsFromTopPosts } from "@/lib/social/ai-drafts";
import { refreshInsights, realPosts } from "@/lib/social/insights";
import { writeWeeklyReport } from "@/lib/social/weekly-report";
import { addReviewDrafts, getBrand } from "@/lib/store";

export const runtime = "nodejs";
export const maxDuration = 90;

const ACTIONS = ["refresh", "drafts", "weekly_report"] as const;
type Action = (typeof ACTIONS)[number];

/** Real-data actions from Analytics. None of them publishes. */
export async function POST(req: Request) {
  // Reads the operator's Meta account and calls Claude: the operator key is needed on any desk.
  const denied = requireOperator(req) ?? deskWriteDenied(req);
  if (denied) return denied;
  const body = (await req.json().catch(() => null)) as { action?: unknown } | null;
  const action = body?.action as Action;
  if (!ACTIONS.includes(action)) return Response.json({ error: "action must be refresh, drafts or weekly_report" }, { status: 400 });
  try {
    const snap = await refreshInsights();
    if (!snap) return Response.json({ error: "Meta is not configured. Set HELIX_META_ACCESS_TOKEN and the account ids." }, { status: 409 });
    if (!snap.verification.ok) return Response.json({ error: `Meta rejected the token: ${snap.verification.error ?? "invalid"}` }, { status: 409 });
    if (action === "refresh") return Response.json({ message: `Read ${realPosts(snap).length} real posts from Meta.` });
    const brand = await getBrand();
    if (action === "drafts") {
      const { drafts } = await draftsFromTopPosts(realPosts(snap), brand, { actor: `Helix AI · asked by ${humanActor(req)}` });
      const placed = await addReviewDrafts(drafts);
      return Response.json({ message: `Claude drafted ${placed.length} posts from your best real posts. They are in review; nothing is published.`, ids: placed.map((p) => p.id) });
    }
    const report = await writeWeeklyReport(snap, brand);
    return Response.json({ message: report.engine === "claude" ? "Claude wrote the weekly report from computed numbers." : report.note, id: report.id });
  } catch (err) {
    const mapped = deskErrorResponse(err);
    if (mapped) return mapped;
    throw err;
  }
}
