import { listRfps } from "@/lib/store";
import { summarizeLegalOutcomes } from "@helix/core";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const rfps = await listRfps();
  return Response.json({
    rfps,
    outcomes: summarizeLegalOutcomes(rfps),
  });
}
