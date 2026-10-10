import { keysGetResponse, keysPostResponse, KEYS_LEADS } from "@helix/core";
import { leadsSettingsAuth } from "@/lib/settings-session";

export const runtime = "nodejs";

export async function GET(req: Request) {
  return keysGetResponse(KEYS_LEADS, req, await leadsSettingsAuth());
}

export async function POST(req: Request) {
  return keysPostResponse(req, KEYS_LEADS, await leadsSettingsAuth());
}
