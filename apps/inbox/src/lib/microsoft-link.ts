import { getSecret } from "@helix/core";

let connectedEmail: string | null = null;

export function microsoftRedirectUri(origin: string): string {
  return `${origin}/api/auth/microsoft/callback`;
}

export function microsoftAuthUrl(origin: string): string | null {
  const client = getSecret("MICROSOFT_CLIENT_ID");
  if (!client) return null;
  const tenant = getSecret("MICROSOFT_TENANT_ID") || "common";
  const params = new URLSearchParams({
    client_id: client,
    response_type: "code",
    redirect_uri: microsoftRedirectUri(origin),
    response_mode: "query",
    scope: "offline_access User.Read Mail.Read",
  });
  return `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/authorize?${params}`;
}

export function microsoftConnectedEmail(): string | null {
  return connectedEmail;
}

export function setMicrosoftConnectedEmail(email: string) {
  connectedEmail = email;
}
