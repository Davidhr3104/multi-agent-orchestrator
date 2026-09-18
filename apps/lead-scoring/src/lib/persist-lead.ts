import {
  attachIntelligence,
  enrichEmailDomain,
  findDuplicate,
  isClaudeConfigured,
  runLeadPipeline,
  type LeadEmit,
  type LeadIngestInput,
  type StoredLead,
} from "@helix/core";
import { listLeads, saveLead } from "@/lib/store";
import { addGhlReingestNote } from "@/lib/ghl";
import { getBrain } from "@/lib/brain";
import { notifySlackHitl } from "@/lib/slack";
import { bumpUsage } from "@/lib/usage";
import { assignSalesRep } from "@/lib/reps";

const silent: LeadEmit = () => {};

export async function persistIngestedLead(
  parsed: LeadIngestInput,
  emit: LeadEmit = silent
): Promise<StoredLead> {
  const existing = findDuplicate(await listLeads(), parsed);
  if (existing) {
    emit({
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
  const scored = await runLeadPipeline(parsed, emit, {
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
  return lead;
}
