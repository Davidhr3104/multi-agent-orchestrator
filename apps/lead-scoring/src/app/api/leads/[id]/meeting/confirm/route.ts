import { getLead, patchLead } from "@/lib/store";
import { createCalcomBooking, isCalcomConfigured } from "@/lib/calcom";
import { withOrgScope } from "@/lib/org-auth";

export const runtime = "nodejs";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const start = String((body as { start?: string }).start ?? "");
  if (!start) return Response.json({ error: "start is required" }, { status: 400 });

  return withOrgScope(async (orgId) => {
    const lead = await getLead(id, orgId);
    if (!lead) return Response.json({ error: "Lead not found" }, { status: 404 });
    if (!isCalcomConfigured()) {
      return Response.json({ error: "Cal.com is not configured. Paste keys in Settings." }, { status: 409 });
    }

    const result = await createCalcomBooking(lead, start);
    if (!result.ok) {
      return Response.json({ error: result.error || "Booking failed" }, { status: 502 });
    }
    const saved = await patchLead(
      id,
      {
        meetingLink: result.meetingLink,
        meetingConfirmedAt: new Date().toISOString(),
      },
      orgId
    );
    return Response.json({ lead: saved, meetingLink: result.meetingLink });
  });
}
