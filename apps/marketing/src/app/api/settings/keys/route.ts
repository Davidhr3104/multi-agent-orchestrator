import { keysGetResponse, keysPostResponse, KEYS_MARKETING } from "@helix/core";

export const runtime = "nodejs";

export async function GET() {
  return keysGetResponse(KEYS_MARKETING);
}

export async function POST(req: Request) {
  return keysPostResponse(req, KEYS_MARKETING);
}
