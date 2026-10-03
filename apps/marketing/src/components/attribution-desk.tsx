"use client";

import { ChartCard, DemoChip, HBarList, KpiCard } from "@helix/ui";
import { DeskGate, COLORS, FunnelCard, WindowTabs, shortName, useDemoMode } from "@/components/desk-charts";
import { RULES, attributionRows, totals } from "@/lib/desk-derive";
import { useDeskSnapshot } from "@/lib/use-desk-snapshot";
import { money } from "@/lib/format";
import { cn } from "@/lib/utils";

const TONE: Record<string, string> = {
  scale: "bg-success-emerald/15 text-success-emerald",
  pause: "bg-alert-rose/15 text-alert-rose",
  keep: "bg-marketing-amber/15 text-marketing-amber",
};

/**
 * Attribution from the desk snapshot only: spend joined to scored leads by campaign_id (one touch).
 * Multi-touch credit (Markov, Shapley, touchpoints, ROAS) needs data the desk does not have, so it is not drawn.
 */
export function AttributionDesk() {
  const { snap, win, setWin, error, loading } = useDeskSnapshot();
  const demo = useDemoMode();
  const campaigns = snap?.campaigns ?? [];
  const rows = attributionRows(campaigns);
  const t = totals(campaigns);
  const ctx = { demo, win, from: snap?.from ?? "", to: snap?.to ?? "" };

  function exportCsv() {
    const header = "campaign_id,name,platform,spend,form_leads,scored,hot,spam,cost_per_hot,score,recommendation";
    const lines = rows.map((r) =>
      [r.campaignId, r.name, r.platform, r.spend, r.forms, r.scored, r.hot, r.spam, r.costPerHot ?? "", r.scoreLabel, r.label]
        .map((v) => `"${String(v).replaceAll('"', '""')}"`)
        .join(",")
    );
    const url = URL.createObjectURL(new Blob([[header, ...lines].join("\n")], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `attribution-${win}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="flex w-full flex-col gap-4 pb-16">
      <div className="flex flex-col justify-between gap-3 lg:flex-row lg:items-end">
        <div className="max-w-2xl">
          <h1 className="text-[28px] leading-9 font-semibold tracking-tight text-on-surface">Attribution: spend to hot leads</h1>
          <p className="mt-1 text-[13px] leading-5 text-on-surface-variant">
            Each campaign&apos;s spend joined to the leads it produced, by campaign_id. The same numbers as the Performance Engine and the HITL queue.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <WindowTabs win={win} setWin={setWin} />
          <button type="button" onClick={exportCsv} disabled={rows.length === 0} className="inline-flex min-h-10 items-center rounded-lg bg-surface-container-low px-3 text-[13px] font-medium text-on-surface shadow-sm hover:bg-surface-container disabled:opacity-50 sm:min-h-9">
            Export CSV
          </button>
        </div>
      </div>

      <DeskGate loading={loading} error={error} empty={!loading && !error && campaigns.length === 0}>
        <div className="grid grid-cols-2 gap-3 xl:grid-cols-5">
          <KpiCard label="Spend" value={money(t.spend)} hint={`${t.campaigns} campaigns · ${win}`} accent={COLORS.accent} />
          <KpiCard label="Form leads" value={t.formLeads} hint="submitted forms" accent={COLORS.accent} />
          <KpiCard label="Scored leads" value={t.scored} hint={`${t.spam} spam`} accent={COLORS.accent} />
          <KpiCard label="Hot leads" value={t.hot} hint="tier hot, not spam" accent={COLORS.hot} />
          <KpiCard label="Cost per hot lead" value={t.costPerHot == null ? "—" : money(t.costPerHot, 2)} hint={`all spend ÷ hot · rule ${money(RULES.costPerHot)}`} accent={COLORS.warm} />
        </div>

        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          <FunnelCard campaigns={campaigns} ctx={ctx} />
          <ChartCard title="Spend vs hot leads" subtitle="Where the money went and what it produced" demo={ctx.demo} source={`Source: desk snapshot · ${win}`}>
            <div className="grid gap-5 sm:grid-cols-2">
              <div>
                <p className="mb-2 text-xs opacity-70">Spend</p>
                <HBarList items={rows.map((r) => ({ label: shortName(r.name), value: Math.round(r.spend), color: COLORS.accent }))} format={(n) => money(n)} />
              </div>
              <div>
                <p className="mb-2 text-xs opacity-70">Hot leads</p>
                <HBarList items={rows.map((r) => ({ label: shortName(r.name), value: r.hot, color: COLORS.hot }))} format={(n) => String(n)} />
              </div>
            </div>
          </ChartCard>
        </div>

        <section className="overflow-hidden rounded-xl border border-[var(--border-hairline)] bg-surface-container-low">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] border-collapse text-left text-xs">
              <thead className="border-b border-[var(--border-hairline)] bg-surface-container-lowest text-[11px] tracking-wider text-on-surface-variant uppercase">
                <tr>
                  <th className="px-4 py-2.5">Campaign</th>
                  <th className="px-3 py-2.5 text-right">Spend</th>
                  <th className="px-3 py-2.5 text-right">Forms</th>
                  <th className="px-3 py-2.5 text-right">Scored</th>
                  <th className="px-3 py-2.5 text-right">Hot</th>
                  <th className="px-3 py-2.5 text-right">$/hot</th>
                  <th className="px-3 py-2.5 text-right">Score</th>
                  <th className="px-3 py-2.5">Recommendation</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.05]">
                {rows.map((r) => (
                  <tr key={r.campaignId}>
                    <td className="px-4 py-3">
                      <a className="font-medium text-on-surface hover:text-primary" href={`/campaigns/${r.campaignId}`}>{r.name}</a>
                      <div className="font-mono text-[11px] text-outline">{r.campaignId} · {r.platform}</div>
                    </td>
                    <td className="px-3 py-3 text-right font-mono">{money(r.spend)}</td>
                    <td className="px-3 py-3 text-right font-mono">{r.forms}</td>
                    <td className="px-3 py-3 text-right font-mono">{r.scored}</td>
                    <td className="px-3 py-3 text-right font-mono">{r.hot}</td>
                    <td className="px-3 py-3 text-right font-mono">{r.costPerHot == null ? "—" : money(r.costPerHot, 2)}</td>
                    <td className="px-3 py-3 text-right font-mono">{r.scoreLabel}</td>
                    <td className="px-3 py-3">
                      <span className={cn("inline-flex whitespace-nowrap rounded-full px-2.5 py-0.5 font-medium", TONE[r.action] ?? TONE.keep)}>{r.label}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <details className="rounded-xl border border-[var(--border-hairline)] bg-surface-container-low p-4">
          <summary className="flex min-h-10 cursor-pointer items-center gap-2 text-sm font-medium text-on-surface">
            See example: multi-touch attribution models <DemoChip kind="illustrative" />
          </summary>
          <p className="mt-3 max-w-2xl text-[13px] leading-5 text-on-surface-variant">
            Markov, Shapley, first-touch or time-decay models split credit across several touchpoints per customer. The desk stores one campaign_id per lead and no touchpoint
            history, so these models are not computed and no ROAS or revenue is shown. Connect a source with full UTM journeys to enable them. This is a description, not data.
          </p>
        </details>
      </DeskGate>
    </div>
  );
}
