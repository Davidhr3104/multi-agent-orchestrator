import { keysGetResponse, keysPostResponse, KEYS_LEADS } from "@helix/core";

export const runtime = "nodejs";

export async function GET() {
  return keysGetResponse(KEYS_LEADS);
}

export async function POST(req: Request) {
  return keysPostResponse(req, KEYS_LEADS);
}
