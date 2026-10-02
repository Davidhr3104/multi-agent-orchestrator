import { buildMicrosoftAuthUrl } from "@/lib/microsoft-oauth";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const url = buildMicrosoftAuthUrl(new URL(req.url).origin);
  if (!url) {
    return Response.redirect(new URL("/integrations?microsoft=missing", req.url), 302);
  }
  return Response.redirect(url, 302);
}
