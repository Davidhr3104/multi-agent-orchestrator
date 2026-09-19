import { listCampaigns, listLeads } from "@/lib/store";

export const runtime = "nodejs";

export async function GET() {
  return Response.json({
    campaigns: listCampaigns(),
    leads: listLeads(),
  });
}
