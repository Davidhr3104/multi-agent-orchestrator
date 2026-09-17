import { listRfps, getClientProfile, conflictSummaries, pricingSummaries, mergeSignOffs, listSignOffs } from "@/lib/store";
import { applySignOffToRfp, readSignOffCookie } from "@/lib/bid-signoff";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const rfps = await listRfps();
  mergeSignOffs(readSignOffCookie(req));
  const signOffs = listSignOffs();
  const conflicts = await conflictSummaries();
  const pricing = await pricingSummaries();
  return Response.json({
    rfps: rfps.map((r) => applySignOffToRfp(r, signOffs)),
    clientProfile: getClientProfile(),
    conflicts,
    pricing,
    signOffs,
  });
}
