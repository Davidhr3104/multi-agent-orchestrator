import { getLead, patchLead } from "@/lib/store";
import { getCalcomAvailability, isCalcomConfigured } from "@/lib/calcom";
import { getSecret, meetingSlots } from "@helix/core";
import { withOrgScope } from "@/lib/org-auth";

export const runtime = "nodejs";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  return withOrgScope(async (orgId) => {
    const lead = await getLead(id, orgId);
    if (!lead) return Response.json({ error: "Lead not found" }, { status: 404 });

    if (isCalcomConfigured()) {
      const live = await getCalcomAvailability();
      if (live.ok) {
        return Response.json({ slots: live.slots, lead, source: "calcom" });
      }
      // Configured but the call failed — surface it, don't silently drop to heuristic slots.
      return Response.json({ error: live.error, slots: [], lead, source: "calcom" }, { status: 502 });
    }

    const slots = meetingSlots(getSecret("CALENDLY_URL"));
    const meetingLink = slots[0]?.url;
    const saved = meetingLink ? await patchLead(id, { meetingLink }, orgId) : lead;
    return Response.json({ slots, lead: saved, source: "heuristic" });
  });
}
