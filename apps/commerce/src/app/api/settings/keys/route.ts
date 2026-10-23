import { keysGetResponse, keysPostResponse, KEYS_COMMERCE } from "@helix/core";

export const runtime = "nodejs";

/**
 * The status payload never includes a fragment of a saved key. Blank `masked`
 * so an older client cannot treat a placeholder as part of the secret.
 */
async function withoutFragments(res: Response): Promise<Response> {
  const body = (await res.json()) as { keys?: { masked?: string | null }[] };
  for (const k of body.keys ?? []) {
    if (k.masked) k.masked = "";
  }
  return Response.json(body, { status: res.status });
}

export async function GET(req: Request) {
  return withoutFragments(await keysGetResponse(KEYS_COMMERCE, req));
}

export async function POST(req: Request) {
  return withoutFragments(await keysPostResponse(req, KEYS_COMMERCE));
}
