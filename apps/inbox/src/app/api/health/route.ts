import { getSecret } from "@helix/core";
import { isGoogleOAuthConfigured } from "@/lib/gmail-oauth";
import { supabaseListEmailAccounts } from "@/lib/supabase-desk";
import { isSlackConfigured } from "@/lib/slack";
import { DEFAULT_WORKSPACE_ID } from "@/lib/types";
import { getAgentProfile } from "@/lib/agent-profile";
import { microsoftStatus } from "@/lib/microsoft-oauth";

export const runtime = "nodejs";

export async function GET() {
  const accounts = await supabaseListEmailAccounts(DEFAULT_WORKSPACE_ID);
  const gmailConnected = accounts.some((a) => a.isConnected && a.accessToken);
  return Response.json({
    claude: Boolean(getSecret("ANTHROPIC_API_KEY")),
    gmailConnected,
    oauthConfigured: isGoogleOAuthConfigured(),
    slack: isSlackConfigured(),
    teams: Boolean(getSecret("TEAMS_WEBHOOK_URL")),
    model: getAgentProfile().model,
    microsoft: microsoftStatus(),
  });
}
