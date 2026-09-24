"use client";

import {
  useEffect,
  useMemo,
  useState,
  type ChangeEvent,
  type DragEvent,
  type FormEvent,
  type ReactNode,
} from "react";
import type { AttributedLead, CampaignAction, DeskWasteSummary, SpendEvent, StoredCampaign } from "@helix/core";
import { ScatterPlot } from "@/components/scatter-plot";
import { SAMPLE_CSV } from "@/lib/sample-csv";
import {
  compactCount,
  letterIndex,
  median,
  money,
  platformLabel,
  recLabel,
  recTone,
} from "@/lib/format";
import { cn } from "@/lib/utils";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  Copy,
  Download,
  FileUp,
  Flame,
  FlaskConical,
  Gavel,
  Info,
  RefreshCw,
  ScatterChart,
  Upload,
  Wallet,
  Zap,
} from "lucide-react";

type Filter = "all" | "pause" | "scale" | "keep" | "review";
type Range = "7d" | "30d" | "90d";

function csvLineCount(csv: string) {
  return csv
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l, i) => l && i > 0).length;
}

function sparkPath(values: number[]) {
  if (values.length === 0) return { line: "", area: "" };
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const span = Math.max(1, max - min);
  const pts = values.map((v, i) => {
    const x = 2 + (i / Math.max(1, values.length - 1)) * 66;
    const y = 22 - ((v - min) / span) * 18;
    return [x, y] as const;
  });
  const line = pts.map((p, i) => `${i === 0 ? "M" : "L"}${p[0]} ${p[1]}`).join(" ");
  const area = `${line} V24 H2 Z`;
  return { line, area };
}

export function MarketingDashboard() {
  const [campaigns, setCampaigns] = useState<StoredCampaign[]>([]);
  const [leads, setLeads] = useState<AttributedLead[]>([]);
  const [filter, setFilter] = useState<Filter>("all");
  const [openId, setOpenId] = useState<string | null>(null);
  const [csv, setCsv] = useState(SAMPLE_CSV);
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [note, setNote] = useState("");
  const [hideEmpty, setHideEmpty] = useState(false);
  const [ingestOpen, setIngestOpen] = useState(true);
  const [range, setRange] = useState<Range>("7d");
  const [unmatched, setUnmatched] = useState<SpendEvent[]>([]);
  const [series, setSeries] = useState<{ day: string; spend: number }[]>([]);
  const [bounds, setBounds] = useState<{ from: string; to: string } | null>(null);
  const [waste, setWaste] = useState<DeskWasteSummary | null>(null);
  const [toast, setToast] = useState<{ msg: string; err?: boolean } | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [syncing, setSyncing] = useState<"meta" | "leads" | null>(null);
  const [metaReady, setMetaReady] = useState(false);

  function showToast(msg: string, err = false) {
    setToast({ msg, err });
    window.setTimeout(() => setToast(null), 2800);
  }

  async function syncMeta() {
    setSyncing("meta");
    try {
      const res = await fetch("/api/ads/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ window: range }),
      });
      const data = (await res.json()) as {
        error?: string;
        imported?: number;
        message?: string;
        unmatchedCount?: number;
      };
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      await refresh();
      showToast(
        data.imported
          ? `Meta Insights: imported ${data.imported} rows${
              data.unmatchedCount ? ` · ${data.unmatchedCount} unmatched` : ""
            }`
          : data.message || "Meta sync complete (0 rows)"
      );
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Meta sync failed", true);
    } finally {
      setSyncing(null);
    }
  }

  async function syncLeads() {
    setSyncing("leads");
    try {
      const res = await fetch("/api/leads/sync", { method: "POST" });
      const data = (await res.json()) as {
        error?: string;
        imported?: number;
        skipped?: number;
        unmatched?: number;
      };
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      await refresh();
      showToast(
        `Leads sync: ${data.imported ?? 0} imported${
          data.skipped ? `, ${data.skipped} skipped` : ""
        }${data.unmatched != null ? ` · ${data.unmatched} unmatched` : ""}`
      );
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Leads sync failed", true);
    } finally {
      setSyncing(null);
    }
  }

  async function refresh(nextRange: Range = range) {
    const res = await fetch(`/api/campaigns?window=${nextRange}`);
    const data = (await res.json()) as {
      campaigns: StoredCampaign[];
      leads: AttributedLead[];
      unmatched: SpendEvent[];
      series: { day: string; spend: number }[];
      waste?: DeskWasteSummary;
      from: string;
      to: string;
    };
    setCampaigns(data.campaigns ?? []);
    setLeads(data.leads ?? []);
    setUnmatched(data.unmatched ?? []);
    setSeries(data.series ?? []);
    setWaste(data.waste ?? null);
    if (data.from && data.to) setBounds({ from: data.from, to: data.to });
  }

  useEffect(() => {
    void refresh(range);
    // range is the window key; refresh closes over it on purpose
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range]);

  useEffect(() => {
    void fetch("/api/ads/sync")
      .then((r) => r.json())
      .then((d: { metaConfigured?: boolean }) => setMetaReady(Boolean(d.metaConfigured)))
      .catch(() => setMetaReady(false));
  }, []);

  const metrics = useMemo(() => {
    const spend = campaigns.reduce((s, c) => s + c.spend, 0);
    const scores = campaigns.map((c) => c.metrics.avgScore);
    const avg =
      campaigns.length === 0 ? 0 : Math.round(campaigns.reduce((s, c) => s + c.metrics.avgScore, 0) / campaigns.length);
    const hotCost = campaigns.map((c) => c.metrics.costPerHot).filter((n): n is number => n != null);
    const costPerHot = hotCost.length === 0 ? null : hotCost.reduce((s, n) => s + n, 0) / hotCost.length;
    const review = campaigns.filter((c) => c.needsReview);
    return {
      spend,
      avg,
      medianScore: median(scores),
      costPerHot,
      review: review.length,
      reviewNames: review.map((c) => c.name.replace(/^Ad\s+/i, "Ad ")).join(", ") || "—",
    };
  }, [campaigns]);

  const counts = useMemo(
    () => ({
      all: campaigns.length,
      pause: campaigns.filter((c) => c.action === "pause").length,
      scale: campaigns.filter((c) => c.action === "scale").length,
      keep: campaigns.filter((c) => c.action === "keep").length,
      review: campaigns.filter((c) => c.needsReview).length,
    }),
    [campaigns]
  );

  const visible = useMemo(() => {
    return campaigns.filter((c) => {
      if (filter === "review") return c.needsReview;
      if (filter === "pause" || filter === "scale" || filter === "keep") return c.action === filter;
      return true;
    });
  }, [campaigns, filter]);

  const spendSpark = sparkPath(series.map((s) => s.spend));
  const costSpark = sparkPath(campaigns.map((c) => c.metrics.costPerHot ?? 0));
  const unmatchedIds = new Set(unmatched.map((u) => u.campaignId)).size;

  async function ingest(e?: FormEvent) {
    e?.preventDefault();
    setRunning(true);
    setError(null);
    try {
      const res = await fetch("/api/campaigns/ingest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ csv }),
      });
      const data = (await res.json()) as { error?: string; unmatchedCount?: number };
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      await refresh();
      showToast(
        data.unmatchedCount
          ? `Joined what we could. ${data.unmatchedCount} campaign_id(s) have no scored leads — see Join queue.`
          : "Scored campaigns with heuristic REC. Status is local only."
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
      showToast(msg, true);
    } finally {
      setRunning(false);
    }
  }

  async function review(id: string, action: CampaignAction) {
    const res = await fetch(`/api/campaigns/${id}/review`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, note }),
    });
    const data = (await res.json()) as {
      campaign?: StoredCampaign;
      error?: string;
      adsWrite?: { attempted: boolean; ok: boolean; detail: string };
    };
    if (!res.ok) {
      showToast(data.error || "Review failed", true);
      return;
    }
    if (data.campaign) {
      setCampaigns((prev) => prev.map((c) => (c.id === id ? data.campaign! : c)));
      setNote("");
      const w = data.adsWrite;
      if (w?.attempted && w.ok) showToast(`Local + Ads Manager: ${w.detail}`);
      else if (w?.attempted && !w.ok) showToast(`Saved locally; Ads write failed: ${w.detail}`, true);
      else showToast(w?.detail || "Confirmed locally.");
    }
  }

  function exportCsv() {
    const header =
      "campaign_id,name,platform,spend,impressions,clicks,form_leads,avg_score,cost_per_hot,spend_on_spam,spam_rate,action,needs_review";
    const rows = campaigns.map((c) =>
      [
        c.campaignId,
        `"${c.name.replaceAll('"', '""')}"`,
        c.platform,
        c.spend,
        c.impressions ?? "",
        c.clicks ?? "",
        c.metrics.formLeads,
        c.metrics.avgScore,
        c.metrics.costPerHot ?? "",
        c.metrics.spendOnSpam,
        c.metrics.spamRate,
        c.action,
        c.needsReview,
      ].join(",")
    );
    const blob = new Blob([[header, ...rows].join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "campaigns_decision_matrix.csv";
    a.click();
    URL.revokeObjectURL(url);
    showToast("Exported campaigns_decision_matrix.csv");
  }

  function onFile(file: File) {
    void file.text().then((text) => {
      setCsv(text);
      showToast(`Loaded ${file.name}`);
    });
  }

  function onDrop(e: DragEvent<HTMLLabelElement>) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) onFile(file);
  }

  function onPick(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) onFile(file);
  }

  const hideHot = hideEmpty && visible.every((c) => c.metrics.costPerHot == null);

  return (
    <div className="w-full pb-8">
      <div className="mx-auto flex w-full max-w-[1680px] flex-col gap-5">
        <div className="flex flex-col items-start justify-between gap-3 rounded-xl bg-surface-container-low p-3 shadow-sm md:flex-row md:items-center">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary-container/15">
              <Info className="size-[18px] text-primary-container" />
            </div>
            <p className="text-[13px] leading-relaxed text-on-surface-variant">
              <span className="font-medium text-on-surface">Join campaign spend to scored leads.</span> REC
              synthesizes{" "}
              <span className="inline-flex items-center gap-1 font-medium text-alert-rose">
                <span className="size-1.5 rounded-full bg-alert-rose" />
                pause
              </span>{" "}
              /{" "}
              <span className="inline-flex items-center gap-1 font-medium text-success-emerald">
                <span className="size-1.5 rounded-full bg-success-emerald" />
                scale
              </span>{" "}
              /{" "}
              <span className="inline-flex items-center gap-1 font-medium text-marketing-amber">
                <span className="size-1.5 rounded-full bg-marketing-amber" />
                keep
              </span>
              . A human confirms pause/scale — Meta writes via graph sync; Google & TikTok stay local.
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2 self-end md:self-auto">
            <div className="flex items-center gap-2 rounded-full bg-surface-container px-2.5 py-1 font-mono text-[10px]">
              <span className="relative flex size-2">
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-tertiary opacity-75" />
                <span className="relative inline-flex size-2 rounded-full bg-tertiary" />
              </span>
              <span className="font-medium text-on-surface">Live Pipeline</span>
              <span className="text-tertiary">{metrics.review} in HITL</span>
            </div>
            <button
              className="flex h-8 items-center gap-1.5 rounded-lg bg-surface-container-high px-3 text-[12px] font-medium text-on-surface transition-colors hover:bg-surface-bright disabled:opacity-50"
              disabled={syncing !== null}
              onClick={() => void syncMeta()}
              type="button"
              title={metaReady ? "Pull Meta Insights into desk" : "Needs Meta keys in Settings"}
            >
              <RefreshCw className={cn("size-3.5", syncing === "meta" && "animate-spin")} />
              {syncing === "meta" ? "Syncing Meta…" : "Sync Meta"}
            </button>
            <button
              className="flex h-8 items-center gap-1.5 rounded-lg bg-surface-container-high px-3 text-[12px] font-medium text-on-surface transition-colors hover:bg-surface-bright disabled:opacity-50"
              disabled={syncing !== null}
              onClick={() => void syncLeads()}
              type="button"
              title="Pull scored leads from Helix for Leads"
            >
              <RefreshCw className={cn("size-3.5", syncing === "leads" && "animate-spin")} />
              {syncing === "leads" ? "Syncing Leads…" : "Sync Leads"}
            </button>
            <button
              className="flex h-8 items-center gap-1.5 rounded-lg bg-surface-container-high px-3 text-[12px] font-medium text-on-surface transition-colors hover:bg-surface-bright"
              onClick={() => {
                void refresh().then(() =>
                  showToast(
                    bounds
                      ? `Rescored ${range} (${bounds.from} → ${bounds.to}).`
                      : "Scores refreshed from the heuristic model."
                  )
                );
              }}
              type="button"
            >
              <RefreshCw className="size-3.5" />
              Recalculate
            </button>
          </div>
        </div>
        {unmatchedIds > 0 ? (
          <a
            className="flex items-center justify-between gap-3 rounded-xl bg-primary-container/10 px-4 py-3 text-xs text-marketing-amber hover:bg-primary-container/15"
            href="/unmatched"
          >
            <span>
              {unmatchedIds} campaign_id{unmatchedIds === 1 ? "" : "s"} in this window have spend and no scored
              leads. Helix will not invent a quality score.
            </span>
            <span className="shrink-0 font-medium text-primary">Join queue →</span>
          </a>
        ) : null}
        {waste && waste.spendOnSpam > 0 ? (
          <a
            className="flex items-center justify-between gap-3 rounded-xl bg-alert-rose/10 px-4 py-3 text-xs text-alert-rose hover:bg-alert-rose/15"
            href="/waste"
          >
            <span>
              About {money(waste.spendOnSpam)} ({Math.round(waste.wastePct * 100)}%) of joined spend is attributed to
              spam leads
              {waste.worstCampaignName ? ` — worst: ${waste.worstCampaignName}` : ""}.
            </span>
            <span className="shrink-0 font-medium text-alert-rose">$ on spam →</span>
          </a>
        ) : null}

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <KpiCard
            icon={<Wallet className="size-4 text-outline" />}
            label="Total Spend"
            badge="Mix"
            value={money(metrics.spend)}
            left={`${campaigns.length} active ads`}
            right={waste ? `${money(waste.spendOnSpam)} on spam` : "Seed + ingested CSV"}
            chart={
              <svg className="h-7 w-20" fill="none" viewBox="0 0 70 24">
                <path d={spendSpark.line} stroke="#f97316" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.75" />
                <path d={spendSpark.area} fill="#f97316" fillOpacity="0.12" />
              </svg>
            }
          />
          <KpiCard
            icon={<ScatterChart className="size-4 text-outline" />}
            label="Avg Quality Score"
            badge="Index 0–100"
            value={
              <>
                {metrics.avg}
                <span className="font-sans text-xs font-normal text-outline">/100</span>
              </>
            }
            left="Unweighted avg"
            right={`Median ${Math.round(metrics.medianScore)}`}
            chart={
              <div className="flex w-20 flex-col gap-1">
                <div className="h-1.5 w-full overflow-hidden rounded-full border border-[var(--border-hairline)] bg-surface-container-lowest">
                  <div className="h-full rounded-full bg-primary" style={{ width: `${metrics.avg}%` }} />
                </div>
                <span className="text-right text-[10px] text-outline">Median {Math.round(metrics.medianScore)}</span>
              </div>
            }
          />
          <KpiCard
            icon={<Flame className="size-4 text-outline" />}
            label="Cost / Hot Lead"
            badge={metrics.costPerHot != null && metrics.costPerHot < 80 ? "Efficient" : "Watch"}
            value={
              <>
                {metrics.costPerHot == null ? "—" : money(Math.round(metrics.costPerHot))}
                {metrics.costPerHot != null ? <span className="text-xs font-normal text-outline">.00</span> : null}
              </>
            }
            left={
              metrics.costPerHot == null
                ? "No hot-lead cost yet"
                : `${metrics.costPerHot < 80 ? "↓" : "↑"} vs $80 scale rule`
            }
            right="Mean w/ hot leads"
            leftClass={metrics.costPerHot != null && metrics.costPerHot < 80 ? "text-on-surface-variant" : "text-outline"}
            chart={
              <svg className="h-7 w-20" fill="none" viewBox="0 0 70 24">
                <path d={costSpark.line} stroke="#3BAF7E" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.75" />
                <path d={costSpark.area} fill="#3BAF7E" fillOpacity="0.12" />
              </svg>
            }
          />
          <KpiCard
            icon={<Gavel className="size-4 text-outline" />}
            label="HITL Queue"
            badge={metrics.review > 0 ? "Action needed" : "Clear"}
            badgeClass={metrics.review > 0 ? "bg-[rgba(217,164,65,0.12)] text-marketing-amber" : undefined}
            value={
              <>
                {metrics.review}
                <span className="font-sans text-xs font-normal text-outline">/{campaigns.length || 0} ads</span>
              </>
            }
            left="Needs human call"
            right={metrics.reviewNames}
            chart={
              <div className="flex w-20 flex-col gap-1">
                <div className="h-1.5 w-full overflow-hidden rounded-full border border-[var(--border-hairline)] bg-surface-container-lowest">
                  <div
                    className="h-full rounded-full bg-marketing-amber"
                    style={{ width: `${campaigns.length === 0 ? 0 : (metrics.review / campaigns.length) * 100}%` }}
                  />
                </div>
                <span className="text-right text-[10px] text-marketing-amber">
                  {campaigns.length === 0 ? "0" : Math.round((metrics.review / campaigns.length) * 100)}% in queue
                </span>
              </div>
            }
          />
        </div>

        <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-10">
          <div className="flex flex-col gap-5 lg:col-span-7">
            <section className="rounded-xl border border-[var(--border-hairline)] bg-surface-container-low p-5 shadow-lg backdrop-blur-sm">
              <div className="mb-3 flex flex-col items-start justify-between gap-2 border-b border-[var(--border-hairline)] pb-3 sm:flex-row sm:items-center">
                <div>
                  <div className="flex items-center gap-2">
                    <ScatterChart className="size-[18px] text-on-surface-variant" />
                    <h2 className="text-sm font-semibold text-on-surface">Spend vs Lead Quality (LIVE Correlation)</h2>
                    <span className="rounded-full bg-surface-container-highest/40 px-2 py-0.5 text-xs font-medium text-on-surface-variant">
                      Live signal
                    </span>
                  </div>
                  <p className="mt-0.5 text-xs text-outline">
                    Correlation between budget deployment and heuristic score
                    {bounds ? ` · ${bounds.from} → ${bounds.to}` : ""}. Bubble radius = form volume.
                  </p>
                </div>
                <div className="flex items-center gap-1 rounded-lg border border-[var(--border-hairline)] bg-surface-container-lowest p-1">
                  {(["7d", "30d", "90d"] as Range[]).map((id) => (
                    <button
                      key={id}
                      className={cn(
                        "rounded px-2.5 py-0.5 text-xs font-medium",
                        range === id ? "bg-on-surface/10 text-on-surface" : "text-on-surface-variant hover:text-on-surface"
                      )}
                      onClick={() => setRange(id)}
                      type="button"
                    >
                      {id}
                    </button>
                  ))}
                </div>
              </div>
              <ScatterPlot
                campaigns={campaigns}
                onSelect={(id) => setOpenId((cur) => (cur === id ? null : id))}
              />
              <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-[var(--border-hairline)] pt-3 text-xs">
                <div className="flex items-center gap-4">
                  <LegendDot color="#3BAF7E" label="Scale (>70)" />
                  <LegendDot color="#D9A441" label="Keep · HITL (35–70)" />
                  <LegendDot color="#D9605F" label="Pause (<35)" />
                </div>
                <div className="text-outline">Bubble radius = form lead volume</div>
              </div>
            </section>

            <section className="overflow-hidden rounded-xl border border-[var(--border-hairline)] bg-surface-container-low shadow-lg backdrop-blur-sm">
              <div className="flex flex-col items-start justify-between gap-3 border-b border-[var(--border-hairline)] p-4 sm:flex-row sm:items-center">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-semibold text-on-surface">Campaigns</h3>
                  <span className="rounded-full bg-surface-container-highest/40 px-2 py-0.5 text-xs font-medium text-on-surface-variant">
                    {campaigns.length} synced
                  </span>
                </div>
                <div className="flex items-center justify-between gap-3 self-stretch sm:self-auto">
                  <label className="flex cursor-pointer items-center gap-2 text-xs text-on-surface-variant select-none">
                    <input
                      checked={hideEmpty}
                      className="rounded border-[var(--border-hairline)] bg-surface-container-lowest text-success-emerald focus:ring-0"
                      onChange={(e) => {
                        setHideEmpty(e.target.checked);
                        showToast(e.target.checked ? "Hiding empty $/hot cells" : "Showing all metrics");
                      }}
                      type="checkbox"
                    />
                    Hide empty columns
                  </label>
                  <button
                    className="flex items-center gap-1 rounded border border-[var(--border-hairline)] bg-surface-container px-2.5 py-1 text-xs font-medium text-on-surface hover:bg-surface-container-high"
                    onClick={exportCsv}
                    type="button"
                  >
                    <Download className="size-3.5 text-on-surface-variant" />
                    Export
                  </button>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-1.5 border-b border-[var(--border-hairline)] bg-surface-container-lowest/70 px-4 py-2">
                {(
                  [
                    ["all", `All ${counts.all}`],
                    ["pause", "Pause"],
                    ["scale", "Scale"],
                    ["keep", "Keep · HITL"],
                    ["review", "Review Needed"],
                  ] as const
                ).map(([id, label]) => (
                  <button
                    key={id}
                    className={cn(
                      "rounded-md px-3 py-1 text-xs font-medium",
                      filter === id ? "bg-on-surface/10 text-on-surface" : "text-outline hover:text-on-surface"
                    )}
                    onClick={() => setFilter(id)}
                    type="button"
                  >
                    {label}
                    {id === "pause" ? <span className="ml-1 text-alert-rose">{counts.pause}</span> : null}
                    {id === "scale" ? <span className="ml-1 text-success-emerald">{counts.scale}</span> : null}
                    {id === "keep" ? <span className="ml-1 text-[#D9A441]">{counts.keep}</span> : null}
                  </button>
                ))}
              </div>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-left">
                  <thead className="border-b border-[var(--border-hairline)] bg-surface-container-lowest text-[11px] font-medium tracking-wider text-on-surface-variant uppercase">
                    <tr>
                      <th className="px-4 py-2.5">Campaign</th>
                      <th className="px-4 py-2.5 text-right">Spend</th>
                      <th className="px-4 py-2.5 text-right">Forms</th>
                      <th className="px-4 py-2.5 text-center">Avg Score</th>
                      {hideHot ? null : <th className="px-4 py-2.5 text-right">$/Hot</th>}
                      <th className="px-4 py-2.5 text-center">REC</th>
                      <th className="px-4 py-2.5 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.05] text-xs">
                    {visible.map((c, i) => {
                      const tone = recTone(c.action);
                      const open = openId === c.id;
                      const related = leads.filter((l) => l.campaignId === c.campaignId);
                      return (
                        <CampaignBlock
                          key={c.id}
                          campaign={c}
                          hideHot={hideHot}
                          index={i}
                          note={open ? note : ""}
                          onNote={setNote}
                          onReview={review}
                          onToggle={() => setOpenId(open ? null : c.id)}
                          open={open}
                          related={related}
                          tone={tone}
                        />
                      );
                    })}
                  </tbody>
                </table>
                {visible.length === 0 ? (
                  <p className="px-4 py-8 text-sm text-outline">No campaigns in this filter.</p>
                ) : null}
              </div>
              <div className="flex flex-col items-center justify-between gap-2 border-t border-[var(--border-hairline)] bg-surface-container-lowest px-4 py-2.5 text-xs text-outline sm:flex-row">
                <div>Deterministic heuristic · score ≥ 70 and cheap hot leads → scale, ≤ 35 or spam-heavy → pause</div>
                <div>
                  Page 1 of 1 · {visible.length} records
                </div>
              </div>
            </section>
          </div>

          <aside className="flex flex-col overflow-hidden rounded-xl border border-[var(--border-hairline)] bg-surface-container-low shadow-lg backdrop-blur-sm lg:col-span-3">
            <div className="border-b border-[var(--border-hairline)] p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Upload className="size-[18px] text-on-surface-variant" />
                  <h3 className="text-sm font-semibold text-on-surface">Ingest spend CSV</h3>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="rounded-full bg-surface-container-highest/40 px-2 py-0.5 text-xs font-medium text-on-surface-variant">
                    Secondary
                  </span>
                  <button
                    className="rounded p-0.5 text-outline hover:text-on-surface"
                    onClick={() => setIngestOpen((v) => !v)}
                    title="Toggle panel"
                    type="button"
                  >
                    <ChevronRight className={cn("size-[18px] transition-transform", ingestOpen ? "rotate-90" : "")} />
                  </button>
                </div>
              </div>
              <p className="mt-1 text-xs text-outline">
                CSV always works. Meta Insights via <span className="text-on-surface">Sync Meta</span>
                {metaReady ? " (keys OK)" : " (needs keys in Settings)"}. Google Ads write not live.
              </p>
              <div className="mt-3 flex items-center justify-between gap-1.5 rounded-lg border border-[var(--border-hairline)] bg-surface-container-lowest p-2">
                <code className="truncate font-mono text-xs text-on-surface-variant">
                  <span className="font-semibold text-primary">POST</span> /api/campaigns/ingest
                </code>
                <button
                  className="p-1 text-outline hover:text-on-surface"
                  onClick={() => {
                    void navigator.clipboard.writeText("POST /api/campaigns/ingest").then(
                      () => showToast("Copied: POST /api/campaigns/ingest"),
                      () => showToast("Endpoint: POST /api/campaigns/ingest")
                    );
                  }}
                  type="button"
                >
                  <Copy className="size-3.5" />
                </button>
              </div>
            </div>
            {ingestOpen ? (
              <form onSubmit={(e) => void ingest(e)}>
                <div className="border-b border-[var(--border-hairline)] bg-surface-container-lowest p-3">
                  <div className="mb-1.5 flex items-center justify-between border-b border-[var(--border-hairline)] pb-1.5 text-xs text-outline">
                    <span className="flex items-center gap-1.5">
                      <span className="size-2 rounded-full bg-white/20" />
                      <span className="size-2 rounded-full bg-white/20" />
                      <span className="size-2 rounded-full bg-white/20" />
                      <span className="ml-1 font-mono text-[11px] text-on-surface-variant">campaigns_schema.csv</span>
                    </span>
                    <span className="font-mono text-[10px]">UTF-8</span>
                  </div>
                  <textarea
                    className="h-28 w-full resize-none bg-transparent font-mono text-xs leading-relaxed text-on-surface-variant outline-none focus:text-on-surface"
                    onChange={(e) => setCsv(e.target.value)}
                    spellCheck={false}
                    value={csv}
                  />
                </div>
                <div className="space-y-3 p-4">
                  <label
                    className={cn(
                      "group flex cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-[var(--border-hairline)] bg-surface-container-lowest/80 p-4 transition-colors hover:border-primary",
                      dragOver && "border-primary"
                    )}
                    onDragLeave={() => setDragOver(false)}
                    onDragOver={(e) => {
                      e.preventDefault();
                      setDragOver(true);
                    }}
                    onDrop={onDrop}
                  >
                    <FileUp className="size-[22px] text-outline transition-colors group-hover:text-primary" />
                    <span className="mt-1.5 text-xs font-medium text-on-surface-variant group-hover:text-on-surface">
                      Drop CSV or browse
                    </span>
                    <span className="text-[10px] text-outline">UTF-8 comma-delimited</span>
                    <input accept=".csv,text/csv" className="hidden" onChange={onPick} type="file" />
                  </label>
                  <div className="flex items-center justify-between rounded-lg border border-[var(--border-hairline)] bg-surface-container-lowest px-3 py-1.5 text-xs">
                    <div className="flex items-center gap-1.5">
                      <span className="size-1.5 rounded-full bg-success-emerald" />
                      <span className="text-on-surface-variant">{error ?? "Ready to process"}</span>
                    </div>
                    <span className="font-mono text-outline">{csvLineCount(csv)} records</span>
                  </div>
                  {error ? <p className="text-xs text-alert-rose">{error}</p> : null}
                  <button
                    className="flex h-10 w-full cursor-pointer items-center justify-center gap-2 rounded-lg bg-primary-container text-xs font-semibold text-on-primary shadow-md transition-all hover:bg-marketing-amber active:scale-[0.99] disabled:opacity-60"
                    disabled={running}
                    type="submit"
                  >
                    {running ? <RefreshCw className="size-[18px] animate-spin" /> : <Zap className="size-[18px]" />}
                    {running ? "Joining & scoring..." : "Join & score"}
                  </button>
                </div>
              </form>
            ) : null}
          </aside>
        </div>
      </div>

      <div
        className={cn(
          "fixed right-6 bottom-6 z-50 flex items-center gap-2 rounded-lg border border-[var(--border-hairline)] bg-surface-container-high px-4 py-2.5 text-xs text-on-surface shadow-2xl transition-all duration-200",
          toast ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-3 opacity-0"
        )}
      >
        {toast?.err ? (
          <AlertTriangle className="size-[18px] text-alert-rose" />
        ) : (
          <CheckCircle2 className="size-[18px] text-success-emerald" />
        )}
        <span>{toast?.msg ?? "Ready"}</span>
      </div>
    </div>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="size-2.5 rounded-full" style={{ background: color }} />
      <span className="text-xs text-on-surface-variant">{label}</span>
    </div>
  );
}

function KpiCard({
  icon,
  label,
  badge,
  badgeClass,
  value,
  left,
  right,
  leftClass,
  chart,
}: {
  icon: ReactNode;
  label: string;
  badge: string;
  badgeClass?: string;
  value: ReactNode;
  left: string;
  right: string;
  leftClass?: string;
  chart: React.ReactNode;
}) {
  return (
    <div className="group relative flex flex-col justify-between overflow-hidden rounded-xl bg-surface-container-low p-3 shadow-sm transition-all hover:bg-surface-container">
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-outline">
          {icon}
          <span className="text-[11px] font-medium tracking-wider uppercase">{label}</span>
        </div>
        <span
          className={cn(
            "rounded-full bg-surface-container-highest px-2 py-0.5 font-mono text-[10px] font-medium text-on-surface-variant",
            badgeClass
          )}
        >
          {badge}
        </span>
      </div>
      <div className="my-2 flex items-baseline justify-between">
        <div className="text-[32px] leading-10 font-semibold tracking-tight text-on-surface">{value}</div>
        {chart}
      </div>
      <div className="flex items-center justify-between border-t border-[var(--border-hairline)] pt-2 font-mono text-[10px] text-outline">
        <span className={leftClass}>{left}</span>
        <span className="truncate pl-2">{right}</span>
      </div>
    </div>
  );
}

function CampaignBlock({
  campaign: c,
  hideHot,
  index,
  note,
  onNote,
  onReview,
  onToggle,
  open,
  related,
  tone,
}: {
  campaign: StoredCampaign;
  hideHot: boolean;
  index: number;
  note: string;
  onNote: (v: string) => void;
  onReview: (id: string, action: CampaignAction) => Promise<void>;
  onToggle: () => void;
  open: boolean;
  related: AttributedLead[];
  tone: ReturnType<typeof recTone>;
}) {
  const clicks = c.clicks ?? 0;
  const conv = clicks > 0 ? ((c.metrics.formLeads / clicks) * 100).toFixed(1) : "—";
  const spamPct = c.metrics.nLeads === 0 ? 0 : Math.round((c.metrics.nSpam / c.metrics.nLeads) * 100);
  const Icon = c.action === "pause" ? AlertTriangle : c.action === "scale" ? CheckCircle2 : c.metrics.nLeads < 8 ? FlaskConical : Gavel;
  const primary =
    c.action === "pause" ? "Approve Pause" : c.action === "scale" ? "Authorize Scale" : "Confirm Keep";

  return (
    <>
      <tr
        className="cursor-pointer border-l-2 transition-colors hover:bg-surface-container/60"
        onClick={onToggle}
        style={{ borderLeftColor: tone.hex }}
      >
        <td className="px-4 py-3">
          <div className="flex items-center gap-2.5">
            <div className="flex size-7 items-center justify-center rounded bg-surface-container font-mono text-xs font-medium text-on-surface-variant">
              #{letterIndex(index)}
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <a
                  className="font-medium text-on-surface hover:text-primary"
                  href={`/campaigns/${c.campaignId}`}
                  onClick={(e) => e.stopPropagation()}
                >
                  {c.name}
                </a>
                <span
                  className={cn(
                    "rounded-full px-1.5 py-0.5 text-[10px] font-medium",
                    c.platform === "meta"
                      ? "bg-blue-500/15 text-blue-300"
                      : c.platform === "google"
                        ? "bg-amber-500/15 text-amber-300"
                        : "bg-surface-container-highest/50 text-on-surface-variant"
                  )}
                >
                  {platformLabel(c.platform)}
                </span>
              </div>
              <span className="text-xs text-outline">
                {compactCount(c.impressions)} impr · {compactCount(c.clicks)} clk
              </span>
            </div>
          </div>
        </td>
        <td className="px-4 py-3 text-right font-mono font-medium text-on-surface">{money(c.spend)}</td>
        <td className="px-4 py-3 text-right font-mono text-on-surface">{c.metrics.formLeads}</td>
        <td className="px-4 py-3 text-center">
          <span className={cn("rounded-full px-2 py-0.5 font-mono font-medium", tone.bg, tone.text)}>
            {c.metrics.avgScore.toFixed(2)}
          </span>
        </td>
        {hideHot ? null : (
          <td className="px-4 py-3 text-right font-mono font-medium">
            {c.metrics.costPerHot == null ? (
              <span className="cursor-help border-b border-dotted border-outline-variant/40 text-outline" title="no hot leads yet">
                —
              </span>
            ) : (
              <span className={tone.text}>{money(c.metrics.costPerHot, 2)}</span>
            )}
          </td>
        )}
        <td className="px-4 py-3 text-center">
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium",
              tone.bg,
              tone.text,
              tone.border
            )}
          >
            <span className={cn("size-1.5 rounded-full", tone.fill)} />
            {recLabel(c)}
          </span>
        </td>
        <td className="px-4 py-3 text-right">
          <button
            className="inline-flex items-center gap-1 font-medium text-on-surface-variant hover:text-on-surface"
            onClick={(e) => {
              e.stopPropagation();
              onToggle();
            }}
            type="button"
          >
            Review
            <ChevronRight className="size-3.5" />
          </button>
        </td>
      </tr>
      {open ? (
        <tr className="border-b border-[var(--border-hairline)] bg-surface-container-lowest/90">
          <td className="p-4" colSpan={hideHot ? 6 : 7}>
            <div className="rounded-lg border border-[var(--border-hairline)] bg-obsidian-base p-3 text-xs shadow-inner">
              <div className="mb-2 flex items-center justify-between border-b border-[var(--border-hairline)] pb-2">
                <div className="flex items-center gap-2">
                  <Icon className="size-4" style={{ color: tone.hex }} />
                  <span className="font-medium text-on-surface">
                    Audit Breakdown · Heuristic REC: {recLabel(c)}
                  </span>
                </div>
                <span className="font-mono text-xs text-outline">
                  {c.runId} · {c.engine}
                  {c.demoMode ? " · demo" : ""}
                </span>
              </div>
              <div className="mb-3 grid grid-cols-1 gap-3 sm:grid-cols-4">
                <AuditCell
                  label="Threshold rule"
                  value={
                    c.action === "pause"
                      ? `Score ≤ 35 or spam-heavy (avg ${c.metrics.avgScore})`
                      : c.action === "scale"
                        ? `Score ≥ 70 and $/hot < $80 (avg ${c.metrics.avgScore})`
                        : c.metrics.nLeads < 8
                          ? `N < 8 scored leads (${c.metrics.nLeads} observed)`
                          : `Mid band (avg ${c.metrics.avgScore})`
                  }
                  valueClass={tone.text}
                />
                <AuditCell
                  label="Lead conversion"
                  value={`${c.metrics.formLeads} forms / ${compactCount(c.clicks)} clk (${conv}%)`}
                />
                <AuditCell
                  label="Hot leads"
                  value={`${c.metrics.nHot} hot · ${c.metrics.nSpam} spam (${spamPct}%)`}
                  valueClass={c.metrics.nHot === 0 ? "text-alert-rose font-medium" : undefined}
                />
                <AuditCell
                  label="Local budget"
                  value={`${money(c.spend)} in this desk — pause/scale can write Meta when configured`}
                />
              </div>
              <p className="mb-3 text-on-surface-variant">{c.reasoning}</p>
              <a
                className="mb-3 inline-block text-xs text-primary"
                href={`/campaigns/${c.campaignId}`}
                onClick={(e) => e.stopPropagation()}
              >
                Open campaign evidence →
              </a>
              {related.length > 0 ? (
                <p className="mb-3 text-outline">
                  Sample: {related.slice(0, 4).map((l) => `${l.name} ${l.score}`).join(" · ")}
                </p>
              ) : null}
              <div className="flex flex-col justify-between gap-2 border-t border-[var(--border-hairline)] pt-2 sm:flex-row sm:items-center">
                <input
                  className="min-w-0 flex-1 rounded border border-[var(--border-hairline)] bg-surface-container-lowest px-2 py-1 text-xs text-on-surface outline-none"
                  onChange={(e) => onNote(e.target.value)}
                  onClick={(e) => e.stopPropagation()}
                  placeholder="Reviewer note (optional, stored locally)"
                  value={note}
                />
                <div className="flex flex-wrap items-center gap-2">
                  {c.action !== "keep" ? (
                    <button
                      className="rounded bg-surface-container-highest/40 px-3 py-1 text-xs font-medium text-on-surface-variant hover:bg-on-surface/10"
                      onClick={(e) => {
                        e.stopPropagation();
                        void onReview(c.id, "keep");
                      }}
                      type="button"
                    >
                      Keep instead
                    </button>
                  ) : (
                    <button
                      className="rounded bg-surface-container-highest/40 px-3 py-1 text-xs font-medium text-on-surface-variant hover:bg-on-surface/10"
                      onClick={(e) => {
                        e.stopPropagation();
                        void onReview(c.id, "scale");
                      }}
                      type="button"
                    >
                      Override scale
                    </button>
                  )}
                  <button
                    className="rounded px-3 py-1 text-xs font-medium text-on-surface shadow-sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      void onReview(c.id, c.action);
                    }}
                    style={{ background: tone.hex }}
                    type="button"
                  >
                    {primary}
                  </button>
                </div>
              </div>
            </div>
          </td>
        </tr>
      ) : null}
    </>
  );
}

function AuditCell({
  label,
  value,
  valueClass,
}: {
  label: string;
  value: string;
  valueClass?: string;
}) {
  return (
    <div>
      <span className="text-outline">{label}:</span>
      <div className={cn("mt-0.5 text-on-surface", valueClass)}>{value}</div>
    </div>
  );
}
