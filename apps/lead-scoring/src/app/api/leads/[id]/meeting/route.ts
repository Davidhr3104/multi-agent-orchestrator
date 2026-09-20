import { getLead, patchLead } from "@/lib/store";
import { getSecret, meetingSlots } from "@helix/core";

export const runtime = "nodejs";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const lead = await getLead(id);
  if (!lead) return Response.json({ error: "Lead not found" }, { status: 404 });
  const slots = meetingSlots(getSecret("CALENDLY_URL"));
  const meetingLink = slots[0]?.url;
  const saved = meetingLink ? await patchLead(id, { meetingLink }) : lead;
  return Response.json({ slots, lead: saved });
}
