import { buildGoogleAuthUrl, isGoogleOAuthConfigured } from "@/lib/gmail-oauth";
import { requireOperator } from "@helix/core/operator";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const denied = requireOperator(req);
  if (denied) return denied;
  if (!isGoogleOAuthConfigured()) {
    return Response.json(
      { error: "GOOGLE_OAUTH_CLIENT_ID and GOOGLE_OAUTH_CLIENT_SECRET required. Paste them in Settings." },
      { status: 409 }
    );
  }
  const origin = new URL(req.url).origin;
  return Response.redirect(buildGoogleAuthUrl(origin), 302);
}
