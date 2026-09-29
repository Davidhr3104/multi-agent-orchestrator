import { getLead, patchLead } from "@/lib/store";
import { operatorActor } from "@helix/core/operator";
import { requireOperatorOrGuest } from "@/lib/org-auth";
import { checkActionToken, withOrgScope } from "@/lib/org-auth";

export const runtime = "nodejs";

async function clear(id: string, actor: string, orgId: string | undefined, note?: string) {
  const current = await getLead(id, orgId);
  if (!current) return Response.json({ error: "Lead not found" }, { status: 404 });

  const notes =
    note?.trim()
      ? [...(current.notes ?? []), `Approved note: ${note.trim()}`]
      : current.notes;

  const lead = await patchLead(
    id,
    {
      needsReview: false,
      reviewedBy: actor,
      reviewedAt: new Date().toISOString(),
      ...(notes ? { notes } : {}),
    },
    orgId
  );
  if (!lead) return Response.json({ error: "Lead not found" }, { status: 404 });
  return lead;
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireOperatorOrGuest(req);
  if (denied) return denied;
  const { id } = await params;
  let note: string | undefined;
  try {
    const body = (await req.json()) as { note?: string };
    note = typeof body.note === "string" ? body.note : undefined;
  } catch {
    note = undefined;
  }
  return withOrgScope(async (orgId) => {
    const lead = await clear(id, operatorActor(req), orgId, note);
    if (lead instanceof Response) return lead;
    return Response.json({ lead });
  });
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireOperatorOrGuest(req);
  if (denied) return denied;
  const { id } = await params;
  const actor = operatorActor(req);
  return withOrgScope(async (orgId) => {
    const current = await getLead(id, orgId);
    if (!current) return Response.json({ error: "Lead not found" }, { status: 404 });

    // Audit trail: record the undo so reviewedBy/reviewedAt are not read as the current state.
    const notes = [
      ...(current.notes ?? []),
      `Undo (${new Date().toISOString()}) by ${actor}: review reopened after approve`,
    ];

    const lead = await patchLead(id, { needsReview: true, notes }, orgId);
    if (!lead) return Response.json({ error: "Lead not found" }, { status: 404 });
    return Response.json({ lead });
  });
}

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const tokenCheck = checkActionToken(req, id, "review");
  if (tokenCheck instanceof Response) return tokenCheck;

  if (tokenCheck) {
    const lead = await clear(id, "slack", tokenCheck.orgId);
    if (lead instanceof Response) return lead;
    return new Response("Approved. You can close this tab.", { headers: { "Content-Type": "text/plain" } });
  }

  const denied = await requireOperatorOrGuest(req);
  if (denied) return denied;
  return withOrgScope(async (orgId) => {
    const lead = await clear(id, operatorActor(req), orgId);
    if (lead instanceof Response) return lead;
    return new Response("Approved. You can close this tab.", { headers: { "Content-Type": "text/plain" } });
  });
}
