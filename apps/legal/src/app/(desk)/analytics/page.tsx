"use client";

import { useEffect, useMemo, useState } from "react";
import { ChartCard, Donut, EmptyChart, Funnel, HBarList } from "@helix/ui";
import type { StoredRfp } from "@helix/core";
import { Ink, INK, KpiRow, VERDICT_COLOR } from "@/components/desk-charts";
import { goFunnel, isDemoDesk, outcomeCounts, probabilityRows, STAGE_LABEL, tierCounts, verdictCounts } from "@/lib/desk-metrics";
import { goNoGo, winAnalytics } from "@/lib/rfp-intel";
import { cn } from "@/lib/utils";

export default function AnalyticsPage() {
  const [rfps, setRfps] = useState<StoredRfp[] | null>(null);

  useEffect(() => {
    void fetch("/api/rfps")
      .then((r) => r.json())
      .then((d: { rfps?: StoredRfp[] }) => setRfps(d.rfps ?? []))
      .catch(() => setRfps([]));
  }, []);

  const list = useMemo(() => rfps ?? [], [rfps]);
  const analytics = useMemo(() => winAnalytics(list), [list]);
  const tiers = useMemo(() => tierCounts(list), [list]);
  const verdicts = useMemo(() => verdictCounts(list), [list]);
  const probs = useMemo(() => probabilityRows(list), [list]);
  const outcomes = useMemo(() => outcomeCounts(list), [list]);
  const demo = isDemoDesk(list);
  const hotShare = list.length ? Math.round((tiers.hot / list.length) * 100) : 0;
  const avgProb = probs.length ? Math.round(probs.reduce((s, p) => s + p.probability, 0) / probs.length) : 0;
  const closed = outcomes.won + outcomes.lost;

  return (
    <main className="mx-auto w-full max-w-[1780px] flex-1 space-y-6 px-4 py-6 sm:px-6 lg:px-8">
      <div>
        <h1 className="font-heading text-2xl font-bold tracking-tight text-white">Analytics</h1>
        <p className="mt-1 text-sm text-slate-400">
          Modeled fit and Go/No-Go on this desk. Recorded wins and losses live in{" "}
          <a href="/outcomes" className="text-[#F59E0B] hover:underline">
            Outcomes →
          </a>
        </p>
      </div>

      <KpiRow
        items={[
          { label: "Opportunities", value: list.length, hint: "RFPs scored on this desk" },
          { label: "Hot share", value: `${hotShare}%`, hint: `${tiers.hot} of ${list.length} hot · a fit index, not a win rate` },
          {
            label: "Recorded win rate",
            value: outcomes.winRate == null ? "—" : `${Math.round(outcomes.winRate * 100)}%`,
            hint: closed ? `${outcomes.won} won of ${closed} decided bids` : "No won or lost bids recorded yet",
            accent: INK.go,
          },
          { label: "Avg win probability", value: `${avgProb}%`, hint: "Modeled before the bid decision", accent: INK.neutral },
        ]}
      />

      <Ink className="grid gap-4 lg:grid-cols-3">
        <ChartCard title="Fit tier" subtitle="Hot / warm / cold by match score" demo={demo} source="Source: heuristic match scoring of each RFP (match score, method, issuer).">
          <Donut
            ariaLabel={`Fit tier: ${tiers.hot} hot, ${tiers.warm} warm, ${tiers.cold} cold`}
            centerValue={list.length}
            centerLabel="RFPs"
            slices={[
              { label: "Hot", value: tiers.hot, color: INK.hot },
              { label: "Warm", value: tiers.warm, color: INK.warm },
              { label: "Cold", value: tiers.cold, color: INK.cold },
            ].filter((s) => s.value > 0)}
          />
        </ChartCard>
        <ChartCard title="Go / No-Go funnel" subtitle="Each step is a subset of the one above" demo={demo} source="Source: Go/No-Go engine; a recorded partner decision overrides the heuristic.">
          <Funnel steps={goFunnel(list)} color={INK.neutral} />
          <p className="mt-3 text-xs text-slate-400">
            GO {verdicts.go} · Conditional {verdicts.conditional} · No-Go {verdicts.noGo}
          </p>
        </ChartCard>
        <ChartCard title="Hot share by method" subtitle="Share of hot RFPs per method (modeled fit, not a win rate)" demo={demo} source={analytics.insight}>
          {analytics.slices.length ? (
            <HBarList
              colorAll={INK.hot}
              format={(n) => `${n}%`}
              items={analytics.slices.map((s) => ({ label: s.key, value: s.rate, hint: `${s.n} RFP${s.n === 1 ? "" : "s"}` }))}
            />
          ) : (
            <EmptyChart label="No methods detected yet" />
          )}
        </ChartCard>
      </Ink>

      <Ink>
        <ChartCard
          title="Win probability by RFP"
          subtitle="Modeled estimate before the bid decision, colored by Go/No-Go verdict"
          demo={demo}
          source="Source: match score adjusted by Go/No-Go (GO +6, Conditional -8, No-Go -22), bounded 8-92. The recorded outcome is shown beside it, not folded in."
        >
          <HBarList
            format={(n) => `${n}%`}
            items={probs.map((p) => {
              const r = list.find((x) => x.id === p.id)!;
              return { label: p.title, value: p.probability, color: VERDICT_COLOR[goNoGo(r).verdict], hint: STAGE_LABEL[p.stage] };
            })}
          />
        </ChartCard>
      </Ink>

      <section className="glass-card overflow-hidden rounded-2xl">
        <div className="border-b border-white/5 px-5 py-4">
          <h2 className="font-heading text-lg font-semibold text-white">Predictive score by RFP</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="text-[11px] font-bold tracking-wide text-slate-400 uppercase">
              <tr className="border-b border-white/10">
                <th className="px-5 py-3">Title</th>
                <th className="px-3 py-3">Method</th>
                <th className="px-3 py-3">Go/No-Go</th>
                <th className="px-3 py-3">Win probability</th>
                <th className="px-3 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {probs.map((p) => {
                const rfp = list.find((x) => x.id === p.id)!;
                const go = goNoGo(rfp);
                return (
                  <tr key={rfp.id}>
                    <td className="px-5 py-3 text-slate-100">{rfp.title}</td>
                    <td className="px-3 py-3 font-mono text-xs text-slate-400">{rfp.method}</td>
                    <td className="px-3 py-3">
                      <span
                        className={cn(
                          "rounded-md border px-2 py-0.5 text-[11px] font-semibold",
                          go.verdict === "NO-GO"
                            ? "border-rose-500/30 text-rose-300"
                            : go.verdict === "CONDITIONAL"
                              ? "border-amber-500/30 text-amber-200"
                              : "border-emerald-500/30 text-emerald-300"
                        )}
                      >
                        {go.verdict} {go.score}
                      </span>
                    </td>
                    <td className="px-3 py-3 font-mono text-gold-400">{p.probability}%</td>
                    <td className="px-3 py-3 text-xs text-slate-300">{STAGE_LABEL[p.stage]}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
