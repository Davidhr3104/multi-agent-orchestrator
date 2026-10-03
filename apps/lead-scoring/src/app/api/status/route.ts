import { isClaudeConfigured, isGhlConfigured } from "@helix/core";
import { isSupabaseConfigured } from "@/lib/supabase-leads";
import { isHubspotConfigured } from "@/lib/hubspot";

export const runtime = "nodejs";

export async function GET() {
  return Response.json({
    claude: isClaudeConfigured(),
    supabase: isSupabaseConfigured(),
    ghl: isGhlConfigured(),
    hubspot: isHubspotConfigured(),
  });
}
