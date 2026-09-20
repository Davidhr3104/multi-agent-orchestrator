import { keysGetResponse, keysPostResponse, KEYS_COMMERCE } from "@helix/core";

export const runtime = "nodejs";

export async function GET() {
  return keysGetResponse(KEYS_COMMERCE);
}

export async function POST(req: Request) {
  return keysPostResponse(req, KEYS_COMMERCE);
}
