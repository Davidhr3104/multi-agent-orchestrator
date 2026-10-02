import { cycleInboxModel, getAgentProfile, setAgentProfile, type InboxModelId, type InboxPersona } from "@/lib/agent-profile";

export const runtime = "nodejs";

export async function GET() {
  return Response.json({ profile: getAgentProfile() });
}

export async function POST(req: Request) {
  let body: unknown = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }
  const row = body as {
    model?: string;
    prompt?: string;
    cycle?: boolean;
    persona?: InboxPersona;
    followUpHours?: number;
    quoteApprovalUsd?: number;
    discountApprovalPct?: number;
  };
  const profile = row.cycle
    ? cycleInboxModel()
    : setAgentProfile({
        model: row.model as InboxModelId | undefined,
        prompt: typeof row.prompt === "string" ? row.prompt : undefined,
        persona: row.persona,
        followUpHours: row.followUpHours,
        quoteApprovalUsd: row.quoteApprovalUsd,
        discountApprovalPct: row.discountApprovalPct,
      });
  return Response.json({ profile });
}
