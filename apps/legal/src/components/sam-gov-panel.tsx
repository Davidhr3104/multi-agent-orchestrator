"use client";

import { useEffect, useMemo, useState } from "react";
import type { StoredRfp } from "@helix/core";
import { formatUsdEstimate, summarizeDeskUsage } from "@/lib/ai-cost";
import type { LegalRfp } from "@/lib/legal-rfp";
import type { SamImportResult } from "@/lib/sam-import";
import type { SamProfileFilters } from "@/lib/sam-mapping";
import { cn } from "@/lib/utils";

type SamStatus = {
  configured: boolean;
  claudeConfigured: boolean;
  cronConfigured: boolean;
  persisted: boolean;
  deskMode: "demo" | "live";
  suggested: SamProfileFilters;
  procurementTypes: Record<string, string>;
  defaultLimit: number;
  maxLimit: number;
  lastRun: SamImportResult | null;
};

const PANEL_STYLE = {
  background: "linear-gradient(145deg, rgba(24, 29, 41, 0.75) 0%, rgba(13, 16, 23, 0.85) 100%)",
  backdropFilter: "blur(12px)",
  border: "1px solid rgba(226, 232, 240, 0.12)",
  boxShadow: "0 10px 30px -5px rgba(0, 0, 0, 0.6), inset 0 1px 0 0 rgba(255, 255, 255, 0.15)",
} as const;

const INPUT_CLASS =
  "h-8 w-full rounded-[4px] border border-white/15 bg-[#090b10]/85 px-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none";

async function fetchSamStatus(): Promise<SamStatus | null> {
  try {
    const res = await fetch("/api/sam/import");
    return res.ok ? ((await res.json()) as SamStatus) : null;
  } catch {
    return null;
  }
}

function when(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString();
}

export function SamGovPanel({ rfps, onImported }: { rfps: StoredRfp[]; onImported: () => void | Promise<void> }) {
  const [status, setStatus] = useState<SamStatus | null>(null);
  const [ncode, setNcode] = useState("");
  const [state, setState] = useState("");
  const [title, setTitle] = useState("");
  const [ptype, setPtype] = useState("");
  const [daysBack, setDaysBack] = useState(14);
  const [limit, setLimit] = useState(5);
  const [busy, setBusy] = useState(false);
  const [confirmLeaveDemo, setConfirmLeaveDemo] = useState(false);
  const [result, setResult] = useState<SamImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  function applyStatus(data: SamStatus | null, applyDefaults: boolean) {
    setStatus(data);
    if (!data || !applyDefaults) return;
    setNcode(data.suggested.ncode ?? "");
    setState(data.suggested.state ?? "");
    setTitle(data.suggested.title ?? "");
    setPtype(data.suggested.ptype ?? "");
    setLimit(data.defaultLimit);
  }

  async function loadStatus(applyDefaults: boolean) {
    applyStatus(await fetchSamStatus(), applyDefaults);
  }

  useEffect(() => {
    void fetchSamStatus().then((data) => applyStatus(data, true));
    const onRefresh = () => void fetchSamStatus().then((data) => applyStatus(data, false));
    window.addEventListener("helix:desk-refresh", onRefresh);
    return () => window.removeEventListener("helix:desk-refresh", onRefresh);
  }, []);

  const samRfps = useMemo(() => rfps.filter((r) => (r as LegalRfp).source?.kind === "sam.gov") as LegalRfp[], [rfps]);
  const proposed = samRfps.filter((r) => !r.partnerDecision).length;
  const cost = useMemo(() => summarizeDeskUsage(rfps as LegalRfp[]), [rfps]);

  async function runImport(leaveDemo: boolean) {
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/sam/import", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ncode, state, title, ptype, daysBack, limit, leaveDemo }),
      });
      const data = (await res.json().catch(() => null)) as (SamImportResult & { error?: unknown }) | null;
      if (!data || typeof data !== "object") throw new Error(`Import failed (HTTP ${res.status})`);
      if (typeof data.error === "string") throw new Error(data.error);
      if (data.status === "desk_in_demo") {
        setConfirmLeaveDemo(true);
        return;
      }
      setConfirmLeaveDemo(false);
      setResult(data);
      if (data.status === "imported") {
        window.dispatchEvent(new CustomEvent("helix:desk-refresh"));
        await onImported();
      }
      await loadStatus(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  const last = result ?? status?.lastRun ?? null;
  const lastOk = last?.status === "imported";

  return (
    <section id="legal-sam-gov" className="animate-entrance relative overflow-hidden rounded-xl p-4" style={PANEL_STYLE}>
      <div className="flex flex-col gap-2 pb-3 sm:flex-row sm:items-start sm:justify-between" style={{ borderBottom: "1px solid rgba(226, 232, 240, 0.1)" }}>
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-[14px] font-semibold text-slate-100">SAM.gov · federal RFPs</h2>
            <span
              className={cn(
                "rounded-[3px] px-1.5 py-0.5 text-[10px] font-semibold",
                status?.configured ? "bg-[#064E3B] text-[#6EE7B7]" : "bg-[#1F2937] text-[#9CA3AF]"
              )}
            >
              {status == null ? "Checking…" : status.configured ? "API key set" : "Not connected"}
            </span>
            {lastOk ? (
              <span className="rounded-[3px] bg-[#1E3A8A] px-1.5 py-0.5 text-[10px] font-semibold text-[#93C5FD]">
                Real data from api.sam.gov · {when(last.at)}
              </span>
            ) : null}
          </div>
          <p className="mt-0.5 text-[11px] text-slate-400">
            Imports real federal notices as RFPs proposed for partner review. Helix extracts, checks conflicts and recommends; the partner decides.
          </p>
        </div>
        <div className="text-right text-[11px] text-slate-400">
          <div>
            {samRfps.length} from SAM.gov · <span className="text-slate-200">{proposed} proposed for review</span>
          </div>
          <div className="mt-0.5">
            Daily sync: {status?.cronConfigured ? "scheduled (Vercel Cron, 12:00 UTC)" : "off (CRON_SECRET not set)"}
          </div>
        </div>
      </div>

      {status && !status.configured ? (
        <div className="mt-3 rounded-lg border border-white/10 bg-white/[0.03] p-3 text-[11px] leading-relaxed text-slate-300">
          <p className="font-semibold text-slate-100">Connect SAM.gov</p>
          <ol className="mt-1 list-decimal space-y-0.5 pl-4">
            <li>Sign in at sam.gov (Login.gov account).</li>
            <li>Open your profile → Account Details, enter your password and request a Public API Key.</li>
            <li>Set it as SAM_GOV_API_KEY in this project&apos;s environment variables and redeploy.</li>
          </ol>
          <p className="mt-1 text-slate-500">Until then nothing is imported and no SAM.gov data is shown.</p>
        </div>
      ) : null}

      <div className="mt-3 grid grid-cols-2 gap-2 md:grid-cols-6">
        <label className="space-y-1 text-[10px] tracking-wider text-slate-400 uppercase">
          NAICS
          <input className={INPUT_CLASS} value={ncode} onChange={(e) => setNcode(e.target.value.replace(/\D/g, "").slice(0, 6))} placeholder="541110" />
        </label>
        <label className="space-y-1 text-[10px] tracking-wider text-slate-400 uppercase">
          State
          <input className={INPUT_CLASS} value={state} onChange={(e) => setState(e.target.value.replace(/[^a-z]/gi, "").slice(0, 2).toUpperCase())} placeholder="Any" />
        </label>
        <label className="col-span-2 space-y-1 text-[10px] tracking-wider text-slate-400 uppercase">
          Title keyword
          <input className={INPUT_CLASS} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Any" />
        </label>
        <label className="space-y-1 text-[10px] tracking-wider text-slate-400 uppercase">
          Notice type
          <select className={INPUT_CLASS} value={ptype} onChange={(e) => setPtype(e.target.value)}>
            <option value="">All types</option>
            {Object.entries(status?.procurementTypes ?? {}).map(([code, label]) => (
              <option key={code} value={code}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <div className="grid grid-cols-2 gap-2">
          <label className="space-y-1 text-[10px] tracking-wider text-slate-400 uppercase">
            Days
            <select className={INPUT_CLASS} value={daysBack} onChange={(e) => setDaysBack(Number(e.target.value))}>
              {[3, 7, 14, 30, 90].map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1 text-[10px] tracking-wider text-slate-400 uppercase">
            Max
            <select className={INPUT_CLASS} value={limit} onChange={(e) => setLimit(Number(e.target.value))}>
              {[3, 5, 10, 25].filter((n) => n <= (status?.maxLimit ?? 25)).map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      {status?.suggested ? (
        <div className="mt-2 space-y-1 text-[10px] text-slate-500">
          <p>From the firm profile: {status.suggested.rationale.join(" ")}</p>
          {status.suggested.suggestedKeywords.length ? (
            <div className="flex flex-wrap items-center gap-1">
              <span>Keyword ideas:</span>
              {status.suggested.suggestedKeywords.map((k) => (
                <button
                  key={k}
                  type="button"
                  className={cn("rounded-[3px] border px-1.5 py-0.5", title === k ? "border-white/40 text-slate-100" : "border-white/10 text-slate-400 hover:text-slate-100")}
                  onClick={() => setTitle(title === k ? "" : k)}
                >
                  {k}
                </button>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={busy || !status?.configured}
          className="btn-tactile flex items-center gap-1 rounded-[4px] px-3 py-1.5 text-[11px] font-semibold transition-all disabled:cursor-not-allowed disabled:opacity-40"
          style={{
            background: "linear-gradient(180deg, #ffffff 0%, #cbd5e1 50%, #94a3b8 100%)",
            color: "#090b10",
            border: "1px solid rgba(255,255,255,0.4)",
          }}
          onClick={() => void runImport(false)}
        >
          <span className="material-symbols-outlined text-[14px]">cloud_download</span>
          {busy ? "Importing from SAM.gov…" : "Import from SAM.gov"}
        </button>
        <span className="text-[10px] text-slate-500">
          Each import uses 1 SAM.gov search plus 1 request per notice description; public keys have a small daily quota.
          {status?.claudeConfigured ? " Claude runs 3 calls per notice (extraction, COI, Go/No-Go)." : " Without ANTHROPIC_API_KEY, extraction and recommendations are rule-based, not AI."}
        </span>
      </div>

      {confirmLeaveDemo ? (
        <div className="mt-3 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-[11px] text-amber-100">
          <p className="font-semibold">The desk is showing demo RFPs.</p>
          <p className="mt-0.5">Real SAM.gov notices never mix with demo data. Importing removes the samples and switches this desk to your own data.</p>
          <div className="mt-2 flex gap-2">
            <button type="button" disabled={busy} className="rounded-[4px] bg-amber-200 px-2.5 py-1 font-semibold text-[#0b0d12] disabled:opacity-40" onClick={() => void runImport(true)}>
              Leave demo and import
            </button>
            <button type="button" className="rounded-[4px] border border-white/20 px-2.5 py-1 text-slate-200" onClick={() => setConfirmLeaveDemo(false)}>
              Cancel
            </button>
          </div>
        </div>
      ) : null}

      {error ? <p className="mt-3 rounded-lg border border-rose-500/30 bg-rose-500/10 p-2 text-[11px] text-rose-200">{error}</p> : null}

      {last ? (
        <div
          className={cn(
            "mt-3 rounded-lg border p-3 text-[11px]",
            last.status === "imported"
              ? "border-emerald-500/25 bg-emerald-500/5 text-slate-200"
              : last.error?.kind === "rate_limited"
                ? "border-amber-500/30 bg-amber-500/10 text-amber-100"
                : last.status === "desk_in_demo"
                  ? "border-white/10 bg-white/[0.03] text-slate-300"
                  : "border-rose-500/30 bg-rose-500/10 text-rose-100"
          )}
        >
          <p className="font-semibold">
            {result ? "This import" : `Last run (${last.via === "cron" ? "daily sync" : "manual"})`} · {when(last.at)}
          </p>
          <p className="mt-0.5">{last.message}</p>
          {last.error?.kind === "rate_limited" && last.error.retryAfterSeconds != null ? (
            <p className="mt-0.5">Retry after about {Math.ceil(last.error.retryAfterSeconds / 60)} min.</p>
          ) : null}
          {last.status === "imported" ? (
            <p className="mt-0.5 text-slate-400">
              {last.totalRecords ?? 0} matching on SAM.gov · {last.imported.length} new · {last.skippedExisting} already on desk ·{" "}
              {last.descriptionsFetched} descriptions read
              {last.rateLimitRemaining != null ? ` · ${last.rateLimitRemaining} SAM.gov requests left today` : ""}
              {" · AI cost "}
              {formatUsdEstimate(last.estimatedUsd)} (estimated)
            </p>
          ) : null}
          {last.imported.length ? (
            <ul className="mt-2 space-y-1">
              {last.imported.map((item) => (
                <li key={item.id} className="flex flex-wrap items-center gap-2">
                  <a className="text-slate-100 underline-offset-2 hover:underline" href={item.uiLink} target="_blank" rel="noreferrer">
                    {item.title}
                  </a>
                  <span className="text-slate-500">{item.agency}</span>
                  <span className="rounded-[3px] bg-white/5 px-1 text-[10px] text-slate-300">
                    {item.extraction === "claude" ? "Claude extraction" : "Rule-based extraction"}
                  </span>
                  {item.recommendation ? (
                    <span className="rounded-[3px] bg-white/5 px-1 text-[10px] text-slate-300">Recommends {item.recommendation} · partner decides</span>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : null}
          {last.warnings.length ? (
            <ul className="mt-2 list-disc space-y-0.5 pl-4 text-amber-200/90">
              {last.warnings.map((w) => (
                <li key={w}>{w}</li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-white/10 pt-3 text-[11px] text-slate-400">
        <span className="font-semibold text-slate-200">AI cost (estimated)</span>
        <span>{formatUsdEstimate(cost.estimatedUsd)} total</span>
        <span>{cost.calls} Claude calls</span>
        <span>
          {cost.inputTokens.toLocaleString()} in / {cost.outputTokens.toLocaleString()} out tokens
        </span>
        <span className="text-slate-500">
          List-price estimate, not your Anthropic invoice. Counts cited extraction, Go/No-Go recommendations and COI checks; Ask AI and the first scoring pass of manual uploads are not metered yet.
        </span>
      </div>
    </section>
  );
}
