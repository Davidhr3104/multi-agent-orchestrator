import { getSecret } from "@helix/core";
import { requireOperator } from "@helix/core/operator";
import { isClaudeKeySet } from "@/lib/claude-metered";
import { parseProfile } from "@/lib/client-profile";
import { isSamConfigured, SAM_PROCUREMENT_TYPES } from "@/lib/sam-gov";
import { importSamOpportunities, lastSamRun, parseImportFilters, SAM_DEFAULT_LIMIT, SAM_MAX_LIMIT } from "@/lib/sam-import";
import { samFiltersFromProfile } from "@/lib/sam-mapping";
import { deskStatus, getClientProfile } from "@/lib/store";
import { isSupabaseConfigured } from "@/lib/supabase-desk";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function GET() {
  const desk = await deskStatus();
  return Response.json({
    configured: isSamConfigured(),
    claudeConfigured: isClaudeKeySet(),
    cronConfigured: Boolean(getSecret("CRON_SECRET")),
    persisted: isSupabaseConfigured(),
    deskMode: desk.mode,
    suggested: samFiltersFromProfile(parseProfile(getClientProfile())),
    procurementTypes: SAM_PROCUREMENT_TYPES,
    defaultLimit: SAM_DEFAULT_LIMIT,
    maxLimit: SAM_MAX_LIMIT,
    lastRun: await lastSamRun(),
  });
}

export async function POST(req: Request) {
  const denied = requireOperator(req);
  if (denied) return denied;
  let body: Record<string, unknown> = {};
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return Response.json({ error: "JSON required." }, { status: 400 });
  }
  const filters = parseImportFilters(body);
  if (typeof filters === "string") return Response.json({ error: filters }, { status: 400 });

  const result = await importSamOpportunities({ filters, via: "manual", leaveDemo: body.leaveDemo === true });
  const status =
    result.status === "imported"
      ? 200
      : result.status === "not_configured"
        ? 503
        : result.status === "desk_in_demo"
          ? 409
          : result.error?.kind === "rate_limited"
            ? 429
            : result.error?.kind === "invalid_filters" || result.error?.kind === "bad_request"
              ? 400
              : 502;
  return Response.json(result, { status });
}
