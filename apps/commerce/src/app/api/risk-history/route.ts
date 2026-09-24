import { supabaseListDailyRiskSnapshots } from "@/lib/supabase-commerce";

export const runtime = "nodejs";

export async function GET() {
  const snapshots = await supabaseListDailyRiskSnapshots(30);
  return Response.json({ snapshots: snapshots ?? [] });
}
