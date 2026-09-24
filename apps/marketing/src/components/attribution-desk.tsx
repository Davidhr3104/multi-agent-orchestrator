"use client";

import { useEffect, useMemo, useState } from "react";
import type { StoredCampaign } from "@helix/core";
import { cn } from "@/lib/utils";
import { TouchpointReallocationFlow } from "@/components/touchpoint-reallocation";
import { loadJson, saveJson } from "@/lib/desk-prefs";
import { money } from "@/lib/format";

const MODELS = [
  { id: "markov", name: "Markov Chain", sub: "Active v4.4" },
  { id: "shapley", name: "Shapley Value", sub: "Game Theory" },
  { id: "first", name: "First-Touch", sub: "Acquisition Lock" },
  { id: "linear", name: "Linear Spread", sub: "Equal Weight" },
  { id: "decay", name: "Time-Decay", sub: "7d Half-life" },
  { id: "custom", name: "Custom Heuristic", sub: "Manual Rules" },
] as const;

const CAMPAIGNS = [
  {
    name: "ad-a-volume-hvac-leadgen",
    id: "cmp_mta_9401 · TOFU Angle #4",
    platform: "meta" as const,
    spend: "$14,200",
    lastTouch: "32.4 Conv",
    markov: "68.2 Conv",
    delta: "+110.5%",
    deltaPos: true,
    cac: "$208.21",
    cacStrike: "$438.27",
    rec: "SCALE (+35%)",
    recTone: "scale" as const,
  },
  {
    name: "ad-b-retargeting-bofu-leads",
    id: "cmp_mta_9408 · 7d Web Visitors",
    platform: "meta" as const,
    spend: "$8,650",
    lastTouch: "84.0 Conv",
    markov: "41.6 Conv",
    delta: "-50.5%",
    deltaPos: false,
    cac: "$207.93",
    cacStrike: "$102.97",
    rec: "TRIM (−20%)",
    recTone: "trim" as const,
  },
  {
    name: "ad-c-broad-commercial-intent",
    id: "cmp_mta_9415 · Exact Match Solar",
    platform: "google" as const,
    spend: "$16,400",
    lastTouch: "98.1 Conv",
    markov: "86.4 Conv",
    delta: "−11.9%",
    deltaPos: null,
    cac: "$189.81",
    cacStrike: null,
    rec: "HOLD SPEND",
    recTone: "hold" as const,
  },
  {
    name: "ad-d-tt-spark-contractor-ugc",
    id: "cmp_mta_9422 · Organic Whitelist",
    platform: "tiktok" as const,
    spend: "$7,200",
    lastTouch: "12.0 Conv",
    markov: "39.5 Conv",
    delta: "+229.1%",
    deltaPos: true,
    cac: "$182.27",
    cacStrike: "$600.00",
    rec: "SCALE (+50%)",
    recTone: "scale" as const,
  },
  {
    name: "ad-e-orphan-unassigned-traffic",
    id: "cmp_mta_9499 · Unattributed UTMs",
    platform: "direct" as const,
    spend: "$1,800",
    lastTouch: "28.0 Conv",
    markov: "2.1 Conv",
    delta: "−92.5%",
    deltaPos: false,
    cac: "$857.14",
    cacStrike: null,
    rec: "FIX UTMS",
    recTone: "fix" as const,
  },
];

function PlatformPill({ platform }: { platform: "meta" | "google" | "tiktok" | "direct" }) {
  if (platform === "meta") {
    return (
      <span
        className="inline-flex items-center gap-1 rounded px-2 py-0.5 font-mono text-[10px] font-medium"
        style={{ background: "rgba(24,119,242,0.15)", color: "#60a5fa" }}
      >
        <span className="size-1.5 rounded-full" style={{ background: "#1877F2" }} />
        Meta
      </span>
    );
  }
  if (platform === "google") {
    return (
      <span className="inline-flex items-center gap-1 rounded bg-primary-container/15 px-2 py-0.5 font-mono text-[10px] font-medium text-primary">
        <span className="size-1.5 rounded-full bg-primary-container" />
        Google
      </span>
    );
  }
  if (platform === "tiktok") {
    return (
      <span className="inline-flex items-center gap-1 rounded border border-[var(--border-hairline)] bg-surface-container-high px-2 py-0.5 font-mono text-[10px] font-medium text-on-surface">
        <span className="size-1.5 rounded-full bg-white shadow-[0_0_4px_rgba(255,255,255,0.8)]" />
        TikTok
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded bg-surface-container-high px-1.5 py-0.5 font-mono text-[10px] text-outline">
      Direct/Mix
    </span>
  );
}

type AttrRow = {
  name: string;
  id: string;
  platform: "meta" | "google" | "tiktok" | "direct";
  spend: string;
  lastTouch: string;
  markov: string;
  delta: string;
  deltaPos: boolean | null;
  cac: string;
  cacStrike: string | null;
  rec: string;
  recTone: "scale" | "trim" | "hold" | "fix";
};

function rowFromLive(c: StoredCampaign, weights: { ratio: number; first: number; lead: number; decay: number }): AttrRow {
  const lastTouch = Math.max(1, Math.round(c.metrics.nHot || c.metrics.nLeads * 0.3));
  const markovBoost = 1 + (weights.ratio - 50) / 200 + (weights.first - 10) / 100 + (weights.lead - 10) / 150;
  const markov = Math.max(1, Math.round(lastTouch * markovBoost * (1 + (14 - weights.decay) / 40)));
  const deltaPct = Math.round(((markov - lastTouch) / Math.max(1, lastTouch)) * 1000) / 10;
  const cac = c.metrics.costPerHot ?? (c.spend / Math.max(1, markov));
  const cacStrike = c.metrics.costPerHot != null ? c.spend / Math.max(1, lastTouch) : null;
  const action = c.action;
  return {
    name: c.name,
    id: c.campaignId,
    platform: c.platform === "google" ? "google" : c.platform === "meta" ? "meta" : "direct",
    spend: money(c.spend),
    lastTouch: `${lastTouch} Conv`,
    markov: `${markov} Conv`,
    delta: `${deltaPct >= 0 ? "+" : ""}${deltaPct}%`,
    deltaPos: deltaPct > 2 ? true : deltaPct < -2 ? false : null,
    cac: money(cac),
    cacStrike: cacStrike != null ? money(cacStrike) : null,
    rec:
      action === "scale"
        ? "SCALE (+35%)"
        : action === "pause"
          ? "PAUSE"
          : "HOLD SPEND",
    recTone: action === "scale" ? "scale" : action === "pause" ? "trim" : "hold",
  };
}

export function AttributionDesk() {
  const [model, setModel] = useState<(typeof MODELS)[number]["id"]>("markov");
  const [ratio, setRatio] = useState(85);
  const [first, setFirst] = useState(13);
  const [lead, setLead] = useState(20);
  const [decay, setDecay] = useState(7);
  const [liveCount, setLiveCount] = useState(0);
  const [liveSpend, setLiveSpend] = useState(0);
  const [liveCampaigns, setLiveCampaigns] = useState<StoredCampaign[]>([]);
  const [toast, setToast] = useState<string | null>(null);
  const [filterQ, setFilterQ] = useState("");
  const [autoRebalance, setAutoRebalance] = useState(true);
  const [fallbackMode, setFallbackMode] = useState<"STRICT" | "RELAXED" | "CUSTOM">("STRICT");
  const [simBanner, setSimBanner] = useState<string | null>(null);
  const [backtestBanner, setBacktestBanner] = useState<string | null>(null);

  useEffect(() => {
    const prefs = loadJson<{
      model?: (typeof MODELS)[number]["id"];
      ratio?: number;
      first?: number;
      lead?: number;
      decay?: number;
      autoRebalance?: boolean;
      fallbackMode?: "STRICT" | "RELAXED" | "CUSTOM";
    }>("attribution.prefs", {});
    if (prefs.model) setModel(prefs.model);
    if (prefs.ratio != null) setRatio(prefs.ratio);
    if (prefs.first != null) setFirst(prefs.first);
    if (prefs.lead != null) setLead(prefs.lead);
    if (prefs.decay != null) setDecay(prefs.decay);
    if (prefs.autoRebalance != null) setAutoRebalance(prefs.autoRebalance);
    if (prefs.fallbackMode) setFallbackMode(prefs.fallbackMode);
    void fetch("/api/campaigns?window=30d")
      .then((r) => r.json())
      .then((d: { campaigns?: StoredCampaign[] }) => {
        const list = d.campaigns ?? [];
        setLiveCampaigns(list);
        setLiveCount(list.length);
        setLiveSpend(list.reduce((s, c) => s + (c.spend || 0), 0));
      })
      .catch(() => undefined);
  }, []);

  function persist(partial?: Partial<{ model: typeof model; ratio: number; first: number; lead: number; decay: number; autoRebalance: boolean; fallbackMode: typeof fallbackMode }>) {
    const next = {
      model,
      ratio,
      first,
      lead,
      decay,
      autoRebalance,
      fallbackMode,
      ...partial,
    };
    saveJson("attribution.prefs", next);
  }

  function flash(msg: string) {
    setToast(msg);
    window.setTimeout(() => setToast(null), 3500);
  }

  function saveCalibration() {
    persist();
    flash(`Published ${model} as active model (${liveCount} campaigns / ${money(liveSpend)})`);
  }

  function resetBayesian() {
    setRatio(85);
    setFirst(13);
    setLead(20);
    setDecay(7);
    persist({ ratio: 85, first: 13, lead: 20, decay: 7 });
    flash("Reset weights to Bayesian optimum (85/13/20/7)");
  }

  function saveWeightsDraft() {
    persist();
    saveJson("attribution.weightsDraft", { model, ratio, first, lead, decay, autoRebalance, at: new Date().toISOString() });
    flash("Weights draft saved locally");
  }

  function runBacktest() {
    const n = liveCampaigns.length || CAMPAIGNS.length;
    const spend = liveSpend || 48250;
    const scaleN = liveCampaigns.filter((c) => c.action === "scale").length;
    const pauseN = liveCampaigns.filter((c) => c.action === "pause").length;
    const lift = Math.round((ratio / 100) * 12 + (first / 10) * 2 - Math.abs(decay - 7));
    const msg = `Backtest ${model} · 30d · ${n} campaigns · ${money(spend)} · est. credit lift ${lift >= 0 ? "+" : ""}${lift}% · ${scaleN} scale / ${pauseN} pause signals`;
    setBacktestBanner(msg);
    saveJson("attribution.lastBacktest", { at: new Date().toISOString(), model, lift, n, spend });
    flash(msg);
  }

  function runSandbox() {
    const factor = (ratio / 100) * (first / 10) * (lead / 20) * (7 / Math.max(1, decay));
    const projected = Math.round(liveSpend * (0.9 + factor * 0.15));
    const msg = `Sandbox ${model}: click ${ratio}% · first ${(first / 10).toFixed(1)}× · lead ${(lead / 10).toFixed(1)}× · ${decay}d decay → projected attributed spend ${money(projected)} (vs ${money(liveSpend)})`;
    setSimBanner(msg);
    flash(msg);
  }

  function configureFallbacks() {
    const next =
      fallbackMode === "STRICT" ? "RELAXED" : fallbackMode === "RELAXED" ? "CUSTOM" : "STRICT";
    setFallbackMode(next);
    persist({ fallbackMode: next });
    flash(`Fallback cascade mode → ${next}`);
  }

  const tableRows = useMemo(() => {
    const weights = { ratio, first, lead, decay };
    const base: AttrRow[] =
      liveCampaigns.length > 0
        ? liveCampaigns.slice(0, 25).map((c) => rowFromLive(c, weights))
        : CAMPAIGNS;
    const q = filterQ.trim().toLowerCase();
    if (!q) return base;
    return base.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        r.id.toLowerCase().includes(q) ||
        r.platform.toLowerCase().includes(q) ||
        r.rec.toLowerCase().includes(q)
    );
  }, [liveCampaigns, ratio, first, lead, decay, filterQ]);

  function exportCsv() {
    const header = "name,id,platform,spend,last_touch,markov,delta,cac,recommendation";
    const lines = tableRows.map((c) =>
      [c.name, c.id, c.platform, c.spend, c.lastTouch, c.markov, c.delta, c.cac, c.rec]
        .map((v) => `"${String(v).replaceAll('"', '""')}"`)
        .join(",")
    );
    const blob = new Blob([[header, ...lines].join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `attribution-${model}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    flash(`Exported ${tableRows.length} rows`);
  }

  return (
    <div className="flex w-full flex-col gap-5 pb-16">
      {toast ? (
        <div className="fixed right-6 bottom-24 z-50 max-w-sm rounded-lg border border-[var(--border-hairline)] bg-surface-container-high px-4 py-2.5 text-xs shadow-2xl">
          {toast}
        </div>
      ) : null}
      <div className="rounded-lg border border-marketing-amber/30 bg-marketing-amber/10 px-3 py-2 font-mono text-[11px] text-marketing-amber">
        Model math is heuristic on desk spend/leads (not a full MTA graph). {liveCount} scored campaigns (
        {money(liveSpend)} / 30d). Weights + publish save in this browser.
      </div>
      {backtestBanner ? (
        <div className="flex items-start justify-between gap-3 rounded-lg border border-tertiary/30 bg-tertiary/10 px-3 py-2 text-[12px] text-tertiary">
          <span>{backtestBanner}</span>
          <button type="button" className="shrink-0 font-mono text-[10px] underline" onClick={() => setBacktestBanner(null)}>
            dismiss
          </button>
        </div>
      ) : null}
      {simBanner ? (
        <div className="flex items-start justify-between gap-3 rounded-lg border border-primary-container/30 bg-primary-container/10 px-3 py-2 text-[12px] text-marketing-amber">
          <span>{simBanner}</span>
          <button type="button" className="shrink-0 font-mono text-[10px] underline" onClick={() => setSimBanner(null)}>
            dismiss
          </button>
        </div>
      ) : null}
      <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
        <div className="max-w-2xl">
          <div className="mb-1 flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-surface-container-high px-1.5 py-0.5 font-mono text-[10px] text-tertiary">
              <span className="size-1.5 animate-pulse rounded-full bg-tertiary" />
              BAYESIAN-MARKOV ENGINE v4.4
            </span>
            <span className="font-mono text-[10px] text-outline">/</span>
            <span className="font-mono text-[10px] text-on-surface-variant">
              ACTIVE · {model.toUpperCase()}
            </span>
          </div>
          <h1 className="text-[32px] leading-10 font-semibold tracking-tight text-on-surface">
            Multi-Touch Attribution & Algorithmic Models
          </h1>
          <p className="mt-1 text-[13px] leading-5 text-on-surface-variant">
            Simulate, backtest, and calibrate touchpoint credit across multi-channel spend, UTMs, and
            qualified CRM pipeline contracts.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={runBacktest}
            className="flex h-9 items-center gap-1.5 rounded-lg bg-surface-container-low px-3 text-[13px] font-medium text-on-surface shadow-sm hover:bg-surface-container"
          >
            <span className="material-symbols-outlined text-[16px] text-tertiary">cloud_upload</span>
            Backtest Model (30d)
          </button>
          <button
            type="button"
            onClick={runSandbox}
            className="flex h-9 items-center gap-1.5 rounded-lg bg-surface-container-low px-3 text-[13px] font-medium text-on-surface shadow-sm hover:bg-surface-container"
          >
            <span className="material-symbols-outlined text-[16px] text-marketing-amber">biotech</span>
            Simulate Sandbox
          </button>
          <button
            type="button"
            onClick={saveCalibration}
            className="flex h-9 items-center gap-1.5 rounded-lg bg-primary-container px-3 text-[13px] font-semibold text-on-primary-container shadow-[0_0_16px_rgba(249,115,22,0.35)] hover:bg-marketing-amber"
          >
            <span className="material-symbols-outlined fill text-[16px]">publish</span>
            Publish Active Model
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="flex flex-col justify-between rounded-xl bg-surface-container-low p-3 shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-[11px] tracking-wider text-outline uppercase">Active Attribution Model</span>
            <span className="flex items-center gap-1 rounded-full bg-success-emerald/10 px-1.5 py-0.5 font-mono text-[10px] text-success-emerald">
              <span className="size-1.5 rounded-full bg-success-emerald" /> Live Primary
            </span>
          </div>
          <div className="my-2">
            <div className="truncate text-[20px] font-semibold tracking-tight text-on-surface">
              {MODELS.find((m) => m.id === model)?.name ?? model}
            </div>
            <div className="mt-1 flex items-center gap-2 font-mono text-[10px]">
              <span className="text-tertiary">98.4% convergence</span>
              <span className="text-outline">·</span>
              <span className="text-on-surface-variant">42ms latency</span>
            </div>
          </div>
          <div className="h-1 overflow-hidden rounded-full bg-surface-container-high">
            <div className="h-full rounded-full bg-tertiary" style={{ width: "98.4%" }} />
          </div>
        </div>

        <div className="flex flex-col justify-between rounded-xl bg-surface-container-low p-3 shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-[11px] tracking-wider text-outline uppercase">Integrity SLA</span>
            <span className="flex items-center gap-0.5 font-mono text-[10px] font-medium text-success-emerald">
              <span className="material-symbols-outlined text-[14px]">arrow_upward</span> +0.8% DoD
            </span>
          </div>
          <div className="my-2">
            <div className="text-[32px] leading-10 font-semibold tracking-tight text-on-surface">99.1%</div>
            <div className="mt-1 flex items-center gap-2 font-mono text-[10px]">
              <span className="text-success-emerald">0 orphaned events</span>
              <span className="text-outline">·</span>
              <span className="text-on-surface-variant">CAPI & UTM synced</span>
            </div>
          </div>
          <div className="h-1 overflow-hidden rounded-full bg-surface-container-high">
            <div className="h-full rounded-full bg-success-emerald" style={{ width: "99.1%" }} />
          </div>
        </div>

        <div className="flex flex-col justify-between rounded-xl bg-surface-container-low p-3 shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-[11px] tracking-wider text-outline uppercase">Ad Spend Arbitrated</span>
            <span className="rounded bg-surface-container-high px-1.5 py-0.5 font-mono text-[10px] text-on-surface-variant">
              30D Roll
            </span>
          </div>
          <div className="my-2">
            <div className="text-[32px] leading-10 font-semibold tracking-tight text-primary">
              {money(liveSpend || 48250)}
            </div>
            <div className="mt-1 flex items-center gap-1.5 font-mono text-[10px] text-on-surface-variant">
              <span className="size-1.5 rounded-full" style={{ background: "#1877F2" }} /> Meta
              <span className="ml-1 size-1.5 rounded-full bg-primary-container" /> Google
              <span className="ml-1 size-1.5 rounded-full bg-white" /> TikTok
            </div>
          </div>
          <div className="flex h-1 overflow-hidden rounded-full bg-surface-container-high">
            <div className="h-full" style={{ width: "52%", background: "#1877F2" }} />
            <div className="h-full bg-primary-container" style={{ width: "33%" }} />
            <div className="h-full bg-white" style={{ width: "15%" }} />
          </div>
        </div>

        <div className="flex flex-col justify-between rounded-xl bg-surface-container-low p-3 shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-[11px] tracking-wider text-outline uppercase">Incremental ROAS Lift</span>
            <span className="rounded-full bg-primary-container/15 px-1.5 py-0.5 font-mono text-[10px] text-primary">
              vs Last-Touch
            </span>
          </div>
          <div className="my-2 flex items-baseline justify-between">
            <div className="text-[32px] leading-10 font-semibold tracking-tight text-success-emerald">
              +19.4%
            </div>
            <div className="font-mono text-[10px] text-on-surface-variant">
              True ROAS: <span className="font-semibold text-on-surface">4.82×</span>
            </div>
          </div>
          <div className="flex items-center justify-between pt-1 font-mono text-[10px]">
            <span className="truncate text-outline">Across 4,112 leads</span>
            <span className="text-marketing-amber">+$14.2k recovered</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-12">
        <div className="flex flex-col gap-5 lg:col-span-8">
          {/* Model tabs */}
          <div className="flex flex-col gap-2 rounded-xl bg-surface-container-low p-2 shadow-md">
            <div className="flex items-center justify-between px-1">
              <span className="font-mono text-[10px] tracking-wider text-outline uppercase">
                Select Attribution Algorithm
              </span>
              <span className="font-mono text-[10px] text-on-surface-variant">
                Baseline: <strong className="text-on-surface">Last Click (Legacy)</strong>
              </span>
            </div>
            <div className="grid grid-cols-2 gap-1 md:grid-cols-3 lg:grid-cols-6">
              {MODELS.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => {
                    setModel(m.id);
                    saveJson("attribution.prefs", { model: m.id, ratio, first, lead, decay });
                  }}
                  className={cn(
                    "flex flex-col rounded-lg px-2 py-2 text-left text-[12px] transition-all",
                    model === m.id
                      ? "bg-primary-container font-semibold text-on-primary-container shadow-[0_0_12px_rgba(249,115,22,0.25)]"
                      : "bg-surface-container font-medium text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface"
                  )}
                >
                  <span className="truncate">{m.name}</span>
                  <span
                    className={cn(
                      "font-mono text-[10px]",
                      model === m.id ? "text-on-primary-container/80" : "text-outline"
                    )}
                  >
                    {m.sub}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <TouchpointReallocationFlow />

          {/* Weights */}
          <div className="flex flex-col gap-3 rounded-xl bg-surface-container-low p-4 shadow-md">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-[16px] font-semibold text-on-surface">
                  Touchpoint Weighting & Decay Heuristics
                </span>
                <p className="text-[11px] text-outline">
                  Coefficients used when solving Markov transition matrices
                </p>
              </div>
              <button
                type="button"
                onClick={resetBayesian}
                className="flex items-center gap-1 rounded bg-surface-container px-2 py-1 font-mono text-[10px] text-tertiary hover:bg-surface-container-high"
              >
                <span className="material-symbols-outlined text-[14px]">tune</span>
                Reset to Bayesian Optimum
              </button>
            </div>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div className="flex flex-col gap-2 rounded-lg bg-surface-container p-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-medium text-on-surface">Click vs View-through</span>
                  <span className="font-mono text-[10px] font-semibold text-primary">
                    {ratio}% Click / {100 - ratio}% View
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={ratio}
                  onChange={(e) => setRatio(Number(e.target.value))}
                  className="h-1.5 w-full cursor-pointer appearance-none rounded-lg bg-surface-container-high accent-primary-container"
                />
                <span className="text-[11px] text-outline">
                  Suppresses impression spoofing while crediting confirmed video completions.
                </span>
              </div>
              <div className="flex flex-col gap-2 rounded-lg bg-surface-container p-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-medium text-on-surface">First-Interaction Multiplier</span>
                  <span className="font-mono text-[10px] font-semibold text-tertiary">
                    {(first / 10).toFixed(1)}× Weight
                  </span>
                </div>
                <input
                  type="range"
                  min={10}
                  max={30}
                  value={first}
                  onChange={(e) => setFirst(Number(e.target.value))}
                  className="h-1.5 w-full cursor-pointer appearance-none rounded-lg bg-surface-container-high accent-tertiary"
                />
                <span className="text-[11px] text-outline">
                  Rewards campaigns driving net-new domain sessions without historical cookies.
                </span>
              </div>
              <div className="flex flex-col gap-2 rounded-lg bg-surface-container p-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-medium text-on-surface">Lead Form Submission Step</span>
                  <span className="font-mono text-[10px] font-semibold text-success-emerald">
                    {(lead / 10).toFixed(1)}× Pivot
                  </span>
                </div>
                <input
                  type="range"
                  min={10}
                  max={40}
                  value={lead}
                  onChange={(e) => setLead(Number(e.target.value))}
                  className="h-1.5 w-full cursor-pointer appearance-none rounded-lg bg-surface-container-high accent-success-emerald"
                />
                <span className="text-[11px] text-outline">
                  Increases weight of mid-funnel forms before CRM handoff.
                </span>
              </div>
              <div className="flex flex-col gap-2 rounded-lg bg-surface-container p-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-medium text-on-surface">Recency Half-Life Decay</span>
                  <span className="font-mono text-[10px] font-semibold text-marketing-amber">
                    {decay} Days Half-Life
                  </span>
                </div>
                <input
                  type="range"
                  min={1}
                  max={30}
                  value={decay}
                  onChange={(e) => setDecay(Number(e.target.value))}
                  className="h-1.5 w-full cursor-pointer appearance-none rounded-lg bg-surface-container-high accent-marketing-amber"
                />
                <span className="text-[11px] text-outline">
                  Touchpoints older than 14 days receive &lt;25% of baseline transition value.
                </span>
              </div>
            </div>
            <div className="flex items-center justify-between pt-1">
              <label className="flex cursor-pointer items-center gap-2 text-[11px] text-on-surface">
                <input
                  type="checkbox"
                  checked={autoRebalance}
                  onChange={(e) => {
                    setAutoRebalance(e.target.checked);
                    persist({ autoRebalance: e.target.checked });
                    flash(
                      e.target.checked
                        ? "Auto-rebalance ON — weights will bias toward closed-won proxies"
                        : "Auto-rebalance OFF"
                    );
                  }}
                  className="accent-primary-container"
                />
                Auto-rebalance coefficients from CRM closed-won deal size
              </label>
              <button
                type="button"
                onClick={saveWeightsDraft}
                className="rounded-lg bg-surface-container px-3 py-1.5 text-[12px] font-semibold text-on-surface shadow-sm hover:bg-surface-container-high"
              >
                Save Weights Draft
              </button>
            </div>
          </div>
        </div>

        {/* Right rail */}
        <div className="flex flex-col gap-5 lg:col-span-4">
          <div className="flex flex-col gap-3 rounded-xl bg-surface-container-low p-4 shadow-md">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[18px] text-tertiary">alt_route</span>
                <span className="text-[16px] font-semibold text-on-surface">Fallback Resolution Hierarchy</span>
              </div>
              <span className="rounded bg-surface-container-high px-1.5 py-0.5 font-mono text-[10px] text-outline">
                {fallbackMode}
              </span>
            </div>
            <p className="text-[11px] text-on-surface-variant">
              Deterministic waterfall when identity is masked or ad-blockers drop beacons.
            </p>
            <div className="flex flex-col gap-1.5">
              {[
                {
                  n: 1,
                  title: "Markov Algorithmic Multi-Touch",
                  sub: "Snowflake identity graph + Meta CAPI click_id",
                  primary: true,
                },
                {
                  n: 2,
                  title: "First-Touch Acquisition Lock",
                  sub: "If gclid/fbclid dropped — lock 100% to first origin",
                },
                {
                  n: 3,
                  title: "Deterministic UTM Cluster Match",
                  sub: "Campaign taxonomy ↔ CRM company domain",
                },
              ].map((s) => (
                <div key={s.n} className="flex items-start gap-2 rounded-lg bg-surface-container p-2">
                  <span
                    className={cn(
                      "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full font-mono text-[10px] font-bold",
                      s.primary
                        ? "bg-primary-container text-on-primary-container"
                        : "bg-surface-container-highest text-on-surface"
                    )}
                  >
                    {s.n}
                  </span>
                  <div>
                    <div className="text-[11px] font-semibold text-on-surface">{s.title}</div>
                    <div className="font-mono text-[10px] text-outline">{s.sub}</div>
                  </div>
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={configureFallbacks}
              className="flex w-full items-center justify-center gap-1 rounded-lg bg-surface-container py-2 text-[11px] font-medium text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface"
            >
              <span className="material-symbols-outlined text-[15px]">edit_note</span>
              Configure Fallback Cascades
            </button>
          </div>

          <div className="flex flex-col gap-3 rounded-xl bg-surface-container-low p-4 shadow-md">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="size-2 animate-ping rounded-full bg-success-emerald" />
                <span className="text-[16px] font-semibold text-on-surface">Live Attribution Stream</span>
              </div>
              <span className="font-mono text-[10px] text-tertiary">Real-time CAPI</span>
            </div>
            <div className="flex flex-col gap-2">
              {[
                {
                  title: "Enterprise HVAC Quote",
                  deal: "$8,400 deal",
                  id: "#CR-9481",
                  ago: "2m ago",
                  bars: [
                    { w: 42, c: "#1877F2", l: "Meta (42%)" },
                    { w: 38, c: "#f97316", l: "Google (38%)" },
                    { w: 20, c: "#a78b7d", l: "Direct (20%)" },
                  ],
                },
                {
                  title: "Commercial Solar Inbound",
                  deal: "$12,500 deal",
                  id: "#CR-9477",
                  ago: "11m ago",
                  bars: [
                    { w: 55, c: "#ffffff", l: "TikTok Spark (55%)" },
                    { w: 45, c: "#1877F2", l: "Meta BOFU (45%)" },
                  ],
                },
                {
                  title: "Fleet Telematics Demo",
                  deal: "$4,200 deal",
                  id: "#CR-9462",
                  ago: "38m ago",
                  bars: [
                    { w: 70, c: "#f97316", l: "Google Search (70%)" },
                    { w: 30, c: "#1877F2", l: "Meta TOFU (30%)" },
                  ],
                },
              ].map((item) => (
                <div
                  key={item.id}
                  className="flex flex-col gap-2 rounded-lg bg-surface-container p-2 transition-colors hover:bg-surface-container-high"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-semibold text-on-surface">{item.title}</span>
                    <span className="font-mono text-[10px] font-semibold text-success-emerald">
                      {item.deal}
                    </span>
                  </div>
                  <div className="flex items-center justify-between font-mono text-[10px] text-outline">
                    <span>Deal ID: {item.id}</span>
                    <span>{item.ago}</span>
                  </div>
                  <div className="flex h-1.5 overflow-hidden rounded-full bg-surface-container-high">
                    {item.bars.map((b) => (
                      <div key={b.l} className="h-full" style={{ width: `${b.w}%`, background: b.c }} />
                    ))}
                  </div>
                  <div className="flex items-center justify-between font-mono text-[10px]">
                    {item.bars.map((b) => (
                      <span key={b.l} style={{ color: b.c === "#ffffff" ? "#e3e1e9" : b.c }}>
                        {b.l}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-3 rounded-xl bg-surface-container-low p-4 shadow-md">
            <div className="flex items-center justify-between">
              <span className="text-[16px] font-semibold text-on-surface">Attribution Window & Sync</span>
              <span className="material-symbols-outlined text-[16px] text-outline">schedule</span>
            </div>
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between rounded bg-surface-container p-1.5">
                <span className="text-[11px] text-on-surface">Lookback Window</span>
                <select
                  defaultValue="30"
                  className="cursor-pointer rounded bg-surface-container-high px-2 py-1 font-mono text-[10px] text-on-surface focus:ring-1 focus:ring-primary-container focus:outline-none"
                >
                  <option value="14">14 Days (Fast cycle)</option>
                  <option value="30">30 Days (Standard B2B)</option>
                  <option value="60">60 Days (Enterprise)</option>
                  <option value="90">90 Days (Long-sales)</option>
                </select>
              </div>
              <div className="flex items-center justify-between rounded bg-surface-container p-1.5">
                <span className="text-[11px] text-on-surface">Cross-Device Graph</span>
                <span className="flex items-center gap-1 font-mono text-[10px] text-tertiary">
                  <span className="size-1.5 rounded-full bg-tertiary" /> Enabled (UUID+IP)
                </span>
              </div>
              <div className="flex items-center justify-between rounded bg-surface-container p-1.5">
                <span className="text-[11px] text-on-surface">Model Re-Training</span>
                <span className="font-mono text-[10px] font-medium text-on-surface-variant">
                  Daily 02:00 UTC
                </span>
              </div>
              <div className="flex items-center justify-between rounded bg-primary-container/10 p-1.5 text-primary">
                <span className="flex items-center gap-1 text-[11px]">
                  <span className="material-symbols-outlined text-[15px]">update</span> Next Batch In
                </span>
                <span className="font-mono text-[10px] font-semibold">4h 18m</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="flex flex-col gap-3 rounded-xl bg-surface-container-low p-4 shadow-md">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-[16px] font-semibold text-on-surface">
                Comparative Campaign Performance & CAC Arbitrage
              </h2>
              <span className="rounded-full bg-surface-container-high px-1.5 py-0.5 font-mono text-[10px] text-on-surface-variant">
                {tableRows.length} Campaigns
              </span>
            </div>
            <p className="text-[11px] text-outline">
              Credit variance and implied true CAC under Markov weighting.
            </p>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="relative flex items-center">
              <span className="material-symbols-outlined pointer-events-none absolute left-2.5 text-[15px] text-outline">
                filter_list
              </span>
              <input
                className="h-8 rounded-lg bg-surface-container pr-3 pl-8 text-[12px] text-on-surface placeholder:text-outline focus:ring-1 focus:ring-primary-container focus:outline-none"
                placeholder="Filter campaign…"
                type="search"
                value={filterQ}
                onChange={(e) => setFilterQ(e.target.value)}
              />
            </div>
            <button
              type="button"
              onClick={exportCsv}
              className="flex h-8 items-center gap-1 rounded-lg bg-surface-container px-2 font-mono text-[10px] text-on-surface hover:bg-surface-container-high"
            >
              <span className="material-symbols-outlined text-[15px]">download</span>
              Export CSV
            </button>
          </div>
        </div>

        <div className="w-full overflow-x-auto">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="bg-surface-container-lowest font-mono text-[10px] tracking-wider text-outline uppercase">
                <th className="rounded-l px-2 py-2.5">Campaign / Ad Set</th>
                <th className="px-2 py-2.5">Platform</th>
                <th className="px-2 py-2.5 text-right">Total Spend</th>
                <th className="px-2 py-2.5 text-right">Last-Touch</th>
                <th className="px-2 py-2.5 text-right">Markov</th>
                <th className="px-2 py-2.5 text-right">Delta</th>
                <th className="px-2 py-2.5 text-right">Implied CAC</th>
                <th className="rounded-r px-2 py-2.5 text-center">Recommendation</th>
              </tr>
            </thead>
            <tbody className="text-[11px]">
              {tableRows.map((c) => (
                <tr key={c.name} className="group transition-colors hover:bg-surface-container">
                  <td className="px-2 py-3">
                    <div className="flex flex-col">
                      <span className="font-semibold text-on-surface transition-colors group-hover:text-primary">
                        {c.name}
                      </span>
                      <span className="font-mono text-[10px] text-outline">ID: {c.id}</span>
                    </div>
                  </td>
                  <td className="px-2 py-3">
                    <PlatformPill platform={c.platform} />
                  </td>
                  <td className="px-2 py-3 text-right font-mono text-on-surface">{c.spend}</td>
                  <td className="px-2 py-3 text-right font-mono text-outline">{c.lastTouch}</td>
                  <td
                    className={cn(
                      "px-2 py-3 text-right font-mono font-semibold",
                      c.platform === "meta"
                        ? "text-[#60a5fa]"
                        : c.platform === "tiktok"
                          ? "text-on-surface"
                          : "text-on-surface"
                    )}
                  >
                    {c.markov}
                  </td>
                  <td className="px-2 py-3 text-right">
                    <span
                      className={cn(
                        "rounded px-1.5 py-0.5 font-mono text-[10px] font-semibold",
                        c.deltaPos === true && "bg-success-emerald/10 text-success-emerald",
                        c.deltaPos === false && "bg-alert-rose/10 text-alert-rose",
                        c.deltaPos === null && "bg-surface-container-high text-on-surface-variant"
                      )}
                    >
                      {c.delta}
                    </span>
                  </td>
                  <td
                    className={cn(
                      "px-2 py-3 text-right font-mono font-semibold",
                      c.deltaPos === true && "text-success-emerald",
                      c.deltaPos === false && "text-alert-rose",
                      c.deltaPos === null && "text-on-surface"
                    )}
                  >
                    {c.cac}{" "}
                    {c.cacStrike ? (
                      <span className="text-[10px] font-normal text-outline line-through">
                        {c.cacStrike}
                      </span>
                    ) : null}
                  </td>
                  <td className="px-2 py-3 text-center">
                    <span
                      className={cn(
                        "inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 font-mono text-[10px] font-semibold",
                        c.recTone === "scale" && "bg-success-emerald/15 text-success-emerald",
                        c.recTone === "trim" && "bg-alert-rose/15 text-alert-rose",
                        c.recTone === "hold" && "bg-surface-container-high text-on-surface-variant",
                        c.recTone === "fix" && "bg-alert-rose/15 text-alert-rose"
                      )}
                    >
                      <span className="material-symbols-outlined text-[13px]">
                        {c.recTone === "scale"
                          ? "trending_up"
                          : c.recTone === "trim"
                            ? "trending_down"
                            : c.recTone === "hold"
                              ? "pause"
                              : "cancel"}
                      </span>
                      {c.rec}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
