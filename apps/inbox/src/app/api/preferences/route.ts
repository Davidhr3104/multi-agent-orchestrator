import { getPreferences, updatePreferences } from "@/lib/store";
import type { DeskTheme, DraftTone, UserPreferences } from "@/lib/types";

export const runtime = "nodejs";

export async function GET() {
  const preferences = await getPreferences();
  return Response.json({ preferences });
}

export async function PUT(req: Request) {
  return updateFromBody(req);
}

export async function POST(req: Request) {
  return updateFromBody(req);
}

async function updateFromBody(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const row = body as {
    autoTriage?: boolean;
    auto_triage?: boolean;
    defaultTone?: DraftTone;
    default_tone?: string;
    vipSenders?: string[];
    vip_senders?: string[];
    theme?: DeskTheme | string;
    customRules?: UserPreferences["customRules"];
    custom_rules?: UserPreferences["customRules"];
    templates?: UserPreferences["templates"];
  };
  const toneRaw = row.defaultTone ?? row.default_tone;
  const tone =
    toneRaw === "friendly" || toneRaw === "concise" || toneRaw === "formal" || toneRaw === "professional"
      ? toneRaw
      : toneRaw === "direct"
        ? "concise"
        : undefined;
  const theme = row.theme === "light" || row.theme === "dark" ? row.theme : undefined;
  const preferences = await updatePreferences({
    ...(row.autoTriage != null || row.auto_triage != null
      ? { autoTriage: Boolean(row.autoTriage ?? row.auto_triage) }
      : {}),
    ...(tone ? { defaultTone: tone } : {}),
    ...(row.vipSenders || row.vip_senders
      ? { vipSenders: row.vipSenders ?? row.vip_senders ?? [] }
      : {}),
    ...(theme ? { theme } : {}),
    ...(row.customRules || row.custom_rules
      ? { customRules: row.customRules ?? row.custom_rules ?? [] }
      : {}),
    ...(row.templates ? { templates: row.templates } : {}),
  });
  return Response.json({ success: true, preferences });
}
