import { operatorProductLinks } from "@helix/core/operator";
import { operatorCookieHeader, operatorSession, unlockOperator } from "@/lib/operator-session";

export const runtime = "nodejs";

export async function GET() {
  return Response.json(await operatorSession());
}

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "JSON inválido" }, { status: 400 });
  }
  const key = String((body as { key?: string }).key ?? "");
  const result = unlockOperator(key);
  if (!result.ok || !result.token) {
    return Response.json({ operator: false, error: "Unauthorized" }, { status: 401 });
  }
  return new Response(
    JSON.stringify({ operator: true, configured: true, products: operatorProductLinks() }),
    {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Set-Cookie": operatorCookieHeader(result.token),
      },
    }
  );
}
