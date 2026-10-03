"use client";

import { useParams } from "next/navigation";
import { AreaChart, ChartCard, Donut, EmptyChart, HBarList } from "@helix/ui";
import { EngineShell } from "@/components/engine-shell";
import { COLORS, DeskGate, WindowTabs, useDemoMode } from "@/components/desk-charts";
import { actionLabel, scoreHistogram, scoreText } from "@/lib/desk-derive";
import { useDeskSnapshot } from "@/lib/use-desk-snapshot";
import { money, recTone } from "@/lib/format";
import { cn } from "@/lib/utils";

export default function CampaignDetailPage() {
  const params = useParams<{ id: string }>();
  const { snap, win, setWin, error, loading } = useDeskSnapshot();
  const demo = useDemoMode();
  const campaign = snap?.campaigns.find((c) => c.campaignId === params.id) ?? null;
  const isUnmatched = !campaign && (snap?.unmatched.some((u) => u.campaignId === params.id) ?? false);
  const leads = snap && campaign ? snap.leads.filter((l) => l.campaignId === campaign.campaignId) : [];
  const days = (campaign && snap?.seriesByCampaign[campaign.campaignId]) || [];
  const spam = leads.filter((l) => l.classification === "spam").length;
  const hot = leads.filter((l) => l.classification !== "spam" && l.tier === "hot").length;
  const other = leads.length - spam - hot;
  const source = `Source: desk snapshot · ${win}${snap ? ` (${snap.from} → ${snap.to})` : ""}`;

  return (
    <EngineShell active="engine">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <a className="inline-flex min-h-10 items-center text-xs text-[#9CA3AF] hover:text-white" href="/">
            ← Performance Engine
          </a>
          <WindowTabs win={win} setWin={setWin} />
        </div>
        <DeskGate loading={loading} error={error}>
          {isUnmatched ? (
            <div>
              <h1 className="text-2xl font-medium text-white">{params.id}</h1>
              <p className="mt-2 text-sm text-[#9CA3AF]">
                This <span className="font-mono">campaign_id</span> is in the join queue: spend without scored leads.{" "}
                <a className="text-[#F97316]" href="/unmatched">
                  Open join queue
                </a>
              </p>
            </div>
          ) : !campaign ? (
            <p className="text-sm text-[#9CA3AF]">Campaign not found in the {win} window. Try a longer window.</p>
          ) : (
            <>
              <div>
                <h1 className="text-2xl font-medium text-white">{campaign.name}</h1>
                <p className="mt-1 font-mono text-xs text-[#9CA3AF]">{campaign.campaignId}</p>
                <p className={cn("mt-3 text-sm font-medium", recTone(campaign.action).text)}>
                  REC {actionLabel(campaign)} · {Math.round(campaign.confidence * 1000) / 10}% confidence
                </p>
              </div>
              <section className="rounded-xl border border-white/[0.08] bg-[#10131a]/85 p-5">
                <dl className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
                  <Stat label="Spend" value={money(campaign.spend)} />
                  <Stat label="Avg score" value={scoreText(campaign)} />
                  <Stat label="Hot leads" value={String(campaign.metrics.nHot)} />
                  <Stat label="$ / hot" value={campaign.metrics.costPerHot == null ? "—" : money(campaign.metrics.costPerHot)} />
                </dl>
                <p className="mt-4 text-sm text-[#9CA3AF]">{campaign.reasoning}</p>
                {campaign.hitlNote ? <p className="mt-3 text-xs text-[#FBBF24]">HITL note: {campaign.hitlNote}</p> : null}
              </section>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                <ChartCard title="Daily spend" subtitle="This campaign only" demo={demo} source={source}>
                  {days.length === 0 ? <EmptyChart label="No spend in this window" /> : <AreaChart points={days.map((d) => ({ label: d.day.slice(5), value: d.spend }))} color={COLORS.accent} unit="$" ariaLabel={`Daily spend of ${campaign.name}`} />}
                </ChartCard>
                <ChartCard title="Score distribution" subtitle="Scored leads by score band" demo={demo} source={source}>
                  {leads.length === 0 ? <EmptyChart label="No scored leads" /> : <HBarList items={scoreHistogram(leads).map((b) => ({ label: b.label, value: b.value, color: COLORS.accent }))} format={(n) => String(n)} />}
                </ChartCard>
                <ChartCard title="Lead mix" subtitle="Spam, hot and the rest" demo={demo} source={source}>
                  {leads.length === 0 ? (
                    <EmptyChart label="No scored leads" />
                  ) : (
                    <Donut
                      size={132}
                      thickness={22}
                      centerValue={leads.length}
                      centerLabel="leads"
                      ariaLabel={`${spam} spam, ${hot} hot, ${other} other`}
                      slices={[
                        { label: "Spam", value: spam, color: COLORS.spam },
                        { label: "Hot", value: hot, color: COLORS.hot },
                        { label: "Other", value: other, color: COLORS.mid },
                      ]}
                    />
                  )}
                </ChartCard>
              </div>

              <section>
                <h2 className="text-sm font-semibold text-white">Scored leads in window</h2>
                {leads.length === 0 ? (
                  <p className="mt-2 text-sm text-[#9CA3AF]">No leads in this window.</p>
                ) : (
                  <ul className="mt-3 divide-y divide-white/[0.06] rounded-xl border border-white/[0.08] bg-[#10131a]/85">
                    {leads.map((l) => (
                      <li key={l.id} className="flex items-center justify-between gap-3 px-4 py-3 text-xs">
                        <div className="min-w-0">
                          <p className="font-medium text-white">{l.name}</p>
                          <p className="truncate font-mono text-[#9CA3AF]">{l.email}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-white">{l.score}</p>
                          <p className="text-[#9CA3AF]">
                            {l.tier} · {l.classification}
                          </p>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
              <a className="inline-flex min-h-10 items-center text-xs text-[#F97316]" href="/review">
                Confirm pause / scale / keep on HITL →
              </a>
            </>
          )}
        </DeskGate>
      </div>
    </EngineShell>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[11px] tracking-wide text-[#9CA3AF] uppercase">{label}</dt>
      <dd className="mt-1 font-mono text-white">{value}</dd>
    </div>
  );
}
