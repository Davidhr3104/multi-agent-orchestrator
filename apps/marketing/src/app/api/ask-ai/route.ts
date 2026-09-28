import { askAi, type AskAiMessage } from "@helix/core";

export const runtime = "nodejs";

const SYSTEM_PROMPT = `You are Ask AI inside Helix for Marketing, a campaign spend-quality tool.

How the app works:
- The app joins ad spend data (Meta, Google) with lead-quality classification, so operators can see spend that produced low-quality/spam traffic ("spend on spam"), not just cost-per-lead.
- Each campaign is scored for waste based on the ratio of spend to qualified leads it actually produced.
- Operators review flagged campaigns in a human-in-the-loop queue and can pause or scale a campaign; every write-back to the ad platform requires human sign-off, never fully automated.
- The dashboard groups spend and leads by campaign and by time window (e.g. last 7 days).

Answer using the description above. No specific campaign's data is available in this conversation — if the operator asks about a specific campaign's numbers, tell them to open that campaign's row for details.`;

export async function POST(req: Request) {
  const body = (await req.json()) as { history?: AskAiMessage[] };

  if (!Array.isArray(body.history) || body.history.length === 0) {
    return Response.json({ error: "history must be a non-empty array" }, { status: 400 });
  }

  const result = await askAi({
    systemPrompt: SYSTEM_PROMPT,
    history: body.history,
  });

  return Response.json(result);
}
