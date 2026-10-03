import { requireOperator } from "@helix/core/operator";
import type { LegalRfp } from "@/lib/legal-rfp";
import { checkNoBidRules, loadNoBidRules } from "@/lib/no-bid-rules";
import { extractRfpWithAi, proposeGoNoGo } from "@/lib/rfp-ai";
import { appendAiUsage, checkAndStoreConflict, getClientProfile, getRfp, recordAudit, saveRfp, updateRfpMeta } from "@/lib/store";

export const runtime = "nodejs";
export const maxDuration = 120;

/**
 * Re-runs AI on one RFP: optional cited extraction, the COI check, and a Go/No-Go recommendation.
 * Extraction keeps any partner decision untouched; nothing here records a decision.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = requireOperator(req);
  if (denied) return denied;
  const { id } = await params;
  let body: { extract?: boolean } = {};
  try {
    body = (await req.json()) as typeof body;
  } catch {
    body = {};
  }

  const current = (await getRfp(id)) as LegalRfp | null;
  if (!current) return Response.json({ error: "RFP not found" }, { status: 404 });
  const profile = getClientProfile();

  if (body.extract) {
    const ai = await extractRfpWithAi(
      { title: current.title, issuer: current.issuer, body: current.body, clientProfile: profile },
      { rfpId: id }
    );
    await saveRfp({
      ...current,
      ...ai.scored,
      needsReview: current.partnerDecision ? current.needsReview : true,
      partnerDecision: current.partnerDecision,
      extraction: ai.extraction,
      aiUsage: [...(current.aiUsage ?? []), ...ai.usage],
    } as LegalRfp);
  }

  const afterExtract = (await getRfp(id)) as LegalRfp;
  const coi = await checkAndStoreConflict(afterExtract);
  const { rules } = await loadNoBidRules();
  const hit = checkNoBidRules(`${afterExtract.title} ${afterExtract.body}`, rules);
  const fresh = ((await getRfp(id)) as LegalRfp | null) ?? afterExtract;
  const { proposal, usage } = await proposeGoNoGo(fresh, {
    profile,
    coi,
    noBidRuleHit: hit.blocked ? `"${hit.rule.pattern}" — ${hit.rule.reason}` : undefined,
  });
  await updateRfpMeta(id, { goNoGoProposal: proposal });
  if (usage.length) await appendAiUsage(id, usage);
  await recordAudit(
    "ops",
    "ai-review",
    `${fresh.title}: recommendation ${proposal.recommendation} via ${proposal.engine} · COI ${coi.verdict} via ${coi.engine} · awaiting partner decision`
  );
  return Response.json({ rfp: await getRfp(id), conflict: coi });
}
