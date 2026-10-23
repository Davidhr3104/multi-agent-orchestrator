import { isClaudeConfigured, isGhlConfigured, settingsPrivileged } from "@helix/core";
import { leadsSettingsAuth } from "@/lib/settings-session";
import { isHubspotConfigured } from "@/lib/hubspot";
import { isSupabaseConfigured } from "@/lib/supabase-leads";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const privileged = settingsPrivileged(req, await leadsSettingsAuth());
  if (!privileged) {
    return Response.json({ claude: false, supabase: false, ghl: false, hubspot: false });
  }
  return Response.json({
    claude: isClaudeConfigured(),
    supabase: isSupabaseConfigured(),
    ghl: isGhlConfigured(),
    hubspot: isHubspotConfigured(),
  });
}
