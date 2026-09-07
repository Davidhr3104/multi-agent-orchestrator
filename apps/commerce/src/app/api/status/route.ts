import { isClaudeConfigured } from "@helix/core";
import { isShopifyConfigured } from "@/lib/shopify";
import { isSupabaseConfigured } from "@/lib/supabase-commerce";

export const runtime = "nodejs";

export async function GET() {
  return Response.json({
    shopify: isShopifyConfigured(),
    claude: isClaudeConfigured(),
    supabase: isSupabaseConfigured(),
  });
}
