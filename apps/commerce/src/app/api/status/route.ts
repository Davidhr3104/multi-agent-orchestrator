import { isClaudeConfigured, settingsPrivileged } from "@helix/core";
import { isShopifyConfigured } from "@/lib/shopify";
import { isSupabaseConfigured } from "@/lib/supabase-commerce";

export const runtime = "nodejs";

export async function GET(req: Request) {
  if (!settingsPrivileged(req)) {
    return Response.json({ shopify: false, claude: false, supabase: false });
  }
  return Response.json({
    shopify: isShopifyConfigured(),
    claude: isClaudeConfigured(),
    supabase: isSupabaseConfigured(),
  });
}
