import { getLead, patchLead } from "@/lib/store";
import { addGhlNote, sendLeadToGhl } from "@/lib/ghl";
import { upsertHubspotContact } from "@/lib/hubspot";
import { resolveCrmTarget } from "@/lib/crm-target";
import type { CrmTarget, HelixLead } from "@/lib/lead-ai";
import { bumpUsage } from "@/lib/usage";
import { operatorActor, requireOperator } from "@helix/core/operator";
import { checkActionToken, withOrgScope } from "@/lib/org-auth";

export const runtime = "nodejs";

async function sendToHubspot(id: string, working: HelixLead, actor: string, orgId: string | undefined) {
  const result = await upsertHubspotContact(working);
  bumpUsage("hubspot");
  if (result.ok) {
    const lead = await patchLead(
      id,
      {
        crmStatus: "sent",
        crmError: undefined,
        hubspotContactId: result.contactId,
        hubspotSyncedAt: new Date().toISOString(),
        hubspotError: undefined,
        crmProposal: undefined,
        pipelineStage: "contacted",
        reviewedBy: actor,
        reviewedAt: new Date().toISOString(),
      },
      orgId
    );
    return Response.json({ lead, crm: "hubspot", hubspotContactId: result.contactId, created: result.created });
  }
  const error = result.error || "HubSpot sync failed";
  const failed = await patchLead(id, { crmStatus: "failed", crmError: error, hubspotError: error }, orgId);
  return Response.json({ error, crm: "hubspot", lead: failed ?? working }, { status: 502 });
}

async function sendToCrm(
  id: string,
  actor: string,
  orgId: string | undefined,
  note?: string,
  requestedTarget?: unknown
) {
  const current = await getLead(id, orgId);
  if (!current) return Response.json({ error: "Lead not found" }, { status: 404 });

  const target = resolveCrmTarget(requestedTarget);
  if (!target) {
    const notSent = await patchLead(id, { crmStatus: "not_sent", crmError: undefined }, orgId);
    const which =
      requestedTarget === "hubspot"
        ? "HUBSPOT_TOKEN is required"
        : requestedTarget === "ghl"
          ? "GHL_API_KEY and GHL_LOCATION_ID are required"
          : "Connect a CRM first (GHL_API_KEY + GHL_LOCATION_ID, or HUBSPOT_TOKEN)";
    return Response.json(
      { error: `${which}. Paste it in Settings. CRM was not sent.`, lead: notSent ?? current },
      { status: 409 }
    );
  }

  let working = current;
  if (note?.trim()) {
    const stamped = `HITL note (${new Date().toISOString().slice(0, 16)}): ${note.trim()}`;
    const patched = await patchLead(
      id,
      { notes: [...(current.notes ?? []), stamped] },
      orgId
    );
    if (patched) working = patched;
  }

  if (target === "hubspot") return sendToHubspot(id, working, actor, orgId);

  const result = await sendLeadToGhl(working);
  if (result.mocked) {
    const notSent = await patchLead(id, { crmStatus: "not_sent", crmError: undefined }, orgId);
    return Response.json(
      {
        error: "GHL_API_KEY and GHL_LOCATION_ID required. Paste them in Settings. CRM was not sent.",
        lead: notSent ?? working,
      },
      { status: 409 }
    );
  }
  bumpUsage("ghl");
  if (result.ok && result.contactId) {
    if (note?.trim()) {
      await addGhlNote(result.contactId, note.trim());
    }
    const lead = await patchLead(
      id,
      {
        crmStatus: "sent",
        ghlContactId: result.contactId,
        ghlOpportunityId: result.opportunityId,
        ghlOpportunityError: result.opportunityError,
        crmProposal: undefined,
        pipelineStage: "contacted",
        reviewedBy: actor,
        reviewedAt: new Date().toISOString(),
      },
      orgId
    );
    return Response.json({
      lead,
      crm: "ghl",
      ghlContactId: result.contactId,
      ghlOpportunityId: result.opportunityId,
      opportunityError: result.opportunityError,
    });
  }
  const failed = await patchLead(
    id,
    { crmStatus: "failed", crmError: result.error || "GHL send failed" },
    orgId
  );
  return Response.json({ error: result.error || "GHL send failed", crm: "ghl", lead: failed ?? working }, { status: 502 });
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const denied = requireOperator(req);
  if (denied) return denied;
  const { id } = await params;
  let note: string | undefined;
  let target: unknown;
  try {
    const body = (await req.json()) as { note?: string; target?: string };
    note = typeof body.note === "string" ? body.note : undefined;
    target = body.target;
  } catch {
    note = undefined;
  }
  return withOrgScope((orgId) => sendToCrm(id, operatorActor(req), orgId, note, target));
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
  const data = (await res.json()) as { error?: string; opportunityError?: string; crm?: CrmTarget };
  if (!res.ok) {
    return new Response(data.error || "Could not send to CRM.", {
      status: res.status,
      headers: { "Content-Type": "text/plain" },
    });
  }
  const note = data.opportunityError
    ? ` (contact synced, but pipeline opportunity failed: ${data.opportunityError})`
    : "";
  const where = data.crm === "hubspot" ? "Synced to HubSpot" : "Sent to CRM";
  return new Response(`${where}.${note} You can close this tab.`, {
    headers: { "Content-Type": "text/plain" },
  });
}
