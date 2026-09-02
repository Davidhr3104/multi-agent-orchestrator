import { getUsage } from "@/lib/usage";
import { isClaudeConfigured } from "@helix/core";
import { isGhlConfigured } from "@/lib/ghl";

export const runtime = "nodejs";

export async function GET() {
  return Response.json({
    ...getUsage(),
    claudeKey: isClaudeConfigured(),
    ghlKey: isGhlConfigured(),
  });
}
