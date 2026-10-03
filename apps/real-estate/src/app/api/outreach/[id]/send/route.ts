import { aiCtx, deskWriteDenied } from "@/lib/ai-desk";
import { sendApprovedDraft } from "@/lib/outreach-send";

export const runtime = "nodejs";

/** Sends one approved draft on one channel after the agent confirmed it. Body: { channel, confirm: true }. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = deskWriteDenied(req);
  if (denied) return denied;
  const { id } = await params;
  const body = (await req.json().catch(() => ({}))) as { channel?: unknown; confirm?: unknown };
  const r = await sendApprovedDraft({ draftId: id, channel: body.channel, confirm: body.confirm, actor: aiCtx(req).actor });
  return Response.json(r.body, { status: r.status });
}
