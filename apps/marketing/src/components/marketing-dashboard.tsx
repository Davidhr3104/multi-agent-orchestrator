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
import type { AttributedLead, CampaignAction, SpendEvent, StoredCampaign } from "@helix/core";
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
  const [toast, setToast] = useState<{ msg: string; err?: boolean } | null>(null);
  const [dragOver, setDragOver] = useState(false);

  function showToast(msg: string, err = false) {
    setToast({ msg, err });
    window.setTimeout(() => setToast(null), 2800);
  }

  async function refresh(nextRange: Range = range) {
    const res = await fetch(`/api/campaigns?window=${nextRange}`);
    const data = (await res.json()) as {
      campaigns: StoredCampaign[];
      leads: AttributedLead[];
      unmatched: SpendEvent[];
      series: { day: string; spend: number }[];
      from: string;
      to: string;
    };
    setCampaigns(data.campaigns ?? []);
    setLeads(data.leads ?? []);
    setUnmatched(data.unmatched ?? []);
    setSeries(data.series ?? []);
    if (data.from && data.to) setBounds({ from: data.from, to: data.to });
  }

  useEffect(() => {
    void refresh(range);
    // range is the window key; refresh closes over it on purpose
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range]);

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
    const data = (await res.json()) as { campaign?: StoredCampaign; error?: string };
    if (!res.ok) {
      showToast(data.error || "Review failed", true);
      return;
    }
    if (data.campaign) {
      setCampaigns((prev) => prev.map((c) => (c.id === id ? data.campaign! : c)));
      setNote("");
      showToast("Decision confirmed in the local buffer. Meta and Google were not written.");
    }
  }

  function exportCsv() {
    const header = "campaign_id,name,platform,spend,impressions,clicks,form_leads,avg_score,cost_per_hot,action,needs_review";
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
    <main className="w-full bg-transparent pb-12">
      <div className="mx-auto max-w-[1680px] px-6 pt-6 lg:px-8">
        <div className="mb-6 flex flex-col items-start justify-between gap-3 border-b border-white/[0.08] pb-4 sm:flex-row sm:items-center">
          <div className="flex items-center gap-2 text-xs text-[#9CA3AF]">
            <Info className="size-[18px] shrink-0 text-[#6B7280]" />
            <span>
              Join campaign spend to scored leads. REC synthesizes{" "}
              <span className="inline-flex items-center gap-1">
                <span className="size-1.5 rounded-full bg-[#D9605F]" />
                pause
              </span>{" "}
              /{" "}
              <span className="inline-flex items-center gap-1">
                <span className="size-1.5 rounded-full bg-[#3BAF7E]" />
                scale
              </span>{" "}
              /{" "}
              <span className="inline-flex items-center gap-1">
                <span className="size-1.5 rounded-full bg-[#D9A441]" />
                keep
              </span>
              . A human confirms locally — Meta and Google stay disconnected this sprint.
            </span>
          </div>
          <button
            className="flex items-center gap-1.5 self-end rounded-lg border border-white/[0.12] bg-[#10131a]/85 px-3 py-1.5 text-xs font-medium text-white shadow-sm backdrop-blur-md hover:bg-[#181d28] sm:self-auto"
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
            <RefreshCw className="size-[15px] text-[#9CA3AF]" />
            Recalculate
          </button>
        </div>
        {unmatchedIds > 0 ? (
          <a
            className="mb-6 flex items-center justify-between gap-3 rounded-xl border border-[#F97316]/30 bg-[#F97316]/10 px-4 py-3 text-xs text-[#FDBA74] hover:border-[#F97316]/60"
            href="/unmatched"
          >
            <span>
              {unmatchedIds} campaign_id{unmatchedIds === 1 ? "" : "s"} in this window have spend and no scored
              leads. Helix will not invent a quality score.
            </span>
            <span className="shrink-0 font-medium text-[#F97316]">Join queue →</span>
          </a>
        ) : null}

        <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <KpiCard
            icon={<Wallet className="size-4 text-[#6B7280]" />}
            label="Total Spend"
            badge="Mix"
            value={money(metrics.spend)}
            left={`${campaigns.length} active ads`}
            right="Seed + ingested CSV"
            chart={
              <svg className="h-7 w-20" fill="none" viewBox="0 0 70 24">
                <path d={spendSpark.line} stroke="#F97316" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.75" />
                <path d={spendSpark.area} fill="#F97316" fillOpacity="0.12" />
              </svg>
            }
          />
          <KpiCard
            icon={<ScatterChart className="size-4 text-[#6B7280]" />}
            label="Avg Quality Score"
            badge="Index 0–100"
            value={
              <>
                {metrics.avg}
                <span className="font-sans text-xs font-normal text-[#6B7280]">/100</span>
              </>
            }
            left="Unweighted avg"
            right={`Median ${Math.round(metrics.medianScore)}`}
            chart={
              <div className="flex w-20 flex-col gap-1">
                <div className="h-1.5 w-full overflow-hidden rounded-full border border-white/[0.08] bg-[#08090d]">
                  <div className="h-full rounded-full bg-[#F97316]" style={{ width: `${metrics.avg}%` }} />
                </div>
                <span className="text-right text-[10px] text-[#6B7280]">Median {Math.round(metrics.medianScore)}</span>
              </div>
            }
          />
          <KpiCard
            icon={<Flame className="size-4 text-[#6B7280]" />}
            label="Cost / Hot Lead"
            badge={metrics.costPerHot != null && metrics.costPerHot < 80 ? "Efficient" : "Watch"}
            value={
              <>
                {metrics.costPerHot == null ? "—" : money(Math.round(metrics.costPerHot))}
                {metrics.costPerHot != null ? <span className="text-xs font-normal text-[#6B7280]">.00</span> : null}
              </>
            }
            left={
              metrics.costPerHot == null
                ? "No hot-lead cost yet"
                : `${metrics.costPerHot < 80 ? "↓" : "↑"} vs $80 scale rule`
            }
            right="Mean w/ hot leads"
            leftClass={metrics.costPerHot != null && metrics.costPerHot < 80 ? "text-[#9CA3AF]" : "text-[#6B7280]"}
            chart={
              <svg className="h-7 w-20" fill="none" viewBox="0 0 70 24">
                <path d={costSpark.line} stroke="#3BAF7E" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.75" />
                <path d={costSpark.area} fill="#3BAF7E" fillOpacity="0.12" />
              </svg>
            }
          />
          <KpiCard
            icon={<Gavel className="size-4 text-[#6B7280]" />}
            label="HITL Queue"
            badge={metrics.review > 0 ? "Action needed" : "Clear"}
            badgeClass={metrics.review > 0 ? "bg-[rgba(217,164,65,0.12)] text-[#FBBF24]" : undefined}
            value={
              <>
                {metrics.review}
                <span className="font-sans text-xs font-normal text-[#6B7280]">/{campaigns.length || 0} ads</span>
              </>
            }
            left="Needs human call"
            right={metrics.reviewNames}
            chart={
              <div className="flex w-20 flex-col gap-1">
                <div className="h-1.5 w-full overflow-hidden rounded-full border border-white/[0.08] bg-[#08090d]">
                  <div
                    className="h-full rounded-full bg-[#D9A441]"
                    style={{ width: `${campaigns.length === 0 ? 0 : (metrics.review / campaigns.length) * 100}%` }}
                  />
                </div>
                <span className="text-right text-[10px] text-[#FBBF24]">
                  {campaigns.length === 0 ? "0" : Math.round((metrics.review / campaigns.length) * 100)}% in queue
                </span>
              </div>
            }
          />
        </div>

        <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-10">
          <div className="flex flex-col gap-5 lg:col-span-7">
            <section className="rounded-xl border border-white/[0.08] bg-[#10131a]/85 p-5 shadow-lg backdrop-blur-sm">
              <div className="mb-3 flex flex-col items-start justify-between gap-2 border-b border-white/[0.08] pb-3 sm:flex-row sm:items-center">
                <div>
                  <div className="flex items-center gap-2">
                    <ScatterChart className="size-[18px] text-[#9CA3AF]" />
                    <h2 className="text-sm font-semibold text-white">Spend vs Lead Quality (LIVE Correlation)</h2>
                    <span className="rounded-full bg-white/[0.06] px-2 py-0.5 text-xs font-medium text-[#9CA3AF]">
                      Live signal
                    </span>
                  </div>
                  <p className="mt-0.5 text-xs text-[#6B7280]">
                    Correlation between budget deployment and heuristic score
                    {bounds ? ` · ${bounds.from} → ${bounds.to}` : ""}. Bubble radius = form volume.
                  </p>
                </div>
                <div className="flex items-center gap-1 rounded-lg border border-white/[0.06] bg-[#08090d] p-1">
                  {(["7d", "30d", "90d"] as Range[]).map((id) => (
                    <button
                      key={id}
                      className={cn(
                        "rounded px-2.5 py-0.5 text-xs font-medium",
                        range === id ? "bg-white/[0.12] text-white" : "text-[#9CA3AF] hover:text-white"
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
              <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-white/[0.08] pt-3 text-xs">
                <div className="flex items-center gap-4">
                  <LegendDot color="#3BAF7E" label="Scale (>70)" />
                  <LegendDot color="#D9A441" label="Keep · HITL (35–70)" />
                  <LegendDot color="#D9605F" label="Pause (<35)" />
                </div>
                <div className="text-[#6B7280]">Bubble radius = form lead volume</div>
              </div>
            </section>

            <section className="overflow-hidden rounded-xl border border-white/[0.08] bg-[#10131a]/85 shadow-lg backdrop-blur-sm">
              <div className="flex flex-col items-start justify-between gap-3 border-b border-white/[0.08] p-4 sm:flex-row sm:items-center">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-semibold text-white">Campaigns</h3>
                  <span className="rounded-full bg-white/[0.06] px-2 py-0.5 text-xs font-medium text-[#9CA3AF]">
                    {campaigns.length} synced
                  </span>
                </div>
                <div className="flex items-center justify-between gap-3 self-stretch sm:self-auto">
                  <label className="flex cursor-pointer items-center gap-2 text-xs text-[#9CA3AF] select-none">
                    <input
                      checked={hideEmpty}
                      className="rounded border-white/15 bg-[#08090d] text-[#3BAF7E] focus:ring-0"
                      onChange={(e) => {
                        setHideEmpty(e.target.checked);
                        showToast(e.target.checked ? "Hiding empty $/hot cells" : "Showing all metrics");
                      }}
                      type="checkbox"
                    />
                    Hide empty columns
                  </label>
                  <button
                    className="flex items-center gap-1 rounded border border-white/10 bg-[#171F2C] px-2.5 py-1 text-xs font-medium text-white hover:bg-[#1E2838]"
                    onClick={exportCsv}
                    type="button"
                  >
                    <Download className="size-3.5 text-[#9CA3AF]" />
                    Export
                  </button>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-1.5 border-b border-white/[0.08] bg-[#08090d]/70 px-4 py-2">
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
                      filter === id ? "bg-white/10 text-white" : "text-[#6B7280] hover:text-white"
                    )}
                    onClick={() => setFilter(id)}
                    type="button"
                  >
                    {label}
                    {id === "pause" ? <span className="ml-1 text-[#D9605F]">{counts.pause}</span> : null}
                    {id === "scale" ? <span className="ml-1 text-[#3BAF7E]">{counts.scale}</span> : null}
                    {id === "keep" ? <span className="ml-1 text-[#D9A441]">{counts.keep}</span> : null}
                  </button>
                ))}
              </div>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-left">
                  <thead className="border-b border-white/[0.06] bg-[#08090d] text-[11px] font-medium tracking-wider text-[#9CA3AF] uppercase">
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
                  <p className="px-4 py-8 text-sm text-[#6B7280]">No campaigns in this filter.</p>
                ) : null}
              </div>
              <div className="flex flex-col items-center justify-between gap-2 border-t border-white/[0.08] bg-[#08090d] px-4 py-2.5 text-xs text-[#6B7280] sm:flex-row">
                <div>Deterministic heuristic · score ≥ 70 and cheap hot leads → scale, ≤ 35 or spam-heavy → pause</div>
                <div>
                  Page 1 of 1 · {visible.length} records
                </div>
              </div>
            </section>
          </div>

          <aside className="flex flex-col overflow-hidden rounded-xl border border-white/[0.08] bg-[#10131a]/85 shadow-lg backdrop-blur-sm lg:col-span-3">
            <div className="border-b border-white/[0.08] p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Upload className="size-[18px] text-[#9CA3AF]" />
                  <h3 className="text-sm font-semibold text-white">Ingest spend CSV</h3>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="rounded-full bg-white/[0.06] px-2 py-0.5 text-xs font-medium text-[#9CA3AF]">
                    Secondary
                  </span>
                  <button
                    className="rounded p-0.5 text-[#6B7280] hover:text-white"
                    onClick={() => setIngestOpen((v) => !v)}
                    title="Toggle panel"
                    type="button"
                  >
                    <ChevronRight className={cn("size-[18px] transition-transform", ingestOpen ? "rotate-90" : "")} />
                  </button>
                </div>
              </div>
              <p className="mt-1 text-xs text-[#6B7280]">Meta/Google not connected this sprint (CSV ingest only)</p>
              <div className="mt-3 flex items-center justify-between gap-1.5 rounded-lg border border-white/[0.06] bg-[#08090d] p-2">
                <code className="truncate font-mono text-xs text-[#9CA3AF]">
                  <span className="font-semibold text-[#F97316]">POST</span> /api/campaigns/ingest
                </code>
                <button
                  className="p-1 text-[#6B7280] hover:text-white"
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
                <div className="border-b border-white/[0.08] bg-[#08090d] p-3">
                  <div className="mb-1.5 flex items-center justify-between border-b border-white/[0.06] pb-1.5 text-xs text-[#6B7280]">
                    <span className="flex items-center gap-1.5">
                      <span className="size-2 rounded-full bg-white/20" />
                      <span className="size-2 rounded-full bg-white/20" />
                      <span className="size-2 rounded-full bg-white/20" />
                      <span className="ml-1 font-mono text-[11px] text-[#9CA3AF]">campaigns_schema.csv</span>
                    </span>
                    <span className="font-mono text-[10px]">UTF-8</span>
                  </div>
                  <textarea
                    className="h-28 w-full resize-none bg-transparent font-mono text-xs leading-relaxed text-[#9CA3AF] outline-none focus:text-white"
                    onChange={(e) => setCsv(e.target.value)}
                    spellCheck={false}
                    value={csv}
                  />
                </div>
                <div className="space-y-3 p-4">
                  <label
                    className={cn(
                      "group flex cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-white/15 bg-[#08090d]/80 p-4 transition-colors hover:border-[#F97316]",
                      dragOver && "border-[#F97316]"
                    )}
                    onDragLeave={() => setDragOver(false)}
                    onDragOver={(e) => {
                      e.preventDefault();
                      setDragOver(true);
                    }}
                    onDrop={onDrop}
                  >
                    <FileUp className="size-[22px] text-[#6B7280] transition-colors group-hover:text-[#F97316]" />
                    <span className="mt-1.5 text-xs font-medium text-[#9CA3AF] group-hover:text-white">
                      Drop CSV or browse
                    </span>
                    <span className="text-[10px] text-[#6B7280]">UTF-8 comma-delimited</span>
                    <input accept=".csv,text/csv" className="hidden" onChange={onPick} type="file" />
                  </label>
                  <div className="flex items-center justify-between rounded-lg border border-white/[0.06] bg-[#08090d] px-3 py-1.5 text-xs">
                    <div className="flex items-center gap-1.5">
                      <span className="size-1.5 rounded-full bg-[#3BAF7E]" />
                      <span className="text-[#9CA3AF]">{error ?? "Ready to process"}</span>
                    </div>
                    <span className="font-mono text-[#6B7280]">{csvLineCount(csv)} records</span>
                  </div>
                  {error ? <p className="text-xs text-[#FB7185]">{error}</p> : null}
                  <button
                    className="flex h-10 w-full cursor-pointer items-center justify-center gap-2 rounded-lg bg-[#F97316] text-xs font-semibold text-[#08090d] shadow-[0_4px_14px_rgba(249,115,22,0.35)] transition-all hover:bg-[#EA580C] active:scale-[0.99] disabled:opacity-60"
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
          "fixed right-6 bottom-6 z-50 flex items-center gap-2 rounded-lg border border-white/[0.18] bg-[#161a24] px-4 py-2.5 text-xs text-white shadow-2xl transition-all duration-200",
          toast ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-3 opacity-0"
        )}
      >
        {toast?.err ? (
          <AlertTriangle className="size-[18px] text-[#D9605F]" />
        ) : (
          <CheckCircle2 className="size-[18px] text-[#3BAF7E]" />
        )}
        <span>{toast?.msg ?? "Ready"}</span>
      </div>
    </main>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="size-2.5 rounded-full" style={{ background: color }} />
      <span className="text-xs text-[#9CA3AF]">{label}</span>
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
    <div className="flex flex-col justify-between rounded-xl border border-white/[0.08] bg-[#10131a]/85 p-4 shadow-lg backdrop-blur-sm transition-colors hover:bg-[#151a24]/90">
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-xs text-[#9CA3AF]">
          {icon}
          <span>{label}</span>
        </div>
        <span className={cn("rounded-full bg-white/[0.06] px-2 py-0.5 text-xs font-medium text-[#9CA3AF]", badgeClass)}>
          {badge}
        </span>
      </div>
      <div className="mt-1 flex items-baseline justify-between">
        <div className="font-mono text-2xl font-semibold tracking-tight text-white">{value}</div>
        {chart}
      </div>
      <div className="mt-3 flex items-center justify-between border-t border-white/[0.06] pt-2 text-xs text-[#6B7280]">
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
        className="cursor-pointer border-l-2 transition-colors hover:bg-[#151a24]/60"
        onClick={onToggle}
        style={{ borderLeftColor: tone.hex }}
      >
        <td className="px-4 py-3">
          <div className="flex items-center gap-2.5">
            <div className="flex size-7 items-center justify-center rounded bg-[#161E2C] font-mono text-xs font-medium text-[#9CA3AF]">
              #{letterIndex(index)}
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <a
                  className="font-medium text-white hover:text-[#F97316]"
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
                        : "bg-white/[0.08] text-[#9CA3AF]"
                  )}
                >
                  {platformLabel(c.platform)}
                </span>
              </div>
              <span className="text-xs text-[#6B7280]">
                {compactCount(c.impressions)} impr · {compactCount(c.clicks)} clk
              </span>
            </div>
          </div>
        </td>
        <td className="px-4 py-3 text-right font-mono font-medium text-white">{money(c.spend)}</td>
        <td className="px-4 py-3 text-right font-mono text-white">{c.metrics.formLeads}</td>
        <td className="px-4 py-3 text-center">
          <span className={cn("rounded-full px-2 py-0.5 font-mono font-medium", tone.bg, tone.text)}>
            {c.metrics.avgScore.toFixed(2)}
          </span>
        </td>
        {hideHot ? null : (
          <td className="px-4 py-3 text-right font-mono font-medium">
            {c.metrics.costPerHot == null ? (
              <span className="cursor-help border-b border-dotted border-white/20 text-[#6B7280]" title="no hot leads yet">
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
            className="inline-flex items-center gap-1 font-medium text-[#9CA3AF] hover:text-white"
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
        <tr className="border-b border-white/[0.08] bg-[#08090d]/90">
          <td className="p-4" colSpan={hideHot ? 6 : 7}>
            <div className="rounded-lg border border-white/[0.08] bg-[#161a24] p-3 text-xs shadow-inner">
              <div className="mb-2 flex items-center justify-between border-b border-white/[0.08] pb-2">
                <div className="flex items-center gap-2">
                  <Icon className="size-4" style={{ color: tone.hex }} />
                  <span className="font-medium text-white">
                    Audit Breakdown · Heuristic REC: {recLabel(c)}
                  </span>
                </div>
                <span className="font-mono text-xs text-[#6B7280]">
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
                  valueClass={c.metrics.nHot === 0 ? "text-[#FB7185] font-medium" : undefined}
                />
                <AuditCell
                  label="Local budget"
                  value={`${money(c.spend)} in this desk — Ads Manager is not written`}
                />
              </div>
              <p className="mb-3 text-[#9CA3AF]">{c.reasoning}</p>
              <a
                className="mb-3 inline-block text-xs text-[#F97316]"
                href={`/campaigns/${c.campaignId}`}
                onClick={(e) => e.stopPropagation()}
              >
                Open campaign evidence →
              </a>
              {related.length > 0 ? (
                <p className="mb-3 text-[#6B7280]">
                  Sample: {related.slice(0, 4).map((l) => `${l.name} ${l.score}`).join(" · ")}
                </p>
              ) : null}
              <div className="flex flex-col justify-between gap-2 border-t border-white/[0.08] pt-2 sm:flex-row sm:items-center">
                <input
                  className="min-w-0 flex-1 rounded border border-white/10 bg-[#08090d] px-2 py-1 text-xs text-white outline-none"
                  onChange={(e) => onNote(e.target.value)}
                  onClick={(e) => e.stopPropagation()}
                  placeholder="Reviewer note (optional, stored locally)"
                  value={note}
                />
                <div className="flex flex-wrap items-center gap-2">
                  {c.action !== "keep" ? (
                    <button
                      className="rounded bg-white/[0.06] px-3 py-1 text-xs font-medium text-[#9CA3AF] hover:bg-white/10"
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
                      className="rounded bg-white/[0.06] px-3 py-1 text-xs font-medium text-[#9CA3AF] hover:bg-white/10"
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
                    className="rounded px-3 py-1 text-xs font-medium text-white shadow-sm"
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
      <span className="text-[#6B7280]">{label}:</span>
      <div className={cn("mt-0.5 text-white", valueClass)}>{value}</div>
    </div>
  );
}
