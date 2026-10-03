import { keysGetResponse, keysPostResponse, KEYS_COMMERCE } from "@helix/core";
import { requireOperator } from "@helix/core/operator";

export const runtime = "nodejs";

/**
 * The core helper returns the first and last 4 characters of every saved key. On a public demo that
 * is a leak, so the fragment is blanked here: the UI only learns whether a key is set.
 */
async function withoutFragments(res: Response): Promise<Response> {
  const body = (await res.json()) as { keys?: { masked?: string | null }[] };
  for (const k of body.keys ?? []) k.masked = "";
  return Response.json(body, { status: res.status });
}

export async function GET() {
  return withoutFragments(await keysGetResponse(KEYS_COMMERCE));
}

export async function POST(req: Request) {
  const denied = requireOperator(req);
  if (denied) return denied;
  return withoutFragments(await keysPostResponse(req, KEYS_COMMERCE));
}
