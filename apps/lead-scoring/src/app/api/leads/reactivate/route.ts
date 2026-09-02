import { completeWithClaude, isClaudeConfigured, zombieLeads } from "@helix/core";
import { listLeads } from "@/lib/store";

export const runtime = "nodejs";

export async function POST() {
  const leads = zombieLeads(await listLeads(), Date.now(), 5);
  const drafts = await Promise.all(
    leads.map(async (lead) => {
      const topic = lead.message.slice(0, 120) || lead.source;
      let reactivation_email = `Hi ${lead.name.split(" ")[0]},\n\nChecking in from Helix — we spoke months ago about ${topic}. If inbound is still noisy, happy to share a 15-min recap.\n\n— Helix`;
      if (isClaudeConfigured()) {
        const text = await completeWithClaude(
          `Write a short, highly personalized re-engagement email to ${lead.name} from ${lead.company || lead.enrichment?.company || "their company"}. Reference that we spoke 6 months ago about ${topic}. Keep it under 100 words. Friendly and professional. Return plain email body only.`,
          400
        );
        if (text?.trim()) reactivation_email = text.trim();
      }
      return {
        id: lead.id,
        name: lead.name,
        email: lead.email,
        company: lead.company || lead.enrichment?.company,
        createdAt: lead.createdAt,
        reactivation_email,
      };
    })
  );
  return Response.json({ leads: drafts });
}
