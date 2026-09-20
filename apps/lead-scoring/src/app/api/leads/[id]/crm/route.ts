import { getLead, patchLead } from "@/lib/store";
import { sendLeadToGhl } from "@/lib/ghl";
import { bumpUsage } from "@/lib/usage";
import { operatorActor, requireOperator } from "@helix/core/operator";
import { checkActionToken, withOrgScope } from "@/lib/org-auth";

export const runtime = "nodejs";

async function sendToCrm(id: string, actor: string, orgId: string | undefined) {
  const current = await getLead(id, orgId);
  if (!current) return Response.json({ error: "Lead not found" }, { status: 404 });

  const result = await sendLeadToGhl(current);
  if (result.mocked) {
    return Response.json(
      {
        error: "GHL_API_KEY and GHL_LOCATION_ID required. Paste them in Settings. CRM was not sent.",
        lead: current,
      },
      { status: 409 }
    );
  }
  bumpUsage("ghl");
  if (result.ok && result.contactId) {
    const lead = await patchLead(
      id,
      {
        crmStatus: "sent",
        ghlContactId: result.contactId,
        ghlOpportunityId: result.opportunityId,
        ghlOpportunityError: result.opportunityError,
        pipelineStage: "contacted",
        reviewedBy: actor,
        reviewedAt: new Date().toISOString(),
      },
      orgId
    );
    return Response.json({
      lead,
      ghlContactId: result.contactId,
      ghlOpportunityId: result.opportunityId,
      opportunityError: result.opportunityError,
    });
  }
  return Response.json({ error: result.error || "GHL send failed", lead: current }, { status: 502 });
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const denied = requireOperator(req);
  if (denied) return denied;
  const { id } = await params;
  return withOrgScope((orgId) => sendToCrm(id, operatorActor(req), orgId));
}

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const tokenCheck = checkActionToken(req, id, "crm");
  if (tokenCheck instanceof Response) return tokenCheck;
  if (!tokenCheck) {
    return new Response("This link needs a valid approval token.", {
      status: 401,
      headers: { "Content-Type": "text/plain" },
    });
  }

  const res = await sendToCrm(id, "slack", tokenCheck.orgId);
  const data = (await res.json()) as { error?: string; opportunityError?: string };
  if (!res.ok) {
    return new Response(data.error || "Could not send to CRM.", {
      status: res.status,
      headers: { "Content-Type": "text/plain" },
    });
  }
  const note = data.opportunityError ? ` (contact synced, but pipeline opportunity failed: ${data.opportunityError})` : "";
  return new Response(`Sent to CRM.${note} You can close this tab.`, {
    headers: { "Content-Type": "text/plain" },
  });
}
