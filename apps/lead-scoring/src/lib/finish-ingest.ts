import {
  attachIntelligence,
  enrichEmailDomain,
  findDuplicate,
  type LeadEmit,
  type LeadIngestInput,
} from "@helix/core";
import { listLeads, saveLead } from "@/lib/store";
import { applyBrainPolicies, getBrain } from "@/lib/brain";
import { notifySlackHitl } from "@/lib/slack";
import { bumpUsage } from "@/lib/usage";
import { assignSalesRep } from "@/lib/reps";
import { runTriagePipeline } from "@/lib/lead-triage";
import type { HelixLead } from "@/lib/lead-ai";

export async function finishLeadIngest(
  parsed: LeadIngestInput,
  emit: LeadEmit,
  orgId?: string,
  opts?: { real?: boolean }
): Promise<HelixLead> {
  const existing = findDuplicate(await listLeads(orgId), parsed);
  if (existing) {
    emit({
      type: "log",
      log: {
        id: `log-dedup-${Date.now()}`,
        ts: new Date().toISOString(),
        agent: "orchestrator",
        level: "warn",
        message: `Possible duplicate of ${existing.id} — saved as a separate lead pending manual merge.`,
        field: "email",
        evidence: existing.email,
      },
    });
  }
  const brain = getBrain();
  const scored = await runTriagePipeline(parsed, emit, {
    hitl: brain.hitl,
    addendum: brain.addendum,
    thresholds: brain.thresholds,
  });
  bumpUsage(scored.aiTriage?.engine === "claude" ? "claude" : "heuristic");
  const all = await listLeads(orgId);
  const lead: HelixLead = {
    ...applyBrainPolicies(attachIntelligence(scored, null, all), brain),
    aiTriage: scored.aiTriage,
  };
  if (existing) {
    lead.duplicateOf = existing.id;
  }
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
  await saveLead(lead, orgId, { real: opts?.real });
  if (lead.needsReview && brain.automations.hitl) {
    await notifySlackHitl(
      {
        id: lead.id,
        name: lead.name,
        score: lead.score,
        reason: lead.reasoning.slice(0, 180),
      },
      orgId
    );
  }
  return lead;
}
