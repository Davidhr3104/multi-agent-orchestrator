"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { LegalOutcomesSummary, MatterOutcome, StoredRfp } from "@helix/core";
import { formatUsdNumber } from "@/lib/money";
import { cn } from "@/lib/utils";

function effectiveOutcome(rfp: StoredRfp): MatterOutcome | null {
  const d = rfp.partnerDecision;
  if (!d) return null;
  if (d.outcome) return d.outcome;
  if (d.verdict === "NO-GO") return "no_bid";
  return "pending";
}

function pct(rate: number | null): string {
  if (rate == null) return "—";
  return `${Math.round(rate * 100)}%`;
}

function outcomeLabel(o: MatterOutcome): string {
  if (o === "no_bid") return "No bid";
  return o.charAt(0).toUpperCase() + o.slice(1);
}

export function OutcomesDesk({
  initialRfps,
  initialOutcomes,
}: {
  initialRfps: StoredRfp[];
  initialOutcomes: LegalOutcomesSummary;
}) {
  const [rfps, setRfps] = useState(initialRfps);
  const [outcomes, setOutcomes] = useState(initialOutcomes);
  const [filter, setFilter] = useState<"all" | "pending" | "won" | "lost" | "no_bid">("all");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    const res = await fetch("/api/outcomes", { cache: "no-store" });
    const data = (await res.json()) as { rfps?: StoredRfp[]; outcomes?: LegalOutcomesSummary };
    setRfps(data.rfps ?? []);
    if (data.outcomes) setOutcomes(data.outcomes);
  }

  const rows = useMemo(() => {
    return rfps
      .filter((r) => r.partnerDecision)
      .filter((r) => {
        const o = effectiveOutcome(r);
        if (filter === "all") return true;
        return o === filter;
      })
      .sort((a, b) => (b.partnerDecision?.decidedAt ?? "").localeCompare(a.partnerDecision?.decidedAt ?? ""));
  }, [rfps, filter]);

  async function setOutcome(id: string, outcome: MatterOutcome) {
    setBusyId(id);
    setError(null);
    try {
      const res = await fetch(`/api/rfps/${id}/outcome`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ outcome }),
      });
      const data = (await res.json()) as { rfp?: StoredRfp; error?: string };
      if (!res.ok || !data.rfp) {
        setError(data.error ?? "Could not update outcome");
        return;
      }
      setRfps((prev) => prev.map((r) => (r.id === data.rfp!.id ? data.rfp! : r)));
      await refresh();
    } finally {
      setBusyId(null);
    }
  }

  return (
    <main className="mx-auto w-full max-w-[1720px] flex-1 space-y-4 p-5">
      <div className="animate-entrance stagger-1 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[18px] font-semibold text-[#F3F4F6]">Outcomes</h1>
          <p className="mt-1 max-w-2xl text-[12px] text-[#6B7280]">
            Closed-loop win rate after partner GO — not modeled fit. Track won / lost / no-bid so the desk
            proves which pursuits actually close.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => void refresh()}
            className="btn-tactile rounded-[4px] border border-[#374151] bg-[#1F2937] px-3 py-1.5 text-[11px] font-medium text-[#9CA3AF] hover:border-[#4B5563] hover:text-[#F3F4F6]"
          >
            Refresh
          </button>
          <Link href="/analytics" className="text-[11px] font-medium text-[#F59E0B] hover:underline">
            Modeled analytics →
          </Link>
        </div>
      </div>

      {error ? (
        <p className="rounded-[4px] border border-[#7F1D1D] bg-[#7F1D1D]/20 px-3 py-2 text-[11px] text-[#FCA5A5]">
          {error}
        </p>
      ) : null}

      <section className="animate-entrance stagger-2 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat
          label="Win rate"
          value={pct(outcomes.winRate)}
          hint={`${outcomes.won} won · ${outcomes.lost} lost`}
          hot={outcomes.winRate != null && outcomes.winRate < 0.4}
          good={outcomes.winRate != null && outcomes.winRate >= 0.5}
        />
        <Stat
          label="$ won"
          value={formatUsdNumber(outcomes.wonUsd)}
          hint={`${outcomes.goWon} from GO · ${outcomes.conditionalWon} conditional`}
          good
        />
        <Stat
          label="Pipeline"
          value={formatUsdNumber(outcomes.pipelineUsd)}
          hint={`${outcomes.pending} pending after GO/CONDITIONAL`}
        />
        <Stat
          label="$ avoided (no-bid)"
          value={formatUsdNumber(outcomes.avoidedUsd)}
          hint={`${outcomes.noBid} NO-GO · capacity not burned`}
          good
        />
      </section>

      <section className="animate-entrance stagger-3 grid gap-3 sm:grid-cols-3">
        <Stat
          label="GO outcomes"
          value={`${outcomes.goWon}W / ${outcomes.goLost}L`}
          hint={`${outcomes.go} GO decisions`}
        />
        <Stat
          label="Decided"
          value={String(outcomes.decided)}
          hint={`${outcomes.conditional} conditional · ${outcomes.noGo} no-go`}
        />
        <Stat
          label="Worst miss"
          value={outcomes.worstMissTitle ? outcomes.worstMissTitle.slice(0, 42) : "—"}
          hint={
            outcomes.worstMissUsd
              ? `${formatUsdNumber(outcomes.worstMissUsd)} lost after pursue`
              : "No lost pursuits yet"
          }
          hot={Boolean(outcomes.worstMissUsd)}
        />
      </section>

      <div className="animate-entrance stagger-4 flex flex-wrap gap-2">
        {(
          [
            ["all", "All decided"],
            ["pending", "Pending"],
            ["won", "Won"],
            ["lost", "Lost"],
            ["no_bid", "No bid"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setFilter(id)}
            className={cn(
              "btn-tactile rounded-[4px] border px-2.5 py-1 text-[11px] font-medium",
              filter === id
                ? "border-[#F59E0B] bg-[#F59E0B]/10 text-[#F59E0B]"
                : "border-[#1F2937] bg-[#111827] text-[#9CA3AF] hover:border-[#374151] hover:text-[#F3F4F6]"
            )}
          >
            {label}
          </button>
        ))}
      </div>

      <section className="animate-entrance stagger-5 overflow-x-auto rounded-[6px] border border-[#1F2937] bg-[#111827] shadow-subtle">
        <table className="w-full min-w-[860px] border-collapse text-left">
          <thead>
            <tr className="border-b border-[#1F2937] text-[10px] font-semibold tracking-wide text-[#6B7280] uppercase">
              <th className="px-4 py-3">Matter</th>
              <th className="px-3 py-3">Verdict</th>
              <th className="px-3 py-3">Bid</th>
              <th className="px-3 py-3">Outcome</th>
              <th className="px-3 py-3">Record</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-[12px] text-[#6B7280]">
                  No partner decisions yet. Sign off GO / CONDITIONAL / NO-GO on an RFP first.
                </td>
              </tr>
            ) : (
              rows.map((rfp) => {
                const d = rfp.partnerDecision!;
                const o = effectiveOutcome(rfp)!;
                const busy = busyId === rfp.id;
                return (
                  <tr key={rfp.id} className="border-b border-[#1F2937]/80 hover:bg-[#0B0F19]/60">
                    <td className="px-4 py-3">
                      <p className="text-[12px] font-medium text-[#F3F4F6]">{rfp.title}</p>
                      <p className="mt-0.5 text-[10px] text-[#6B7280]">
                        {rfp.issuer} · {rfp.method} · {d.decidedBy}
                      </p>
                    </td>
                    <td className="px-3 py-3">
                      <span
                        className={cn(
                          "rounded-[3px] px-1.5 py-0.5 text-[10px] font-semibold",
                          d.verdict === "GO"
                            ? "bg-[#064E3B]/40 text-[#6EE7B7]"
                            : d.verdict === "CONDITIONAL"
                              ? "border border-[#F59E0B]/40 text-[#FCD34D]"
                              : "bg-[#7F1D1D]/40 text-[#FCA5A5]"
                        )}
                      >
                        {d.verdict}
                      </span>
                    </td>
                    <td className="font-mono-numbers px-3 py-3 text-[11px] text-[#9CA3AF]">
                      {d.bidAmount ?? rfp.amount}
                      {d.wonAmount && o === "won" ? (
                        <span className="mt-0.5 block text-[10px] text-[#6EE7B7]">won {d.wonAmount}</span>
                      ) : null}
                    </td>
                    <td className="px-3 py-3">
                      <span
                        className={cn(
                          "rounded-[3px] px-1.5 py-0.5 text-[10px] font-medium",
                          o === "won"
                            ? "bg-[#064E3B]/40 text-[#6EE7B7]"
                            : o === "lost"
                              ? "bg-[#7F1D1D]/40 text-[#FCA5A5]"
                              : o === "no_bid"
                                ? "text-[#9CA3AF]"
                                : "border border-[#374151] text-[#FCD34D]"
                        )}
                      >
                        {outcomeLabel(o)}
                      </span>
                    </td>
                    <td className="px-3 py-3">
                      {d.verdict === "NO-GO" ? (
                        <span className="text-[10px] text-[#6B7280]">Auto no-bid</span>
                      ) : (
                        <div className="flex flex-wrap gap-1">
                          {(["won", "lost", "pending", "withdrawn"] as const).map((next) => (
                            <button
                              key={next}
                              type="button"
                              disabled={busy || o === next}
                              onClick={() => void setOutcome(rfp.id, next)}
                              className={cn(
                                "rounded-[3px] border px-1.5 py-0.5 text-[10px] disabled:opacity-40",
                                o === next
                                  ? "border-[#F59E0B] text-[#F59E0B]"
                                  : "border-[#1F2937] text-[#9CA3AF] hover:border-[#4B5563] hover:text-[#F3F4F6]"
                              )}
                            >
                              {outcomeLabel(next)}
                            </button>
                          ))}
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </section>
    </main>
  );
}

function Stat({
  label,
  value,
  hint,
  hot,
  good,
}: {
  label: string;
  value: string;
  hint: string;
  hot?: boolean;
  good?: boolean;
}) {
  return (
    <div className="rounded-[6px] border border-[#1F2937] bg-[#111827] p-4 shadow-subtle">
      <p className="text-[10px] font-semibold tracking-wide text-[#9CA3AF] uppercase">{label}</p>
      <p
        className={cn(
          "font-mono-numbers mt-2 text-[22px] leading-none font-bold",
          hot ? "text-[#FCA5A5]" : good ? "text-[#6EE7B7]" : "text-[#F3F4F6]"
        )}
      >
        {value}
      </p>
      <p className="mt-2 text-[10px] text-[#6B7280]">{hint}</p>
    </div>
  );
}
