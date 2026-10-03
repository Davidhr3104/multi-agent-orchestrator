import { keysGetResponse, keysPostResponse, KEYS_INBOX } from "@helix/core";
import { requireOperator } from "@helix/core/operator";

export const runtime = "nodejs";

export async function GET() {
  return keysGetResponse(KEYS_INBOX);
}

export async function POST(req: Request) {
  const denied = requireOperator(req);
  if (denied) return denied;
  return keysPostResponse(req, KEYS_INBOX);
}
