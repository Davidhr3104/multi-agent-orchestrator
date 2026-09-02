import {
  attachIntelligence,
  encodeSse,
  enrichEmailDomain,
  findDuplicate,
  isClaudeConfigured,
  parseLeadIngest,
  runLeadPipeline,
  type LeadStreamEvent,
} from "@helix/core";
import { listLeads, saveLead } from "@/lib/store";
import { addGhlReingestNote } from "@/lib/ghl";
import { getBrain } from "@/lib/brain";
import { notifySlackHitl } from "@/lib/slack";
import { bumpUsage } from "@/lib/usage";
import { assignSalesRep } from "@/lib/reps";

export const runtime = "nodejs";

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = parseLeadIngest(body);
  if (typeof parsed === "string") {
    return Response.json({ error: parsed }, { status: 400 });
  }

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: LeadStreamEvent) => {
        controller.enqueue(encodeSse(event));
      };
      try {
        const existing = findDuplicate(await listLeads(), parsed);
        if (existing) {
          send({
            type: "log",
            log: {
              id: `log-dedup-${Date.now()}`,
              ts: new Date().toISOString(),
              agent: "orchestrator",
              level: "warn",
              message: `Duplicate of ${existing.id} — will update score and note re-ingest.`,
              field: "email",
              evidence: existing.email,
            },
          });
        }
        const brain = getBrain();
        const scored = await runLeadPipeline(parsed, send, {
          hitl: brain.hitl,
          addendum: brain.addendum,
        });
        bumpUsage(isClaudeConfigured() ? "claude" : "heuristic");
        const all = await listLeads();
        const lead = attachIntelligence(scored, existing, all);
        try {
          const enriched = await enrichEmailDomain(lead.email);
          if (enriched) {
            lead.enrichedIndustry = enriched.estimated_industry;
            lead.enrichedSize = enriched.estimated_company_size;
            lead.enrichedCountry = enriched.country;
            if (lead.enrichment && enriched.estimated_industry) {
              lead.enrichment = { ...lead.enrichment, industry: enriched.estimated_industry };
            }
            if (enriched.estimated_company_size && lead.enrichment) {
              lead.enrichment = { ...lead.enrichment, employees: enriched.estimated_company_size };
            }
            if (enriched.country) lead.country = lead.country || enriched.country;
          }
        } catch {
          /* enrichment never blocks ingest */
        }
        const assigned = assignSalesRep(lead.score);
        lead.assignedRepId = assigned.id;
        lead.assignee = assigned.name;
        lead.routingReason = assigned.reason;
        await saveLead(lead);
        if (lead.needsReview) {
          await notifySlackHitl({
            id: lead.id,
            name: lead.name,
            score: lead.score,
            reason: lead.reasoning.slice(0, 180),
          });
        }
        if (existing?.ghlContactId) {
          await addGhlReingestNote(existing.ghlContactId, lead.score);
        }
        send({ type: "result", lead });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        send({ type: "error", message });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
