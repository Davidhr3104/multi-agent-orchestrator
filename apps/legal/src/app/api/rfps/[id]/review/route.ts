import { getRfp, mergeSignOffs, patchRfp, recordAudit, recordSignOff, listSignOffs } from "@/lib/store";
import { goNoGo } from "@/lib/rfp-intel";
import {
  readSignOffCookie,
  resolveBidCall,
  signOffCookieHeader,
  signOffLabel,
  type BidSignOff,
  type BidSignOffAction,
} from "@/lib/bid-signoff";

export const runtime = "nodejs";

function isAction(v: unknown): v is BidSignOffAction {
  return v === "approve" || v === "reject" || v === "override";
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  mergeSignOffs(readSignOffCookie(req));

  let action: BidSignOffAction = "approve";
  try {
    const body = (await req.json()) as { action?: unknown };
    if (isAction(body.action)) action = body.action;
  } catch {
    action = "approve";
  }

  const current = await getRfp(id);
  if (!current) return Response.json({ error: "RFP not found" }, { status: 404 });

  const ai = goNoGo(current);
  const signOff: BidSignOff = {
    rfpId: id,
    action,
    bid: resolveBidCall(ai.verdict, action),
    at: new Date().toISOString(),
    actor: "ops",
  };
  await recordSignOff(signOff);
  const rfp = await patchRfp(id, { needsReview: false });
  if (!rfp) return Response.json({ error: "RFP not found" }, { status: 404 });
  await recordAudit(
    "ops",
    "review",
    `${signOffLabel(action)} · ${signOff.bid} on ${rfp.title} (AI ${ai.verdict})`
  );

  const signOffs = { ...listSignOffs(), [id]: signOff };
  return new Response(JSON.stringify({ rfp: { ...rfp, needsReview: false }, signOff }), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Set-Cookie": signOffCookieHeader(signOffs),
    },
  });
}
