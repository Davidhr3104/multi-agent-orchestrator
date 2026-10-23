import { keysGetResponse, keysPostResponse, KEYS_MARKETING } from "@helix/core";

export const runtime = "nodejs";

export async function GET(req: Request) {
  return keysGetResponse(KEYS_MARKETING, req);
}

export async function POST(req: Request) {
  return keysPostResponse(req, KEYS_MARKETING);
}
