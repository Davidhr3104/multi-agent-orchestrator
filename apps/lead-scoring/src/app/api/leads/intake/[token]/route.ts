import type { LeadStreamEvent } from "@helix/core";
import { finishLeadIngest } from "@/lib/finish-ingest";
import { matchesSingleTenantIntakeToken, parseIntakeRequest } from "@/lib/intake";
import { orgIdForWebhookToken } from "@/lib/org-auth";
import { isSupabaseConfigured } from "@/lib/supabase-leads";

export const runtime = "nodejs";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS });
}

/**
 * Public lead intake for website forms, Zapier/Make or any server: POST JSON or a plain HTML
 * form to /api/leads/intake/<token>. The token is the org's webhook token (Supabase) or
 * HELIX_INTAKE_TOKEN on a single-tenant deployment. Every lead is triaged on arrival (Claude when
 * ANTHROPIC_API_KEY is set, heuristic otherwise) and stored as real data, never in the demo sandbox.
 * Nothing is pushed to a CRM here.
 */
export async function POST(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  let orgId: string | undefined;
  if (isSupabaseConfigured()) {
    const found = await orgIdForWebhookToken(token);
    if (!found) return Response.json({ error: "Unknown intake token" }, { status: 404, headers: CORS });
    orgId = found;
  } else if (!matchesSingleTenantIntakeToken(token)) {
    return Response.json({ error: "Unknown intake token" }, { status: 404, headers: CORS });
  }

  const parsed = await parseIntakeRequest(req);
  if (!parsed.ok) {
    if (parsed.honeypot) return Response.json({ ok: true }, { headers: CORS });
    return Response.json({ error: parsed.error }, { status: 400, headers: CORS });
  }

  const events: LeadStreamEvent[] = [];
  try {
    const lead = await finishLeadIngest(parsed.input, (e) => events.push(e), orgId, { real: true });
    return Response.json(
      {
        ok: true,
        id: lead.id,
        classification: lead.classification,
        score: lead.score,
        tier: lead.tier,
        engine: lead.aiTriage?.engine ?? lead.engine,
      },
      { headers: CORS }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return Response.json({ error: message }, { status: 500, headers: CORS });
  }
}
