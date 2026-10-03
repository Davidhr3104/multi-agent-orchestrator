import { keysGetResponse, keysPostResponse, KEYS_MARKETING } from "@helix/core";
import { requireOperator } from "@helix/core/operator";

export const runtime = "nodejs";

export async function GET() {
  return keysGetResponse(KEYS_MARKETING);
}

export async function POST(req: Request) {
  const denied = requireOperator(req);
  if (denied) return denied;
  return keysPostResponse(req, KEYS_MARKETING);
}
