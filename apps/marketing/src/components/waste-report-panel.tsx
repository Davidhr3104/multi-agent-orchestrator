"use client";

import { useCallback, useEffect, useState } from "react";
import type { SourceStatus } from "@/lib/ad-sources";
import type { AiUsageTotals } from "@/lib/ai-usage";
import type { WasteProposal, WasteReport } from "@/lib/waste-report";
import { money } from "@/lib/format";
import { cn } from "@/lib/utils";

type Payload = {
  mode?: "demo" | "live";
  report: WasteReport | null;
  aiUsage: AiUsageTotals;
  sources: Record<"meta" | "google" | "tiktok", SourceStatus>;
};

const SOURCE_NAMES = { meta: "Meta Ads", google: "Google Ads", tiktok: "TikTok Ads" } as const;

function when(iso: string | null) {
  if (!iso) return "";
  return new Date(iso).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

function SourceRow({ s }: { s: SourceStatus }) {
  let text: string;
  let tone: string;
  if (s.verified) {
    text = `Connected · last read ${when(s.lastOkAt)} (${s.lastRows ?? 0} rows)`;
    tone = "text-success-emerald";
  } else if (s.configured && s.lastError) {
    text = `Read failed: ${s.lastError}`;
    tone = "text-alert-rose";
  } else if (s.configured) {
    text = "Keys saved — not verified yet (no successful read). Run Sync.";
    tone = "text-marketing-amber";
  } else {
    text = s.source === "meta" ? "Not configured — use CSV or add Meta keys" : "Token only — reads nothing until all credentials are set";
    tone = "text-on-surface-variant";
  }
  return (
    <div className="flex flex-col gap-0.5 rounded-lg border border-[var(--border-hairline)] bg-surface-container p-3">
      <span className="text-xs font-bold text-on-surface">{SOURCE_NAMES[s.source]}</span>
      <span className={cn("text-[11px] leading-snug", tone)}>{text}</span>
    </div>
  );
}

function confirmText(p: WasteProposal) {
  const verb = p.action === "pause_campaign" ? "Pause" : "Scale";
  return (
    `${verb} "${p.label}"?\n\n${p.reason}\n\n` +
    (p.action === "pause_campaign" ? "Pausing stops ad delivery." : "Scaling raises spend (+20% daily budget on Meta).") +
    " It is written to Meta Ads Manager only if Meta is connected and this is a Meta campaign; otherwise the decision is saved in Helix only. Google Ads and TikTok are never written to."
  );
}

export function WasteReportPanel({ onChanged }: { onChanged?: () => void }) {
  const [data, setData] = useState<Payload | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState<{ msg: string; err?: boolean } | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/waste-report");
    if (res.ok) setData((await res.json()) as Payload);
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/waste-report")
      .then((res) => (res.ok ? (res.json() as Promise<Payload>) : null))
      .then((payload) => {
        if (!cancelled && payload) setData(payload);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  async function generate() {
    setBusy("generate");
    setNote(null);
    try {
      const res = await fetch("/api/waste-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ window: "7d" }),
      });
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) setNote({ msg: body.error || "Could not build the report.", err: true });
      await load();
    } finally {
      setBusy(null);
    }
  }

  async function syncAll() {
    setBusy("sync");
    setNote(null);
    try {
      const res = await fetch("/api/ads/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source: "all", window: "7d" }),
      });
      const body = (await res.json().catch(() => ({}))) as { imported?: number; error?: string };
      setNote(res.ok ? { msg: `Imported ${body.imported ?? 0} spend rows from the platform APIs.` } : { msg: body.error || "Sync failed.", err: true });
      await load();
      onChanged?.();
    } finally {
      setBusy(null);
    }
  }

  async function confirmProposal(p: WasteProposal) {
    if (!window.confirm(confirmText(p))) return;
    setBusy(p.campaignId);
    try {
      const res = await fetch("/api/ask-ai/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: p.action, targetIds: [p.campaignId], labels: [p.label], params: { note: `Waste report: ${p.reason}` } }),
      });
      const body = (await res.json().catch(() => ({}))) as { resultText?: string; error?: string };
      setNote(res.ok ? { msg: body.resultText || "Done." } : { msg: body.error || "Not applied.", err: true });
      onChanged?.();
      await generate();
    } finally {
      setBusy(null);
    }
  }

  const report = data?.report ?? null;
  const m = report?.metrics;
  const usage = data?.aiUsage;

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-[var(--border-hairline)] bg-surface-container-low p-5 shadow-sm">
      <div className="flex flex-col justify-between gap-3 border-b border-[var(--border-hairline)] pb-3 sm:flex-row sm:items-center">
        <div className="flex items-center gap-3">
          <div className="flex size-8 items-center justify-center rounded-lg bg-surface-container text-primary">
            <span className="material-symbols-outlined text-[18px]">psychology</span>
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-base font-bold tracking-tight text-on-surface">Spend waste report</h2>
              {report ? (
                <>
                  <span
                    className={cn(
                      "rounded border px-2 py-0.5 font-mono text-[10px] font-bold",
                      report.engine === "claude"
                        ? "border-tertiary/30 bg-tertiary/10 text-tertiary"
                        : "border-[var(--border-hairline)] bg-surface-container text-on-surface-variant"
                    )}
                  >
                    {report.engine === "claude" ? "Explained by Claude" : "Deterministic — no AI"}
                  </span>
                  <span
                    className={cn(
                      "rounded border px-2 py-0.5 font-mono text-[10px] font-bold",
                      report.dataKind === "demo"
                        ? "border-marketing-amber/30 bg-marketing-amber/10 text-marketing-amber"
                        : "border-success-emerald/30 bg-success-emerald/10 text-success-emerald"
                    )}
                  >
                    {report.dataKind === "demo" ? "Demo data" : "Your data"}
                  </span>
                </>
              ) : null}
            </div>
            <p className="text-xs text-on-surface-variant">
              Spend joined with lead quality. Every number is computed by Helix; the AI only explains it.
              {report ? ` Generated ${when(report.generatedAt)} (${report.trigger}).` : ""}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            disabled={busy !== null}
            onClick={() => void syncAll()}
            className="flex h-8 items-center gap-1.5 rounded-lg border border-[var(--border-hairline)] bg-surface-container px-3 text-xs text-on-surface hover:bg-surface-container-high disabled:opacity-50"
          >
            <span className="material-symbols-outlined text-[15px]">sync</span>
            {busy === "sync" ? "Syncing…" : "Sync ad platforms"}
          </button>
          <button
            type="button"
            disabled={busy !== null}
            onClick={() => void generate()}
            className="flex h-8 items-center gap-1.5 rounded-lg bg-gradient-to-r from-primary-container to-marketing-amber px-3 text-xs font-semibold text-white disabled:opacity-50"
          >
            <span className="material-symbols-outlined text-[15px]">analytics</span>
            {busy === "generate" ? "Analysing…" : "Generate report"}
          </button>
        </div>
      </div>

      {data ? (
        <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
          {(["meta", "google", "tiktok"] as const).map((k) => (
            <SourceRow key={k} s={data.sources[k]} />
          ))}
        </div>
      ) : null}

      {note ? <p className={cn("text-xs", note.err ? "text-alert-rose" : "text-success-emerald")}>{note.msg}</p> : null}

      {!report || !m ? (
        <p className="text-xs text-on-surface-variant">
          No report yet. Upload spend (CSV) or sync an ad platform, sync scored leads, then Generate report. The daily
          cron builds one automatically when CRON_SECRET is set.
        </p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 font-mono text-xs md:grid-cols-5">
            {[
              ["Joined spend", money(m.totalSpend, 2)],
              ["Spend on spam", money(m.spendOnSpam, 2)],
              ["Waste ratio", `${Math.round(m.wastePct * 100)}%`],
              ["Cost / good lead", m.blendedCostPerGoodLead !== null ? money(m.blendedCostPerGoodLead, 2) : "—"],
              ["Not judged (no leads)", money(m.unjudgedSpend, 2)],
            ].map(([label, value]) => (
              <div key={label} className="rounded-lg border border-[var(--border-hairline)] bg-surface-container p-3">
                <p className="text-[10px] text-on-surface-variant uppercase">{label}</p>
                <p className="mt-1 text-sm font-bold text-on-surface">{value}</p>
              </div>
            ))}
          </div>

          {m.bySource.length ? (
            <div className="flex flex-col gap-1.5">
              <p className="font-mono text-[10px] text-on-surface-variant uppercase">Spend on spam by platform ({m.from} → {m.to})</p>
              {m.bySource.map((s) => (
                <div key={s.source} className="flex items-center justify-between rounded-lg bg-surface-container px-3 py-2 text-xs">
                  <span className="font-semibold text-on-surface">
                    {s.label} <span className="font-normal text-on-surface-variant">· {s.campaigns} campaign(s)</span>
                  </span>
                  <span className="font-mono">
                    <span className="font-bold text-alert-rose">{money(s.spendOnSpam, 2)}</span>
                    <span className="text-on-surface-variant"> of {money(s.spend, 2)}</span>
                  </span>
                </div>
              ))}
            </div>
          ) : null}

          <div className="flex flex-col gap-2 rounded-xl border border-[var(--border-hairline)] bg-surface-container p-4">
            <p className="text-sm text-on-surface">{report.narrative.summary}</p>
            {report.narrative.campaigns.map((c) => (
              <p key={c.campaignId} className="text-xs text-on-surface-variant">
                <strong className="text-on-surface">{c.name}:</strong> {c.why}
              </p>
            ))}
            {report.unverifiedNumbers.length ? (
              <p className="text-[11px] text-marketing-amber">
                Check: the AI text mentions numbers not in the computed metrics ({report.unverifiedNumbers.join(", ")}). Trust the
                figures above.
              </p>
            ) : null}
            <p className="text-[10px] text-on-surface-variant">{report.engineNote}</p>
          </div>

          <div className="flex flex-col gap-2">
            <p className="font-mono text-[10px] text-on-surface-variant uppercase">Proposals — each needs your confirmation</p>
            {report.proposals.length === 0 ? (
              <p className="text-xs text-on-surface-variant">No pause or scale proposals in this window.</p>
            ) : (
              report.proposals.map((p) => (
                <div
                  key={`${p.action}-${p.campaignId}`}
                  className="flex flex-col justify-between gap-2 rounded-lg border border-[var(--border-hairline)] bg-surface-container p-3 sm:flex-row sm:items-center"
                >
                  <div className="text-xs">
                    <span className={cn("font-bold", p.action === "pause_campaign" ? "text-alert-rose" : "text-success-emerald")}>
                      {p.action === "pause_campaign" ? "Pause" : "Scale"} {p.label}
                    </span>
                    <span className="text-on-surface-variant"> — {p.reason}</span>
                  </div>
                  <button
                    type="button"
                    disabled={busy !== null}
                    onClick={() => void confirmProposal(p)}
                    className="shrink-0 rounded-lg border border-[var(--border-hairline)] bg-surface-container-high px-3 py-1 text-xs font-semibold text-on-surface hover:bg-surface-container-highest disabled:opacity-50"
                  >
                    Review &amp; confirm
                  </button>
                </div>
              ))
            )}
          </div>
        </>
      )}

      {usage ? (
        <p className="border-t border-[var(--border-hairline)] pt-2 font-mono text-[10px] text-on-surface-variant">
          AI cost (estimated): ${usage.estimatedUsd.toFixed(4)} across {usage.calls} Claude call(s) · {usage.inputTokens.toLocaleString()} in /{" "}
          {usage.outputTokens.toLocaleString()} out tokens · estimate at ${usage.pricing.inputPerMillion}/${usage.pricing.outputPerMillion} per
          million tokens, not an invoice. Counts waste reports only.
        </p>
      ) : null}
    </div>
  );
}
