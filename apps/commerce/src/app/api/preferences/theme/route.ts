import {
  supabaseGetThemePreference,
  supabaseSetThemePreference,
} from "@/lib/supabase-commerce";

export const runtime = "nodejs";

export async function GET() {
  const theme = await supabaseGetThemePreference();
  return Response.json({ theme: theme ?? "dark" });
}

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "JSON inválido" }, { status: 400 });
  }

  const theme = (body as { theme?: string } | null)?.theme;
  if (theme !== "light" && theme !== "dark") {
    return Response.json({ error: "theme must be 'light' or 'dark'" }, { status: 400 });
  }

  const saved = await supabaseSetThemePreference(theme);
  return Response.json({ theme, persisted: saved });
}
