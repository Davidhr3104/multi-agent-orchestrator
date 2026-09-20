import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getSecret } from "@helix/core";
import { bootstrapOrgForUser } from "@/lib/org-auth";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const url = getSecret("NEXT_PUBLIC_SUPABASE_URL");
  const anonKey = getSecret("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  const reqUrl = new URL(req.url);
  const code = reqUrl.searchParams.get("code");
  if (!url || !anonKey || !code) {
    return Response.redirect(`${reqUrl.origin}/login?error=missing_code`, 302);
  }

  const jar = await cookies();
  const client = createServerClient(url, anonKey, {
    cookies: {
      getAll: () => jar.getAll(),
      setAll: (list) => {
        for (const { name, value, options } of list) jar.set(name, value, options);
      },
    },
  });

  const { data, error } = await client.auth.exchangeCodeForSession(code);
  if (error || !data.user) {
    return Response.redirect(`${reqUrl.origin}/login?error=auth_failed`, 302);
  }

  await bootstrapOrgForUser({ id: data.user.id, email: data.user.email ?? null });
  return Response.redirect(`${reqUrl.origin}/leads`, 302);
}
