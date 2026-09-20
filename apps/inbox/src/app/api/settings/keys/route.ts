import { keysGetResponse, keysPostResponse, KEYS_INBOX } from "@helix/core";

export const runtime = "nodejs";

export async function GET() {
  return keysGetResponse(KEYS_INBOX);
}

export async function POST(req: Request) {
  return keysPostResponse(req, KEYS_INBOX);
}
