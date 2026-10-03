"use client";

import { useEffect, useState, type ReactNode } from "react";
import { ChartCard, Donut, EmptyChart, Funnel, Gauge, HBarList, StackedBar, type BarItem } from "@helix/ui";
import type { AttributedLead, MarketingWindow, StoredCampaign } from "@helix/core";
import { WINDOWS } from "@/lib/use-desk-snapshot";
import { CONFIDENCE_EDGES, RULES, actionLabel, confidenceHistogram, recommendedSpend, scoreText, funnelSteps, spendSegments, tierCounts, totals } from "@/lib/desk-derive";
import { money } from "@/lib/format";
import { cn } from "@/lib/utils";

/** Colours shared by every chart so "spam" is the same red and "hot" the same green on every page. */
export const COLORS = { hot: "#34d399", mid: "#94a3b8", spam: "#f87171", warm: "#f59e0b", accent: "#f97316" } as const;

export const shortName = (name: string) => name.split(/\s+[—-]\s+/)[0] || name;

/** True while the desk runs on seeded demo data, so charts can wear the "Demo data" chip. */
export function useDemoMode(): boolean {
  const [demo, setDemo] = useState(false);
  useEffect(() => {
    let live = true;
    const load = () =>
      void fetch("/api/settings/desk")
        .then((r) => r.json())
        .then((d: { mode?: string }) => {
          if (live) setDemo(d.mode === "demo");
        })
        .catch(() => {
          if (live) setDemo(false);
        });
    load();
    window.addEventListener("helix:desk-refresh", load);
    return () => {
      live = false;
      window.removeEventListener("helix:desk-refresh", load);
    };
  }, []);
  return demo;
}

export function WindowTabs({ win, setWin }: { win: MarketingWindow; setWin: (w: MarketingWindow) => void }) {
  return (
    <div role="group" aria-label="Analysis window" className="inline-flex items-center gap-1 rounded-lg border border-[var(--border-hairline)] bg-surface-container-lowest p-1">
      {WINDOWS.map((id) => (
        <button
          key={id}
          type="button"
          aria-pressed={win === id}
          onClick={() => setWin(id)}
          className={cn("min-h-10 rounded px-3 text-xs font-medium sm:min-h-8", win === id ? "bg-on-surface/10 text-on-surface" : "text-on-surface-variant hover:text-on-surface")}
        >
          {id}
        </button>
      ))}
    </div>
  );
}

/** Loading / error / empty state in one place: a failed fetch is shown, never rendered as an empty chart. */
export function DeskGate({ loading, error, empty, children }: { loading: boolean; error: string | null; empty?: boolean; children: ReactNode }) {
  if (error) return <div role="alert" className="rounded-xl border border-alert-rose/30 bg-alert-rose/10 p-4 text-sm text-alert-rose">Could not load the desk: {error}</div>;
  if (loading) return <div className="rounded-xl bg-surface-container-low p-6 text-sm text-on-surface-variant" aria-busy>Loading desk…</div>;
  if (empty) return <div className="rounded-xl bg-surface-container-low p-6 text-sm text-on-surface-variant">No campaigns on the desk for this window yet. Ingest spend and leads from the home page.</div>;
  return <>{children}</>;
}

export type CardCtx = { demo: boolean; win: string; from: string; to: string };
const source = (c: CardCtx) => `Source: desk snapshot · ${c.win}${c.from ? ` (${c.from} → ${c.to})` : ""}`;

export function SpendSplitCard({ campaigns, ctx }: { campaigns: StoredCampaign[]; ctx: CardCtx }) {
  const rows = [...campaigns].sort((a, b) => b.spend - a.spend);
  return (
    <ChartCard title="Spend vs spend on spam" subtitle="Per campaign: hot share, middle, spam" demo={ctx.demo} source={`${source(ctx)} · spam = the engine's spend_on_spam`}>
      {rows.length === 0 ? (
        <EmptyChart label="No spend yet" />
      ) : (
        <div className="grid gap-4">
          {rows.map((c) => {
            const s = spendSegments(c);
            return (
              <div key={c.campaignId}>
                <div className="mb-1 flex justify-between gap-2 text-xs">
                  <span className="truncate">{c.name}</span>
                  <span className="shrink-0 tabular-nums opacity-70">{money(c.spend)}</span>
                </div>
                <StackedBar
                  ariaLabel={`${c.name}: ${money(s.hot)} hot, ${money(s.mid)} middle, ${money(s.spam)} spam`}
                  segments={[
                    { label: "Hot", value: Math.round(s.hot), color: COLORS.hot },
                    { label: "Middle", value: Math.round(s.mid), color: COLORS.mid },
                    { label: "Spam", value: Math.round(s.spam), color: COLORS.spam },
                  ]}
                />
              </div>
            );
          })}
        </div>
      )}
    </ChartCard>
  );
}

export function CostPerHotCard({ campaigns, ctx }: { campaigns: StoredCampaign[]; ctx: CardCtx }) {
  const items: BarItem[] = campaigns
    .filter((c) => c.metrics.costPerHot != null)
    .map((c) => ({ label: shortName(c.name), value: c.metrics.costPerHot as number, color: (c.metrics.costPerHot as number) <= RULES.costPerHot ? COLORS.hot : COLORS.warm }));
  const none = campaigns.filter((c) => c.metrics.costPerHot == null).map((c) => shortName(c.name));
  return (
    <ChartCard title="Cost per hot lead" subtitle={`Rule: scale only under ${money(RULES.costPerHot)} per hot lead`} demo={ctx.demo} source={`${source(ctx)}${none.length ? ` · no hot lead yet: ${none.join(", ")}` : ""}`}>
      {items.length === 0 ? <EmptyChart label="No campaign has a hot lead yet, so there is no cost per hot lead." /> : <HBarList items={items} format={(n) => money(n, 2)} marker={RULES.costPerHot} markerLabel={`${money(RULES.costPerHot)} scale rule`} />}
    </ChartCard>
  );
}

export function FunnelCard({ campaigns, ctx }: { campaigns: StoredCampaign[]; ctx: CardCtx }) {
  return (
    <ChartCard title="Funnel" subtitle="Impressions to hot leads, joined campaigns" demo={ctx.demo} source={source(ctx)}>
      <Funnel steps={funnelSteps(campaigns)} color={COLORS.accent} />
    </ChartCard>
  );
}

export function TierDonutCard({ leads, ctx }: { leads: AttributedLead[]; ctx: CardCtx }) {
  const t = tierCounts(leads);
  const total = t.hot + t.warm + t.cold + t.spam;
  const rows = [
    ["Hot", t.hot, COLORS.hot],
    ["Warm", t.warm, COLORS.warm],
    ["Cold", t.cold, COLORS.mid],
    ["Spam", t.spam, COLORS.spam],
  ] as const;
  return (
    <ChartCard title="Leads by tier" subtitle="Scored leads, spam counted separately" demo={ctx.demo} source={source(ctx)}>
      {total === 0 ? (
        <EmptyChart label="No scored leads in this window" />
      ) : (
        <div className="flex flex-wrap items-center gap-4">
          <Donut
            size={132}
            thickness={22}
            centerValue={total}
            centerLabel="leads"
            ariaLabel={`${t.hot} hot, ${t.warm} warm, ${t.cold} cold, ${t.spam} spam`}
            slices={rows.map(([label, value, color]) => ({ label, value, color }))}
          />
        </div>
      )}
    </ChartCard>
  );
}

export function WasteGaugeCard({ campaigns, ctx }: { campaigns: StoredCampaign[]; ctx: CardCtx }) {
  const t = totals(campaigns);
  const pct = Math.round(t.wastePct * 100);
  const goal = Math.round(RULES.wasteGoal * 100);
  const over = t.wastePct > RULES.wasteGoal;
  return (
    <ChartCard title="Waste ratio" subtitle={`Spend on spam / total spend · goal ${goal}%`} demo={ctx.demo} source={source(ctx)}>
      <div className="flex flex-wrap items-center gap-4">
        <Gauge value={pct} max={100} invert label="Spend on spam (%)" caption={`goal ${goal}%`} />
        <p className={cn("text-sm font-medium", over ? "text-alert-rose" : "text-success-emerald")}>
          {over ? `Above the ${goal}% goal` : `Within the ${goal}% goal`}
          <span className="mt-1 block text-xs font-normal opacity-70">
            {money(t.spendOnSpam)} of {money(t.spend)}
          </span>
        </p>
      </div>
    </ChartCard>
  );
}

/** Score on a 0-100 track with the engine's pause (35) and scale (70) thresholds drawn on it. */
function ScoreTrack({ c }: { c: StoredCampaign }) {
  const usable = c.metrics.nLeads - c.metrics.nSpam > 0;
  const score = c.metrics.avgScore;
  const color = score >= RULES.scaleScore ? COLORS.hot : score <= RULES.pauseScore ? COLORS.spam : COLORS.warm;
  return (
    <div>
      <div className="mb-1 flex justify-between gap-2 text-xs">
        <span className="truncate">{c.name}</span>
        <span className="shrink-0 tabular-nums opacity-70">{usable ? scoreText(c) : "no non-spam lead"}</span>
      </div>
      <div role="img" aria-label={`${c.name}: score ${usable ? score : "none"}, pause at ${RULES.pauseScore}, scale at ${RULES.scaleScore}`} className="relative h-2 rounded-full bg-current/10" style={{ background: "color-mix(in srgb, currentColor 10%, transparent)" }}>
        {usable ? <div className="h-full rounded-full" style={{ width: `${Math.min(100, score)}%`, background: color }} /> : null}
        {[RULES.pauseScore, RULES.scaleScore].map((t) => (
          <span key={t} aria-hidden className="absolute -top-1 -bottom-1 w-0.5 bg-current opacity-60" style={{ left: `${t}%` }} />
        ))}
      </div>
      <div className="relative mt-1 h-3 text-[11px] opacity-60">
        <span className="absolute -translate-x-1/2" style={{ left: `${RULES.pauseScore}%` }}>{RULES.pauseScore}</span>
        <span className="absolute -translate-x-1/2" style={{ left: `${RULES.scaleScore}%` }}>{RULES.scaleScore}</span>
      </div>
    </div>
  );
}

/** Charts for the HITL queue: where each score sits against the rules, spend now vs recommended, engine confidence. */
export function ReviewCharts({ campaigns, ctx }: { campaigns: StoredCampaign[]; ctx: CardCtx }) {
  if (campaigns.length === 0) return null;
  const spendItems: BarItem[] = campaigns.flatMap((c) => [
    { label: `${shortName(c.name)} · now`, value: Math.round(c.spend), color: COLORS.mid },
    { label: `${shortName(c.name)} · ${actionLabel(c)}`, value: recommendedSpend(c), color: c.action === "pause" ? COLORS.spam : c.action === "scale" ? COLORS.hot : COLORS.accent },
  ]);
  const hist = confidenceHistogram(campaigns);
  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
      <ChartCard title="Score vs thresholds" subtitle={`Pause at ${RULES.pauseScore} or below, scale at ${RULES.scaleScore} or above`} demo={ctx.demo} source={source(ctx)}>
        <div className="grid gap-3">{campaigns.map((c) => <ScoreTrack key={c.id} c={c} />)}</div>
      </ChartCard>
      <ChartCard title="Spend now vs recommended" subtitle={`Scale step is +${Math.round(RULES.scaleStep * 100)}% daily budget`} demo={ctx.demo} source={source(ctx)}>
        <HBarList items={spendItems} format={(n) => money(n)} />
      </ChartCard>
      <ChartCard title="Engine confidence" subtitle="Campaigns in this queue by confidence band (%)" demo={ctx.demo} source={`${source(ctx)} · ${CONFIDENCE_EDGES.length - 1} bands`}>
        <HBarList items={hist.filter((b) => b.value > 0).map((b) => ({ label: b.label, value: b.value, color: COLORS.accent }))} format={(n) => String(n)} />
      </ChartCard>
    </div>
  );
}

export type SourceLight = { configured: boolean; verified: boolean; missing: string[]; lastError: string | null };

type Light = "green" | "amber" | "red";
const LIGHT_COLOR: Record<Light, string> = { green: "#34d399", amber: "#f59e0b", red: "#f87171" };

function light(s: SourceLight | undefined): { tone: Light; text: string } {
  if (!s) return { tone: "red", text: "Status unknown" };
  if (s.lastError) return { tone: "red", text: `Last sync failed: ${s.lastError}` };
  if (s.verified) return { tone: "green", text: "Connected and verified" };
  if (s.configured) return { tone: "amber", text: "Keys saved, not verified yet" };
  return { tone: "red", text: `Not configured (${s.missing.length} key${s.missing.length === 1 ? "" : "s"} missing)` };
}

/** Traffic light per connector (from /api/status) plus the flow every number goes through. */
export function ConnectorFlow({ sources, csv }: { sources?: { meta: SourceLight; google: SourceLight; tiktok: SourceLight }; csv: boolean }) {
  const rows: { name: string; tone: Light; text: string }[] = [
    { name: "Meta Ads", ...light(sources?.meta) },
    { name: "Google Ads", ...light(sources?.google) },
    { name: "TikTok Ads", ...light(sources?.tiktok) },
    { name: "CSV upload", tone: csv ? "green" : "red", text: csv ? "Always available" : "Unavailable" },
  ];
  return (
    <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
      <ChartCard title="Connectors" subtitle="Green: verified · amber: saved, unverified · red: missing or failing">
        <ul className="grid gap-2 text-sm">
          {rows.map((r) => (
            <li key={r.name} className="flex items-center gap-3">
              <span aria-hidden className="size-3 shrink-0 rounded-full" style={{ background: LIGHT_COLOR[r.tone] }} />
              <span className="font-medium">{r.name}</span>
              <span className="sr-only">{r.tone}</span>
              <span className="min-w-0 truncate text-xs opacity-70">{r.text}</span>
            </li>
          ))}
        </ul>
      </ChartCard>
      <FlowCard />
    </div>
  );
}

/** The flow every number goes through, from the ad platform to a confirmed change. */
export function FlowCard() {
  const steps = ["Spend + leads", "Join by campaign_id", "Score and decide", "Human review", "Write to Meta"];
  return (
    <ChartCard title="How a number reaches the desk" subtitle="Every page reads the same snapshot">
        <ol className="flex flex-wrap items-center gap-x-2 gap-y-2 text-xs">
          {steps.map((s, i) => (
            <li key={s} className="flex items-center gap-2">
              <span className="rounded-lg border border-white/15 px-2.5 py-1.5" style={i === 3 ? { borderColor: COLORS.accent, color: COLORS.accent } : undefined}>{s}</span>
              {i < steps.length - 1 ? <span aria-hidden className="opacity-50">→</span> : null}
            </li>
          ))}
        </ol>
        <p className="mt-3 text-xs opacity-70">Pause and scale are never applied without a person confirming. Only Meta can be written to; Google and TikTok are read-only.</p>
    </ChartCard>
  );
}
