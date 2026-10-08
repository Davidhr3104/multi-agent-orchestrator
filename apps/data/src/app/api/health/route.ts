import { getSecret } from "@helix/core";
import { deskStatus } from "@/lib/store";

export const runtime = "nodejs";

export async function GET() {
  const desk = await deskStatus();
  return Response.json({
    ok: true,
    desk,
    supabase: desk.supabase,
    claude: Boolean(getSecret("ANTHROPIC_API_KEY")),
    googleSheets: false,
    note: "File upload only (.xlsx / .csv). No Google Sheets or Excel Online connector. Uploads stay on this visitor’s session until a database is connected.",
  });
}
