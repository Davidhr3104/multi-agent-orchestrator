import { exchangeMicrosoftCode } from "@/lib/microsoft-oauth";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  if (!code) return Response.redirect(`${url.origin}/integrations?microsoft=missing_code`, 302);
  const result = await exchangeMicrosoftCode(url.origin, code);
  if ("error" in result) {
    return Response.redirect(`${url.origin}/integrations?microsoft=${encodeURIComponent(result.error)}`, 302);
  }
  return Response.redirect(`${url.origin}/integrations?microsoft=${encodeURIComponent(result.email)}`, 302);
}
