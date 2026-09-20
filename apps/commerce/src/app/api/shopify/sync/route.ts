import { syncShopifyLive } from "@/lib/store";
import { requireOperator } from "@helix/core/operator";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const denied = requireOperator(req);
  if (denied) return denied;
  try {
    const result = await syncShopifyLive();
    if (!result.ok) return Response.json({ error: result.error }, { status: 409 });
    return Response.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return Response.json({ error: message }, { status: 502 });
  }
}
