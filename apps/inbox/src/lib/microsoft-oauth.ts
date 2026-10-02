import { getSecret } from "@helix/core";

let connectedEmail: string | null = null;

export function microsoftStatus() {
  return {
    configured: Boolean(getSecret("MICROSOFT_CLIENT_ID") && getSecret("MICROSOFT_CLIENT_SECRET")),
    connectedEmail,
  };
}

export function buildMicrosoftAuthUrl(origin: string): string | null {
  const clientId = getSecret("MICROSOFT_CLIENT_ID");
  if (!clientId) return null;
  const tenant = getSecret("MICROSOFT_TENANT_ID") || "common";
  const params = new URLSearchParams({
    client_id: clientId,
    response_type: "code",
    redirect_uri: `${origin}/api/auth/microsoft/callback`,
    response_mode: "query",
    scope: "offline_access User.Read Mail.Read",
    prompt: "select_account",
  });
  return `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/authorize?${params}`;
}

export async function exchangeMicrosoftCode(origin: string, code: string): Promise<{ email: string } | { error: string }> {
  const clientId = getSecret("MICROSOFT_CLIENT_ID");
  const clientSecret = getSecret("MICROSOFT_CLIENT_SECRET");
  if (!clientId || !clientSecret) return { error: "Microsoft OAuth is not configured" };
  const tenant = getSecret("MICROSOFT_TENANT_ID") || "common";
  const tokenRes = await fetch(`https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      redirect_uri: `${origin}/api/auth/microsoft/callback`,
      grant_type: "authorization_code",
    }),
  });
  if (!tokenRes.ok) return { error: `Microsoft token ${tokenRes.status}` };
  const token = (await tokenRes.json()) as { access_token?: string };
  if (!token.access_token) return { error: "Microsoft did not return a token" };
  const me = await fetch("https://graph.microsoft.com/v1.0/me", {
    headers: { Authorization: `Bearer ${token.access_token}` },
  });
  if (!me.ok) return { error: `Microsoft profile ${me.status}` };
  const profile = (await me.json()) as { mail?: string; userPrincipalName?: string };
  connectedEmail = profile.mail || profile.userPrincipalName || "connected";
  return { email: connectedEmail };
}
