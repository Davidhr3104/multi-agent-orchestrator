import { connectGmailAccount, exchangeCodeForTokens, fetchGmailAddress } from "@/lib/gmail-oauth";
import { supabaseListEmailAccounts } from "@/lib/supabase-desk";
import { DEFAULT_WORKSPACE_ID } from "@/lib/types";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const oauthError = url.searchParams.get("error");
  if (oauthError) {
    return Response.redirect(`${url.origin}/settings?gmail_error=${encodeURIComponent(oauthError)}`, 302);
  }
  if (!code) {
    return Response.redirect(`${url.origin}/settings?gmail_error=missing_code`, 302);
  }

  const exchanged = await exchangeCodeForTokens(code, url.origin);
  if (!exchanged.ok) {
    return Response.redirect(`${url.origin}/settings?gmail_error=${encodeURIComponent(exchanged.error)}`, 302);
  }

  const email = await fetchGmailAddress(exchanged.accessToken);
  if (!email) {
    return Response.redirect(`${url.origin}/settings?gmail_error=could_not_resolve_mailbox`, 302);
  }

  // Google only returns a refresh_token on the first consent (access_type=offline
  // & prompt=consent); a reconnect can omit it — preserve whatever is already
  // stored for THIS exact mailbox (a workspace can have several connected;
  // grabbing "the" workspace account would leak another mailbox's token).
  const accounts = await supabaseListEmailAccounts(DEFAULT_WORKSPACE_ID);
  const existing = accounts.find((a) => a.emailAddress.toLowerCase() === email.toLowerCase());
  const refreshToken = exchanged.refreshToken ?? existing?.refreshToken;

  const saved = await connectGmailAccount(
    DEFAULT_WORKSPACE_ID,
    email,
    exchanged.accessToken,
    refreshToken,
    exchanged.expiresAt
  );
  if (!saved) {
    return Response.redirect(`${url.origin}/settings?gmail_error=storage_failed`, 302);
  }

  return Response.redirect(`${url.origin}/settings?gmail_connected=${encodeURIComponent(email)}`, 302);
}
