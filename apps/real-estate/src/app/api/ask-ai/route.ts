import { askAi, askAiWithProposal, isClaudeConfigured, type AskAiMessage } from "@helix/core";
import { requireOperator } from "@helix/core/operator";
import { applyRiskPolicy } from "@/lib/ai-desk";
import { buildDemoReply } from "@/lib/demo-assistant";
import { currentDeskMode, getZone, listDrafts, listLeads, listProperties, listSellers, listShowings, listZones } from "@/lib/store";

export const runtime = "nodejs";

const PROPOSAL_INSTRUCTION = `Only when the agent explicitly asks you to act, respond with ONLY a fenced json block (no other text) matching this exact shape:
\`\`\`json
{"type":"action_proposal","action":"<action>","summary":"<one sentence>","targets":[{"id":"<id>","label":"<name>"}],"params":{}}
\`\`\`
Supported actions — ids must be copied from the desk snapshot below, never invented:
- "draft_match_alerts": targets are property ids; drafts a "new listing" message for each open buyer the property fits.
- "draft_reactivation": targets are lead ids of buyers with no contact in 30+ days; drafts a check-in for each.
- "approve_draft": targets are draft ids; marks drafts ready to send (always confirmed by the agent; nothing is sent).
- "dismiss_draft": targets are draft ids.
- "move_stage": targets are lead ids. params: {"stage":"new|contacted|visit|offer|closed|archived"} (required). Closing or archiving is always confirmed by the agent.
- "schedule_showing": targets are lead ids. params: {"propertyId":"<active property id>","startsAt":"<ISO 8601>","durationMin":45}. Only when the agent gave the day and time.
- "reschedule_showing": targets are showing ids. params: {"startsAt":"<ISO 8601>"}.
- "cancel_showing": targets are showing ids.
- "record_feedback": targets are showing ids that already started. params: {"interest":"high|medium|low|none","objections":["..."],"notes":"..."} or {"noShow":true}.
- "move_seller_stage": targets are seller ids. params: {"stage":"prospect|valuation|agreement|listed|lost"}. "lost" is always confirmed by the agent.
- "create_listing_from_seller": targets are seller ids with an asking price and no listing yet; creates a DRAFT listing (never published).
The calendar is not synced to Google or Outlook and sends no invites — say so when you book or move a showing.
For any other question, answer normally in plain text; do not emit a json block.`;

const SYSTEM_PROMPT = `You are Ask AI inside Helix for Real Estate, a desk for real-estate agents.

How the app works:
- Properties have a price, size, zone, status (active, draft, reserved, sold) and days on market.
- Buyer leads are scored 0-100 from budget, timeline, financing, specificity and engagement, and tiered hot (85+), warm (60-84) or cold.
- Each buyer is matched to the properties that fit their budget, zone and bedrooms.
- The agent approves anything that is published or sent; you never do it yourself.

Rules: answer only from the desk snapshot below and never invent prices, buyers or market data. Market figures on this desk are DEMO DATA — say so. When you mention a property or buyer, write it as a markdown link using the ids in the snapshot: [Name](/leads/<lead id>) or [Title](/properties/<property id>).`;

async function snapshot(): Promise<string> {
  const [leads, props, zones, drafts, showings, sellers] = await Promise.all([listLeads(), listProperties(), listZones(), listDrafts(), listShowings(), listSellers()]);
  if (leads.length === 0 && props.length === 0) return "The desk has no properties or buyers.";
  const pending = drafts.filter((d) => d.status === "pending");
  const recent = showings.filter((s) => s.status === "scheduled" || Date.parse(s.startsAt) > Date.now() - 14 * 86_400_000);
  return [
    `Properties (${props.length}):`,
    ...props.map((p) => `- ${p.title} [/properties/${p.id}] ${p.zone}, $${p.price}, ${p.sqm} m², ${p.beds} bd, status ${p.status}, ${p.daysOnMarket} days on market`),
    `Buyers (${leads.length}):`,
    ...leads.map(
      (l) =>
        `- ${l.name} [/leads/${l.id}] score ${l.buyer.score} (${l.buyer.tier}), budget $${l.budget}, zones ${l.zones.join("/") || "any"}, ${l.bedsMin}+ bd, timeline ${l.timelineMonths ?? "unknown"} months, ${l.financing}, stage ${l.stage}`
    ),
    `Outreach drafts waiting for approval (${pending.length}):`,
    ...pending.map((d) => `- [draft id: ${d.id}] for lead ${d.leadId}: ${d.subject}`),
    `Now: ${new Date().toISOString()}`,
    `Showings (${recent.length}, scheduled plus the last 14 days):`,
    ...recent.map(
      (s) =>
        `- [showing id: ${s.id}] lead ${s.leadId} at property ${s.propertyId}, ${s.startsAt}, ${s.durationMin} min, ${s.status}${s.feedback ? `, interest ${s.feedback.interest}, objections ${s.feedback.objections.join("/") || "none"}` : ""}`
    ),
    ...zones.map((z) => `Market zone (DEMO DATA): ${z.name}, $${z.avgPricePerSqm}/m², ${z.medianDaysOnMarket} days on market, ${z.yoyChangePct}% YoY.`),
    `Sellers (${sellers.length}):`,
    ...sellers.map((s) => `- ${s.name} [/sellers/${s.id}] ${s.kind} at ${s.address}, ${s.zone}, ${s.sqm} m², ${s.beds} bd, asking ${s.askingPrice ? `$${s.askingPrice}` : "not stated"}, stage ${s.stage}${s.propertyId ? `, listing ${s.propertyId}` : ""}`),
  ].join("\n");
}

export async function POST(req: Request) {
  const body = (await req.json()) as { history?: AskAiMessage[]; mode?: "card" | "drawer" };
  if (!Array.isArray(body.history) || body.history.length === 0) {
    return Response.json({ error: "history must be a non-empty array" }, { status: 400 });
  }

  // Demo desk without a Claude key, or no operator unlock: answer from the real records with the deterministic assistant.
  const operatorLocked = Boolean(requireOperator(req));
  if (operatorLocked || (!isClaudeConfigured() && currentDeskMode() === "demo")) {
    const last = body.history[body.history.length - 1];
    if (last.attachments?.length) {
      return Response.json({
        answer: operatorLocked
          ? "I can't read attachments without the operator key. Unlock it on the [operator page](/operator) and I'll analyze photos and documents alongside your listings."
          : "I can't read attachments in demo mode. Connect an ANTHROPIC_API_KEY and I'll analyze photos and documents alongside your listings.",
        engine: "fallback",
        demo: true,
      });
    }
    const [leads, props, zone, drafts, showings] = await Promise.all([listLeads(), listProperties(), getZone(), listDrafts(), listShowings()]);
    const reply = buildDemoReply(last.content, leads, props, zone, Date.now(), drafts, showings);
    return Response.json({ ...(await applyRiskPolicy(req, reply)), engine: "fallback", demo: true });
  }

  const recordContext = await snapshot();
  if (body.mode === "drawer") {
    const result = await askAiWithProposal({ systemPrompt: SYSTEM_PROMPT, recordContext, history: body.history, proposalInstruction: PROPOSAL_INSTRUCTION });
    return Response.json(await applyRiskPolicy(req, { ...result, command: Boolean(result.proposal) }));
  }
  return Response.json(await askAi({ systemPrompt: SYSTEM_PROMPT, recordContext, history: body.history }));
}
