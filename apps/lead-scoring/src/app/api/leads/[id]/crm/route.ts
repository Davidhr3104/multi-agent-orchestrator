import { getLead, patchLead } from "@/lib/store";
import { addGhlNote, sendLeadToGhl } from "@/lib/ghl";
import { bumpUsage } from "@/lib/usage";
import { operatorActor, requireOperator } from "@helix/core/operator";
import { checkActionToken, withOrgScope } from "@/lib/org-auth";

export const runtime = "nodejs";

async function sendToCrm(
  id: string,
  actor: string,
  orgId: string | undefined,
  note?: string
) {
  const current = await getLead(id, orgId);
  if (!current) return Response.json({ error: "Lead not found" }, { status: 404 });

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
  const failed = await patchLead(
    id,
    { crmStatus: "failed", crmError: result.error || "GHL send failed" },
    orgId
  );
  return Response.json({ error: result.error || "GHL send failed", lead: failed ?? working }, { status: 502 });
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const denied = requireOperator(req);
  if (denied) return denied;
  const { id } = await params;
  let note: string | undefined;
  try {
    const body = (await req.json()) as { note?: string };
    note = typeof body.note === "string" ? body.note : undefined;
  } catch {
    note = undefined;
  }
  return withOrgScope((orgId) => sendToCrm(id, operatorActor(req), orgId, note));
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
  const note = data.opportunityError
    ? ` (contact synced, but pipeline opportunity failed: ${data.opportunityError})`
    : "";
  return new Response(`Sent to CRM.${note} You can close this tab.`, {
    headers: { "Content-Type": "text/plain" },
  });
}
