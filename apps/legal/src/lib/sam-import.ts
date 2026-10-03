import type { StoredRfp } from "@helix/core";
import type { AiUsageEntry } from "@/lib/ai-cost";
import { isClaudeKeySet } from "@/lib/claude-metered";
import { parseProfile } from "@/lib/client-profile";
import type { LegalRfp } from "@/lib/legal-rfp";
import { checkNoBidRules, loadNoBidRules } from "@/lib/no-bid-rules";
import { extractRfpWithAi, proposeGoNoGo } from "@/lib/rfp-ai";
import {
  fetchSamDescription,
  samApiKey,
  searchSamOpportunities,
  type SamDescriptionResult,
  type SamError,
  type SamSearchFilters,
} from "@/lib/sam-gov";
import { mapSamOpportunity, samFiltersFromProfile } from "@/lib/sam-mapping";
import {
  appendAiUsage,
  checkAndStoreConflict,
  clearDesk,
  deskStatus,
  getClientProfile,
  listRfps,
  recordAudit,
  saveRfp,
  updateRfpMeta,
} from "@/lib/store";
import { isSupabaseConfigured, supabaseGetMetaJson, supabaseUpsertMetaJson } from "@/lib/supabase-desk";

export const SAM_DEFAULT_LIMIT = 5;
export const SAM_MAX_LIMIT = 25;
const LAST_RUN_ID = "sam-last-run";

export type SamImportFilters = {
  ncode?: string;
  ptype?: string;
  title?: string;
  state?: string;
  daysBack: number;
  limit: number;
};

export type SamImportStatus = "imported" | "desk_in_demo" | "not_configured" | "error";

export type SamImportedItem = {
  id: string;
  title: string;
  noticeId: string;
  agency: string;
  uiLink: string;
  extraction: "claude" | "heuristic";
  recommendation?: string;
};

export type SamImportResult = {
  ok: boolean;
  status: SamImportStatus;
  via: "manual" | "cron";
  at: string;
  message: string;
  error?: SamError;
  filters?: SamImportFilters;
  totalRecords?: number;
  imported: SamImportedItem[];
  skippedExisting: number;
  descriptionsFetched: number;
  warnings: string[];
  rateLimitRemaining?: number;
  persisted: boolean;
  claudeConfigured: boolean;
  estimatedUsd: number;
};

export function parseImportFilters(raw: unknown): SamImportFilters | string {
  const row = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const str = (v: unknown) => (v == null ? undefined : String(v).trim() || undefined);
  const daysBack = Number(row.daysBack ?? 7);
  const limit = Number(row.limit ?? SAM_DEFAULT_LIMIT);
  if (!Number.isInteger(daysBack) || daysBack < 1 || daysBack > 365) return "daysBack must be between 1 and 365.";
  if (!Number.isInteger(limit) || limit < 1 || limit > SAM_MAX_LIMIT) return `limit must be between 1 and ${SAM_MAX_LIMIT}.`;
  return { ncode: str(row.ncode), ptype: str(row.ptype), title: str(row.title), state: str(row.state), daysBack, limit };
}

export function profileImportFilters(daysBack: number, limit = SAM_DEFAULT_LIMIT): SamImportFilters {
  const derived = samFiltersFromProfile(parseProfile(getClientProfile()));
  return { ncode: derived.ncode, state: derived.state, title: derived.title, ptype: derived.ptype, daysBack, limit };
}

export function toSearchFilters(f: SamImportFilters, now = new Date()): SamSearchFilters {
  return {
    postedFrom: new Date(now.getTime() - f.daysBack * 86_400_000),
    postedTo: now,
    limit: f.limit,
    ncode: f.ncode,
    ptype: f.ptype,
    title: f.title,
    state: f.state,
  };
}

async function saveLastRun(result: SamImportResult): Promise<void> {
  const g = globalThis as typeof globalThis & { __helixLegalSamLastRun?: SamImportResult };
  g.__helixLegalSamLastRun = result;
  await supabaseUpsertMetaJson(LAST_RUN_ID, result);
}

export async function lastSamRun(): Promise<SamImportResult | null> {
  const remote = await supabaseGetMetaJson<SamImportResult>(LAST_RUN_ID);
  if (remote) return remote;
  const g = globalThis as typeof globalThis & { __helixLegalSamLastRun?: SamImportResult };
  return g.__helixLegalSamLastRun ?? null;
}

/**
 * Pulls notices from SAM.gov into the desk as real RFPs "proposed for review". It runs extraction, the COI
 * check and a Go/No-Go recommendation, and never writes a partner decision — that stays with a human.
 * Real data never lands on a demo desk: manual imports must explicitly leave the demo, the cron skips.
 */
export async function importSamOpportunities(opts: {
  filters: SamImportFilters;
  via: "manual" | "cron";
  leaveDemo?: boolean;
  fetchImpl?: typeof fetch;
  now?: Date;
}): Promise<SamImportResult> {
  const at = (opts.now ?? new Date()).toISOString();
  const base: SamImportResult = {
    ok: false,
    status: "error",
    via: opts.via,
    at,
    message: "",
    filters: opts.filters,
    imported: [],
    skippedExisting: 0,
    descriptionsFetched: 0,
    warnings: [],
    persisted: isSupabaseConfigured(),
    claudeConfigured: isClaudeKeySet(),
    estimatedUsd: 0,
  };

  const apiKey = samApiKey();
  if (!apiKey) {
    return { ...base, status: "not_configured", message: "SAM_GOV_API_KEY is not set. Nothing was imported." };
  }

  const status = await deskStatus();
  if (status.mode === "demo" && (opts.via === "cron" || !opts.leaveDemo)) {
    const result: SamImportResult = {
      ...base,
      status: "desk_in_demo",
      message:
        opts.via === "cron"
          ? "Desk is showing demo data; the daily SAM.gov sync only runs on a desk using real data."
          : "Desk is showing demo data. Confirm leaving the demo before importing real SAM.gov notices.",
    };
    if (opts.via === "cron") await saveLastRun(result);
    return result;
  }

  const search = await searchSamOpportunities(toSearchFilters(opts.filters, opts.now), {
    apiKey,
    fetchImpl: opts.fetchImpl,
  });
  if (!search.ok) {
    const result: SamImportResult = { ...base, status: "error", error: search.error, message: search.error.message };
    await saveLastRun(result);
    await recordAudit(opts.via === "cron" ? "cron" : "ops", "sam.gov", `SAM.gov import failed: ${search.error.kind} — ${search.error.message}`);
    return result;
  }

  if (status.mode === "demo") await clearDesk();

  const existing = new Set((await listRfps()).map((r) => r.id));
  const profile = getClientProfile();
  const { rules } = await loadNoBidRules();
  const warnings: string[] = [];
  const imported: SamImportedItem[] = [];
  const usage: AiUsageEntry[] = [];
  let skippedExisting = 0;
  let descriptionsFetched = 0;
  let descriptionsBlocked = false;

  for (const op of search.opportunities.slice(0, opts.filters.limit)) {
    const preview = mapSamOpportunity(op, { importedVia: opts.via, importedAt: at, clientProfile: profile });
    if (!preview) {
      warnings.push("Skipped a notice without notice ID or title.");
      continue;
    }
    if (existing.has(preview.id)) {
      skippedExisting += 1;
      continue;
    }

    let description: SamDescriptionResult | undefined;
    if (!descriptionsBlocked) {
      description = await fetchSamDescription(op, { apiKey, fetchImpl: opts.fetchImpl });
      if (description.status === "fetched") descriptionsFetched += 1;
      if (description.status === "failed" && description.error.kind === "rate_limited") {
        descriptionsBlocked = true;
        warnings.push("SAM.gov rate limit hit while reading notice descriptions; remaining notices were imported from their search fields only.");
      }
    }
    const mapped = mapSamOpportunity(op, { description, importedVia: opts.via, importedAt: at, clientProfile: profile });
    if (!mapped) continue;

    const ai = await extractRfpWithAi({ ...mapped.input, clientProfile: profile }, { rfpId: mapped.id, fetchImpl: opts.fetchImpl });
    usage.push(...ai.usage);
    const rfp: LegalRfp = {
      ...ai.scored,
      needsReview: true,
      id: mapped.id,
      createdAt: at,
      runId: `sam-${opts.via}-${at}`,
      title: mapped.input.title,
      issuer: mapped.input.issuer ?? mapped.source.agency,
      body: mapped.input.body,
      clientProfile: profile,
      corpusStatus: "not_asked",
      source: mapped.source,
      extraction: ai.extraction,
      aiUsage: ai.usage,
    };
    await saveRfp(rfp as StoredRfp);
    existing.add(rfp.id);

    const coi = await checkAndStoreConflict(rfp);
    if (coi.usage) usage.push(coi.usage);
    const hit = checkNoBidRules(`${rfp.title} ${rfp.body}`, rules);
    const noBidRuleHit = hit.blocked ? `"${hit.rule.pattern}" — ${hit.rule.reason}` : undefined;
    const fresh = ((await listRfps()).find((r) => r.id === rfp.id) as LegalRfp | undefined) ?? rfp;
    const { proposal, usage: proposalUsage } = await proposeGoNoGo(fresh, {
      profile,
      coi,
      noBidRuleHit,
      fetchImpl: opts.fetchImpl,
    });
    usage.push(...proposalUsage);
    await updateRfpMeta(rfp.id, { goNoGoProposal: proposal });
    if (proposalUsage.length) await appendAiUsage(rfp.id, proposalUsage);

    await recordAudit(
      opts.via === "cron" ? "cron" : "ops",
      "sam.gov",
      `${rfp.title} · notice ${mapped.source.noticeId} imported from SAM.gov · extraction ${ai.extraction.engine} · COI ${coi.verdict} · recommendation ${proposal.recommendation} (${proposal.engine}) · proposed for partner review`
    );
    imported.push({
      id: rfp.id,
      title: rfp.title,
      noticeId: mapped.source.noticeId,
      agency: mapped.source.agency,
      uiLink: mapped.source.uiLink,
      extraction: ai.extraction.engine,
      recommendation: proposal.recommendation,
    });
  }

  if (!isSupabaseConfigured()) {
    warnings.push("Supabase is not configured: imported RFPs live only in this server instance's memory.");
  }

  const estimatedUsd = Math.round(usage.reduce((s, u) => s + u.estimatedUsd, 0) * 1_000_000) / 1_000_000;
  const result: SamImportResult = {
    ...base,
    ok: true,
    status: "imported",
    message:
      imported.length > 0
        ? `Imported ${imported.length} SAM.gov notice${imported.length === 1 ? "" : "s"} as proposed for partner review.`
        : search.totalRecords === 0
          ? "SAM.gov returned no notices for these filters."
          : "No new notices: everything returned is already on the desk.",
    totalRecords: search.totalRecords,
    imported,
    skippedExisting,
    descriptionsFetched,
    warnings,
    rateLimitRemaining: search.rateLimitRemaining,
    estimatedUsd,
  };
  await saveLastRun(result);
  return result;
}
