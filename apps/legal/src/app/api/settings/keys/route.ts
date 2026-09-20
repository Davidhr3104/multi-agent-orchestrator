import { keysGetResponse, keysPostResponse, KEYS_LEGAL } from "@helix/core";

export const runtime = "nodejs";

export async function GET() {
  return keysGetResponse(KEYS_LEGAL);
}

export async function POST(req: Request) {
  return keysPostResponse(req, KEYS_LEGAL);
}
