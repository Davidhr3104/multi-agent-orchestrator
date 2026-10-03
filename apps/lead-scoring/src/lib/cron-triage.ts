import { isDemoRecordId } from "@helix/core";
import { getBrain } from "./brain";
import { resolveCrmTarget } from "./crm-target";
import { isAnthropicConfigured } from "./anthropic";
import { isHotLead, type HelixLead } from "./lead-ai";
import { inputFromLead, triageLead } from "./lead-triage";
import { draftNextMove } from "./next-move";
import { deskModeFor, listLeads, patchLead } from "./store";
import { isSupabaseConfigured, supabaseListOrgIds } from "./supabase-leads";

/** Caps per run so one cron tick has a bounded Claude cost. */
export const MAX_TRIAGE_PER_RUN = 10;
export const MAX_DRAFTS_PER_RUN = 5;

export type CronScopeReport = {
  orgId: string | null;
  skipped?: string;
  triaged: number;
  triagedWithClaude: number;
  proposalsQueued: number;
  draftsWritten: number;
  errors: string[];
};

export type CronReport = {
  ranAt: string;
  claudeConfigured: boolean;
  crmTarget: string | null;
  scopes: CronScopeReport[];
  note: string;
};

function needsTriage(lead: HelixLead, claude: boolean): boolean {
  if (isDemoRecordId(lead.id) || lead.reviewedAt || lead.crmStatus === "sent") return false;
  if ((lead.pipelineStage ?? "new") !== "new") return false;
  if (!lead.aiTriage) return true;
  return claude && lead.aiTriage.engine !== "claude";
}

function needsProposal(lead: HelixLead): boolean {
  return (
    !isDemoRecordId(lead.id) &&
    isHotLead(lead) &&
    lead.crmStatus === "not_sent" &&
    !lead.crmProposal &&
    !lead.reviewedAt
  );
}

async function runScope(orgId: string | undefined, budget: { triage: number; drafts: number }): Promise<CronScopeReport> {
  const report: CronScopeReport = {
    orgId: orgId ?? null,
    triaged: 0,
    triagedWithClaude: 0,
    proposalsQueued: 0,
    draftsWritten: 0,
    errors: [],
  };
  if ((await deskModeFor(orgId)) === "demo") {
    report.skipped = "desk is showing demo data";
    return report;
  }
  const claude = isAnthropicConfigured();
  const brain = getBrain();
  const target = resolveCrmTarget();
  const leads = await listLeads(orgId);

  for (const lead of leads) {
    let current: HelixLead = lead;
    if (budget.triage > 0 && needsTriage(current, claude)) {
      budget.triage -= 1;
      const { result, triage } = await triageLead(inputFromLead(current), {
        hitl: brain.hitl,
        addendum: brain.addendum,
        thresholds: brain.thresholds,
      });
      const patched = await patchLead(
        current.id,
        {
          classification: result.classification,
          score: result.score,
          tier: result.tier,
          confidence: result.confidence,
          reasoning: result.reasoning,
          needsReview: result.needsReview,
          engine: result.engine,
          aiTriage: triage,
        },
        orgId
      );
      if (patched) current = patched;
      report.triaged += 1;
      if (triage.engine === "claude") report.triagedWithClaude += 1;
      else if (claude && triage.fallbackReason) report.errors.push(`${current.id}: ${triage.fallbackReason}`);
    }

    if (!needsProposal(current)) continue;
    const patch: Partial<HelixLead> = {
      crmProposal: {
        status: "pending_approval",
        target,
        queuedAt: new Date().toISOString(),
        queuedBy: "cron",
        reason: `Hot lead (score ${current.score}); waiting for a human to approve the CRM push.`,
      },
    };
    if (claude && !current.nextMove && budget.drafts > 0) {
      budget.drafts -= 1;
      const draft = await draftNextMove(current, "cron");
      if (draft.ok) {
        patch.nextMove = draft.draft;
        report.draftsWritten += 1;
      } else {
        report.errors.push(`${current.id}: ${draft.error}`);
      }
    }
    await patchLead(current.id, patch, orgId);
    report.proposalsQueued += 1;
  }
  return report;
}

/**
 * Scheduled automation: triage new real leads and queue proposals (CRM push + next-move draft)
 * for hot ones. It never pushes to a CRM or sends a message; a human approves every push.
 */
export async function runTriageCron(): Promise<CronReport> {
  let scopes: (string | undefined)[] = [undefined];
  if (isSupabaseConfigured()) {
    const orgIds = await supabaseListOrgIds();
    scopes = orgIds ?? [];
  }
  const budget = { triage: MAX_TRIAGE_PER_RUN, drafts: MAX_DRAFTS_PER_RUN };
  const reports: CronScopeReport[] = [];
  for (const orgId of scopes) {
    try {
      reports.push(await runScope(orgId, budget));
    } catch (err) {
      reports.push({
        orgId: orgId ?? null,
        triaged: 0,
        triagedWithClaude: 0,
        proposalsQueued: 0,
        draftsWritten: 0,
        errors: [err instanceof Error ? err.message : String(err)],
      });
    }
  }
  return {
    ranAt: new Date().toISOString(),
    claudeConfigured: isAnthropicConfigured(),
    crmTarget: resolveCrmTarget(),
    scopes: reports,
    note: "Proposals only. No CRM push or message was sent; approve each lead in the desk.",
  };
}
