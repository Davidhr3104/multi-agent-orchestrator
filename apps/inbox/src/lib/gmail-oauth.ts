import { getSecret } from "@helix/core";
import {
  supabaseGetEmailAccountById,
  supabaseListEmailAccounts,
  supabaseUpdateAccessToken,
  supabaseUpsertEmailAccount,
} from "@/lib/supabase-desk";
import type { EmailAccount } from "@/lib/types";
import { DEFAULT_WORKSPACE_ID } from "@/lib/types";

const AUTH_BASE = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const SCOPES = ["https://www.googleapis.com/auth/gmail.modify"].join(" ");

export function isGoogleOAuthConfigured(): boolean {
  return Boolean(getSecret("GOOGLE_OAUTH_CLIENT_ID") && getSecret("GOOGLE_OAUTH_CLIENT_SECRET"));
}

function redirectUri(origin: string): string {
  return `${origin}/api/auth/gmail/callback`;
}

export function buildGoogleAuthUrl(origin: string): string {
  const clientId = getSecret("GOOGLE_OAUTH_CLIENT_ID");
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri(origin),
    response_type: "code",
    scope: SCOPES,
    access_type: "offline",
    prompt: "consent",
  });
  return `${AUTH_BASE}?${params.toString()}`;
}

type TokenResponse = {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  scope?: string;
  token_type?: string;
  error?: string;
  error_description?: string;
};

export async function exchangeCodeForTokens(
  code: string,
  origin: string
): Promise<{ ok: true; accessToken: string; refreshToken?: string; expiresAt: string } | { ok: false; error: string }> {
  const clientId = getSecret("GOOGLE_OAUTH_CLIENT_ID");
  const clientSecret = getSecret("GOOGLE_OAUTH_CLIENT_SECRET");
  if (!clientId || !clientSecret) {
    return { ok: false, error: "GOOGLE_OAUTH_CLIENT_ID and GOOGLE_OAUTH_CLIENT_SECRET required." };
  }
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri(origin),
      grant_type: "authorization_code",
    }),
    signal: AbortSignal.timeout(15_000),
  });
  const data = (await res.json().catch(() => ({}))) as TokenResponse;
  if (!res.ok || !data.access_token) {
    return { ok: false, error: data.error_description || data.error || `Google token HTTP ${res.status}` };
  }
  return {
    ok: true,
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: new Date(Date.now() + data.expires_in * 1000).toISOString(),
  };
}

async function refreshAccessToken(
  refreshToken: string
): Promise<{ ok: true; accessToken: string; expiresAt: string } | { ok: false; error: string }> {
  const clientId = getSecret("GOOGLE_OAUTH_CLIENT_ID");
  const clientSecret = getSecret("GOOGLE_OAUTH_CLIENT_SECRET");
  if (!clientId || !clientSecret) {
    return { ok: false, error: "GOOGLE_OAUTH_CLIENT_ID and GOOGLE_OAUTH_CLIENT_SECRET required." };
  }
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "refresh_token",
    }),
    signal: AbortSignal.timeout(15_000),
  });
  const data = (await res.json().catch(() => ({}))) as TokenResponse;
  if (!res.ok || !data.access_token) {
    return { ok: false, error: data.error_description || data.error || `Google refresh HTTP ${res.status}` };
  }
  return {
    ok: true,
    accessToken: data.access_token,
    expiresAt: new Date(Date.now() + data.expires_in * 1000).toISOString(),
  };
}

export function isGmailAccountConfigured(): boolean {
  // Real per-workspace OAuth account is checked at call sites via
  // getValidGmailAccessToken (it's async — needs a DB round trip). This sync
  // check only covers the legacy pasted-token fallback so UI can show a
  // quick status without awaiting a network call.
  return Boolean(getSecret("GMAIL_ACCESS_TOKEN"));
}

async function resolveValidToken(
  account: EmailAccount
): Promise<{ ok: true; token: string; account: EmailAccount } | { ok: false; error: string }> {
  if (!account.accessToken) {
    return { ok: false, error: `${account.emailAddress} has no stored access token. Reconnect in Settings.` };
  }
  const expiresAt = account.tokenExpiresAt ? Date.parse(account.tokenExpiresAt) : 0;
  const stillValid = expiresAt - Date.now() > 60_000; // refresh 1 min before expiry
  if (stillValid) return { ok: true, token: account.accessToken, account };

  if (!account.refreshToken) {
    return {
      ok: false,
      error: `Gmail token for ${account.emailAddress} expired and no refresh token is stored. Reconnect in Settings.`,
    };
  }
  const refreshed = await refreshAccessToken(account.refreshToken);
  if (!refreshed.ok) return { ok: false, error: refreshed.error };
  await supabaseUpdateAccessToken(account.id, refreshed.accessToken, refreshed.expiresAt);
  return {
    ok: true,
    token: refreshed.accessToken,
    account: { ...account, accessToken: refreshed.accessToken, tokenExpiresAt: refreshed.expiresAt },
  };
}

/**
 * Resolves a usable Gmail access token for one specific connected mailbox
 * (a workspace can have several — ops@, support@, ...). Refreshes via the
 * stored refresh_token if expired/about to expire, persisting the new
 * access token. Never silently uses a stale expired token.
 */
export async function getValidGmailAccessTokenForAccount(
  accountId: string
): Promise<{ ok: true; token: string; account: EmailAccount } | { ok: false; error: string }> {
  const account = await supabaseGetEmailAccountById(accountId);
  if (!account) return { ok: false, error: "Gmail account not found." };
  return resolveValidToken(account);
}

/**
 * Resolves a usable Gmail access token for the workspace's first connected
 * mailbox — for call sites that only care about "a" Gmail connection (e.g.
 * the legacy single-mailbox sync fallback). Falls back to the legacy pasted
 * GMAIL_ACCESS_TOKEN secret only when no OAuth account is connected at all.
 */
export async function getValidGmailAccessToken(
  workspaceId: string = DEFAULT_WORKSPACE_ID
): Promise<{ ok: true; token: string; account: EmailAccount | null } | { ok: false; error: string }> {
  const accounts = await supabaseListEmailAccounts(workspaceId);
  const account = accounts[0];
  if (!account || !account.accessToken) {
    const legacy = getSecret("GMAIL_ACCESS_TOKEN");
    if (legacy) return { ok: true, token: legacy, account: null };
    return {
      ok: false,
      error: "No Gmail account connected. Connect Gmail in Settings, or paste a legacy access token.",
    };
  }
  return resolveValidToken(account);
}

/** Resolves the mailbox's own address right after OAuth exchange, via Gmail's own profile endpoint — avoids requesting a separate userinfo.email scope. */
export async function fetchGmailAddress(accessToken: string): Promise<string | null> {
  const res = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/profile", {
    headers: { Authorization: `Bearer ${accessToken}` },
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) return null;
  const data = (await res.json().catch(() => ({}))) as { emailAddress?: string };
  return data.emailAddress ?? null;
}

export async function connectGmailAccount(
  workspaceId: string,
  emailAddress: string,
  accessToken: string,
  refreshToken: string | undefined,
  expiresAt: string
): Promise<boolean> {
  return supabaseUpsertEmailAccount({ workspaceId, emailAddress, accessToken, refreshToken, tokenExpiresAt: expiresAt });
}
