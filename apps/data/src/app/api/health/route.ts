import { getSecret, redactDeskStatus, settingsPrivileged } from "@helix/core";
import { deskStatus } from "@/lib/store";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const privileged = settingsPrivileged(req);
  const desk = redactDeskStatus(await deskStatus(), privileged);
  return Response.json({
    ok: true,
    desk,
    supabase: privileged && desk.supabase,
    claude: privileged && Boolean(getSecret("ANTHROPIC_API_KEY")),
    googleSheets: false,
    note: "File upload only (.xlsx / .csv). No Google Sheets or Excel Online connector. Uploads stay on this visitor’s session until a database is connected.",
  });
}
