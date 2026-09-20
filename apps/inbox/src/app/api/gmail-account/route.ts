import { isGoogleOAuthConfigured } from "@/lib/gmail-oauth";
import { supabaseListEmailAccounts } from "@/lib/supabase-desk";
import { DEFAULT_WORKSPACE_ID } from "@/lib/types";

export const runtime = "nodejs";

export async function GET() {
  const accounts = await supabaseListEmailAccounts(DEFAULT_WORKSPACE_ID);
  return Response.json({
    oauthConfigured: isGoogleOAuthConfigured(),
    accounts: accounts.map((a) => ({
      id: a.id,
      emailAddress: a.emailAddress,
      connected: Boolean(a.isConnected && a.accessToken),
      hasRefreshToken: Boolean(a.refreshToken),
      tokenExpiresAt: a.tokenExpiresAt ?? null,
      lastSyncedAt: a.lastSyncedAt ?? null,
    })),
  });
}
