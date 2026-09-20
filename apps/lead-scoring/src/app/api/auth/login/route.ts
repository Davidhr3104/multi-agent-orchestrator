import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getSecret } from "@helix/core";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const url = getSecret("NEXT_PUBLIC_SUPABASE_URL");
  const anonKey = getSecret("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  if (!url || !anonKey) {
    return Response.json({ error: "Org auth is not configured yet." }, { status: 409 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const email = String((body as { email?: string }).email ?? "").trim();
  if (!email || !email.includes("@")) {
    return Response.json({ error: "Valid email required" }, { status: 400 });
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

  const origin = new URL(req.url).origin;
  const { error } = await client.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: `${origin}/api/auth/callback` },
  });
  if (error) return Response.json({ error: error.message }, { status: 502 });
  return Response.json({ ok: true });
}
