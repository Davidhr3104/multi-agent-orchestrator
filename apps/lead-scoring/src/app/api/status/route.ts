import { isClaudeConfigured, isGhlConfigured } from "@helix/core";
import { isSupabaseConfigured } from "@/lib/supabase-leads";

export const runtime = "nodejs";

export async function GET() {
  return Response.json({
    claude: isClaudeConfigured(),
    supabase: isSupabaseConfigured(),
    ghl: isGhlConfigured(),
  });
}
