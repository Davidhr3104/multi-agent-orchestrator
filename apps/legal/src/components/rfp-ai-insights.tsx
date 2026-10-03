"use client";

import { useState } from "react";
import type { StoredRfp } from "@helix/core";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatUsdEstimate, summarizeUsage } from "@/lib/ai-cost";
import type { CitedPoint, LegalRfp } from "@/lib/legal-rfp";
import { cn } from "@/lib/utils";

function verdictClass(v: string) {
  if (v === "NO-GO") return "border-rose-500/40 text-rose-300";
  if (v === "CONDITIONAL") return "border-amber-500/40 text-amber-200";
  return "border-emerald-500/40 text-emerald-300";
}

function Points({ title, points }: { title: string; points: CitedPoint[] }) {
  if (points.length === 0) return null;
  return (
    <div>
      <p className="text-[11px] font-semibold text-slate-300">{title}</p>
      <ul className="mt-1 space-y-1.5">
        {points.map((p, i) => (
          <li key={`${title}-${i}`} className="text-xs">
            <p className="text-slate-200">{p.point}</p>
            {p.quote ? (
              <p className={cn("mt-0.5 text-[11px]", p.verified ? "text-slate-400" : "text-amber-200/80")}>
                “{p.quote}” · {p.verified ? `cited, chars ${p.spanStart}–${p.spanEnd}` : "quote not found in the source — unverified"}
              </p>
            ) : (
              <p className="mt-0.5 text-[11px] text-slate-500">No quote from the RFP</p>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Source, AI extraction, Go/No-Go recommendation and estimated AI cost for one RFP. */
export function RfpAiInsights({ rfp, onUpdated }: { rfp: StoredRfp; onUpdated: (next: StoredRfp) => void }) {
  const r = rfp as LegalRfp;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const source = r.source;
  const proposal = r.goNoGoProposal;
  const cost = summarizeUsage(r.aiUsage);
  const isDemo = r.id.startsWith("seed-");

  async function run(extract: boolean) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/rfps/${encodeURIComponent(r.id)}/ai-review`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ extract }),
      });
      const data = (await res.json().catch(() => null)) as { rfp?: StoredRfp; error?: string } | null;
      if (!res.ok || !data?.rfp) throw new Error(data?.error ?? `AI review failed (HTTP ${res.status})`);
      onUpdated(data.rfp);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      {source ? (
        <div className="space-y-1 rounded-xl border border-[#1E3A8A]/60 bg-[#1E3A8A]/10 p-3 text-xs">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="border-[#93C5FD]/40 text-[#93C5FD]">
              Real data · SAM.gov
            </Badge>
            {!r.partnerDecision ? (
              <Badge variant="outline" className="border-amber-500/40 text-amber-200">
                Proposed for review
              </Badge>
            ) : null}
            <span className="text-[11px] text-slate-400">
              Imported {source.importedVia === "cron" ? "by the daily sync" : "manually"} · {new Date(source.importedAt).toLocaleString()}
            </span>
          </div>
          <p className="text-slate-300">{source.agency}</p>
          <p className="font-mono text-[11px] text-slate-400">
            Notice {source.noticeId}
            {source.solicitationNumber ? ` · Sol. ${source.solicitationNumber}` : ""}
            {source.naics ? ` · NAICS ${source.naics}` : ""}
          </p>
          <p className="text-[11px] text-slate-400">
            {source.noticeType ?? "Notice"} · posted {source.postedDate || "—"} · response due {source.responseDeadline ?? "not stated"}
            {source.setAside ? ` · set-aside: ${source.setAside}` : ""}
            {source.placeOfPerformance ? ` · ${source.placeOfPerformance}` : ""}
          </p>
          <p className="text-[11px] text-slate-500">
            Description:{" "}
            {source.descriptionStatus === "fetched"
              ? "read from SAM.gov"
              : `${source.descriptionStatus.replace("_", " ")}${source.descriptionNote ? ` (${source.descriptionNote})` : ""}`}
            {source.resourceLinks.length ? ` · ${source.resourceLinks.length} attachment link(s) on SAM.gov, not parsed` : ""}
          </p>
          <div className="flex flex-wrap gap-3 pt-1">
            <a className="text-[11px] text-[#93C5FD] underline-offset-2 hover:underline" href={source.publicUrl} target="_blank" rel="noreferrer">
              Open notice on SAM.gov
            </a>
            {source.uiLink !== source.publicUrl ? (
              <a className="text-[11px] text-slate-400 underline-offset-2 hover:underline" href={source.uiLink} target="_blank" rel="noreferrer">
                uiLink (SAM.gov)
              </a>
            ) : null}
          </div>
        </div>
      ) : null}

      <div className="space-y-2 rounded-xl border border-white/10 bg-white/[0.02] p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs font-semibold text-slate-100">AI review</p>
          <div className="flex gap-1.5">
            <Button size="xs" variant="outline" disabled={busy} onClick={() => void run(true)}>
              {busy ? "Running…" : "Re-extract with citations"}
            </Button>
            <Button size="xs" variant="outline" disabled={busy} onClick={() => void run(false)}>
              {proposal ? "Refresh recommendation" : "Get Go/No-Go recommendation"}
            </Button>
          </div>
        </div>
        {isDemo ? <p className="text-[11px] text-slate-500">Demo RFP: results are about sample text, not a real opportunity.</p> : null}
        <p className="text-[11px] text-slate-400">
          Extraction:{" "}
          {r.extraction
            ? r.extraction.note
            : r.engine === "claude"
              ? "Claude (scored at ingest)."
              : "Rule-based pattern matching at ingest, not AI."}
        </p>
        {proposal ? (
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className={verdictClass(proposal.recommendation)}>
                Recommends {proposal.recommendation}
              </Badge>
              <span className="text-[11px] text-slate-400">
                {proposal.engine === "claude" ? "Claude" : "Rule-based (not AI)"} · confidence {Math.round(proposal.confidence * 100)}% ·{" "}
                {new Date(proposal.generatedAt).toLocaleString()}
              </span>
              {proposal.coiVerdict ? (
                <span className="text-[11px] text-slate-400">
                  COI {proposal.coiVerdict} ({proposal.coiEngine})
                </span>
              ) : null}
            </div>
            <p className="text-xs leading-relaxed text-slate-200">{proposal.rationale}</p>
            {proposal.note ? <p className="text-[11px] text-amber-200/80">{proposal.note}</p> : null}
            {proposal.noBidRuleHit ? <p className="text-[11px] text-rose-300">No-bid rule matched: {proposal.noBidRuleHit}</p> : null}
            <Points title="Why it fits" points={proposal.reasons} />
            <Points title="Risks and gaps" points={proposal.risks} />
            {proposal.conditions.length ? (
              <div>
                <p className="text-[11px] font-semibold text-slate-300">Conditions to bid</p>
                <ul className="mt-1 list-disc space-y-0.5 pl-4 text-xs text-slate-300">
                  {proposal.conditions.map((c) => (
                    <li key={c}>{c}</li>
                  ))}
                </ul>
              </div>
            ) : null}
            <p className="rounded-lg border border-white/10 px-2 py-1.5 text-[11px] text-slate-400">
              This is a recommendation. GO / CONDITIONAL / NO-GO is recorded only when the partner confirms it with the Partner button below.
            </p>
          </div>
        ) : (
          <p className="text-[11px] text-slate-500">No recommendation yet.</p>
        )}
        {error ? <p className="text-[11px] text-rose-300">{error}</p> : null}
        <p className="border-t border-white/10 pt-2 text-[11px] text-slate-400">
          AI cost for this RFP (estimated): {formatUsdEstimate(cost.estimatedUsd)} · {cost.calls} Claude call{cost.calls === 1 ? "" : "s"} ·{" "}
          {cost.inputTokens.toLocaleString()} in / {cost.outputTokens.toLocaleString()} out tokens
        </p>
      </div>
    </div>
  );
}
