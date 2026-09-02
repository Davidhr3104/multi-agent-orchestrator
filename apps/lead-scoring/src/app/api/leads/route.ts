import { listLeads } from "@/lib/store";
import { isGhlConfigured } from "@/lib/ghl";
import { sourceAttribution } from "@helix/core";

export const runtime = "nodejs";

export async function GET() {
  const leads = await listLeads();
  return Response.json({
    leads,
    ghlConfigured: isGhlConfigured(),
    attribution: sourceAttribution(leads),
  });
}
