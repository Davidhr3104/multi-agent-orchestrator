"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { PartnerVerdict, PipelineLog, RfpStreamEvent, StoredRfp } from "@helix/core";
import { AskAiCard } from "@/components/ask-ai-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import {
  DEFAULT_STRUCTURED,
  JURISDICTIONS,
  PRACTICE_OPTIONS,
  parseProfile,
  serializeProfile,
  type StructuredProfile,
} from "@/lib/client-profile";
import { formatUsdAmount, formatUsdNumber } from "@/lib/money";
import {
  alertCadence,
  assignTeam,
  battleCard,
  complianceGaps,
  countdownLabel,
  diffBodies,
  downloadIcs,
  downloadProposalDoc,
  draftProposal,
  extractDeadlines,
  goNoGo,
  googleCalendarUrl,
  ingestProgress,
  nearestDeadline,
  nextDeadline,
  similarRfp,
  winAnalytics,
  winProbability,
} from "@/lib/rfp-intel";
import {
  last7Buckets,
  previous7Count,
  sparkGold,
  weekDeltaLabel,
} from "@/lib/sparkline";
import { cn } from "@/lib/utils";
import type { ConflictReport } from "@/lib/conflict-types";
import { ConflictPanel } from "@/components/conflict-panel";
import { PricingPanel } from "@/components/pricing-panel";
import { InfoTooltip } from "@/components/ui/info-tooltip";
import type { PricingQuote } from "@/lib/pricing-types";
import { type LegalNavId } from "@/components/legal-chrome";
import { LEGAL_HELP } from "@helix/help";
import {
  Database,
  Download,
} from "lucide-react";

type Filter = "all" | "hot" | "warm" | "cold" | "review" | "BEAR" | "SPI" | "other";

type SheetTab =
  | "overview"
  | "deadlines"
  | "compliance"
  | "compete"
  | "proposal"
  | "compare"
  | "team"
  | "comms"
  | "conflicts"
  | "pricing";

function coiChipClass(verdict: ConflictReport["verdict"]) {
  if (verdict === "NO-GO") return "bg-[#7F1D1D] text-[#FCA5A5]";
  if (verdict === "CONDITIONAL") return "border border-[#F59E0B] text-[#F59E0B]";
  return "bg-[#064E3B] text-[#6EE7B7]";
}

function tierClass(tier: StoredRfp["tier"]) {
  if (tier === "hot") return "bg-emerald-500/15 text-emerald-300 ring-emerald-500/30";
  if (tier === "warm") return "bg-amber-500/15 text-amber-200 ring-amber-500/30";
  return "bg-rose-500/15 text-rose-300 ring-rose-500/30";
}

function daysUntil(deadline: string, now: number) {
  const t = Date.parse(deadline);
  if (Number.isNaN(t)) return null;
  return (t - now) / 86_400_000;
}

function MiniBar({ value, className }: { value: number; className?: string; wide?: boolean }) {
  const pct = Math.max(0, Math.min(100, value));
  return (
    <div className="h-[3px] w-10 shrink-0 bg-[#1F2937]">
      <div className={cn("bar-animate h-full", className)} style={{ width: `${pct}%` }} />
    </div>
  );
}

function methodClass(method: StoredRfp["method"]) {
  if (method === "BEAR") return "bg-[#1E3A8A] text-[#93C5FD]";
  if (method === "SPI") return "bg-[#4C1D95] text-[#C4B5FD]";
  return "bg-[#1F2937] text-[#9CA3AF]";
}

function matchBarClass(tier: StoredRfp["tier"]) {
  if (tier === "hot") return "bg-[#10B981]";
  if (tier === "warm") return "bg-[#F59E0B]";
  return "bg-[#EF4444]";
}

function matchTextClass(tier: StoredRfp["tier"]) {
  if (tier === "hot") return "text-[#10B981]";
  if (tier === "warm") return "text-[#F59E0B]";
  return "text-[#EF4444]";
}

export function LegalDashboard() {
  const [rfps, setRfps] = useState<StoredRfp[]>([]);
  const [nowMs, setNowMs] = useState<number | null>(null);
  const [mounted, setMounted] = useState(false);
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<StoredRfp | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [running, setRunning] = useState(false);
  const [logs, setLogs] = useState<PipelineLog[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ title: "", issuer: "", body: "" });
  const [structured, setStructured] = useState<StructuredProfile>(DEFAULT_STRUCTURED);
  const [profileSaved, setProfileSaved] = useState(false);
  const [pdfBusy, setPdfBusy] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [pdfPreview, setPdfPreview] = useState<{ name: string; text: string } | null>(null);
  const [pdfProgress, setPdfProgress] = useState(0);
  const [sheetTab, setSheetTab] = useState<SheetTab>("overview");
  const [conflicts, setConflicts] = useState<Record<string, ConflictReport>>({});
  const [pricing, setPricing] = useState<Record<string, PricingQuote>>({});
  const [nav, setNav] = useState<LegalNavId>("dashboard");
  const searchRef = useRef<HTMLInputElement>(null);
  const searchParams = useSearchParams();
  const router = useRouter();

  async function refresh() {
    const res = await fetch("/api/rfps");
    const data = (await res.json()) as {
      rfps: StoredRfp[];
      clientProfile?: string;
      conflicts?: Record<string, ConflictReport>;
      pricing?: Record<string, PricingQuote>;
    };
    setRfps(data.rfps);
    if (data.conflicts) setConflicts(data.conflicts);
    if (data.pricing) setPricing(data.pricing);
    if (data.clientProfile) setStructured(parseProfile(data.clientProfile));
  }

  useEffect(() => {
    setMounted(true);
    void refresh();
  }, []);

  useEffect(() => {
    if (!mounted || rfps.length === 0) return;
    const openId = searchParams.get("open");
    if (!openId) return;
    const rfp = rfps.find((r) => r.id === openId);
    if (!rfp) return;
    const tab = searchParams.get("tab") as SheetTab | null;
    const nextTab =
      tab &&
      ["overview", "deadlines", "compliance", "compete", "proposal", "compare", "team", "comms", "conflicts", "pricing"].includes(
        tab
      )
        ? tab
        : "overview";
    openRfp(rfp, nextTab);
    router.replace("/", { scroll: false });
  }, [mounted, rfps, searchParams, router]);

  function openRfp(rfp: StoredRfp, tab: SheetTab = "overview") {
    setSheetTab(tab);
    setSelected(rfp);
    setSheetOpen(true);
  }

  function closeRfp() {
    setSheetOpen(false);
    setSelected(null);
  }

  useEffect(() => {
    setNowMs(Date.now());
    const timer = window.setInterval(() => setNowMs(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    const id = window.location.hash.replace("#", "");
    if (!id) return;
    window.setTimeout(() => document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
  }, [mounted]);

  const now = nowMs ?? Date.now();

  const metrics = useMemo(() => {
    const avgMatch =
      rfps.length === 0 ? 0 : Math.round(rfps.reduce((s, r) => s + r.matchScore, 0) / rfps.length);
    const hotShare =
      rfps.length === 0 ? 0 : Math.round((rfps.filter((r) => r.tier === "hot").length / rfps.length) * 100);
    const close = rfps.filter((r) => {
      const d = daysUntil(r.deadline, now);
      return d != null && d >= 0 && d <= 14;
    }).length;
    const review = rfps.filter((r) => r.needsReview).length;
    const hot = rfps.filter((r) => r.tier === "hot").length;
    const warm = rfps.filter((r) => r.tier === "warm").length;
    const cold = rfps.filter((r) => r.tier === "cold").length;
    const spark = last7Buckets(rfps, now, (r) => r.tier === "hot");
    const thisHot = spark.reduce((a, b) => a + b, 0);
    const lastHot = previous7Count(rfps, now, (r) => r.tier === "hot");
    return {
      avgMatch,
      hotShare,
      close,
      review,
      hot,
      warm,
      cold,
      spark,
      delta: weekDeltaLabel(thisHot, lastHot),
      nextDue: nextDeadline(rfps, now),
    };
  }, [rfps, now]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rfps.filter((rfp) => {
      if (filter === "review" && !rfp.needsReview) return false;
      if (filter === "hot" || filter === "warm" || filter === "cold") {
        if (rfp.tier !== filter) return false;
      }
      if (filter === "BEAR" || filter === "SPI" || filter === "other") {
        if (rfp.method !== filter) return false;
      }
      if (!q) return true;
      return [rfp.title, rfp.issuer, rfp.method, rfp.amount, rfp.deadline].join(" ").toLowerCase().includes(q);
    });
  }, [rfps, filter, query]);

  const winLoss = useMemo(() => {
    const byMethod = ["BEAR", "SPI", "other"] as const;
    return byMethod.map((method) => {
      const rows = rfps.filter((r) => r.method === method);
      const wins = rows.filter((r) => r.tier === "hot").length;
      const n = rows.length;
      return { method, rate: n === 0 ? 0 : Math.round((wins / n) * 100), n };
    });
  }, [rfps]);

  async function runIngest(payload: { title: string; issuer: string; body: string }) {
    if (!payload.title.trim() || !payload.body.trim()) {
      setError("Title and RFP body are required");
      return;
    }
    setRunning(true);
    setError(null);
    setLogs([]);
    try {
      const res = await fetch("/api/rfps/ingest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...payload, client_profile: serializeProfile(structured) }),
      });
      if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const chunks = buffer.split("\n\n");
        buffer = chunks.pop() ?? "";
        for (const chunk of chunks) {
          const line = chunk
            .split("\n")
            .filter((l) => l.startsWith("data:"))
            .map((l) => l.slice(5).trim())
            .join("");
          if (!line) continue;
          const event = JSON.parse(line) as RfpStreamEvent;
          if (event.type === "log") setLogs((prev) => [...prev, event.log]);
          if (event.type === "result") {
            setRfps((prev) => [event.rfp, ...prev.filter((r) => r.id !== event.rfp.id)]);
            openRfp(event.rfp, "conflicts");
          }
          if (event.type === "error") setError(event.message);
        }
      }
      setForm({ title: "", issuer: "", body: "" });
      setPdfPreview(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setRunning(false);
      void refresh();
    }
  }

  async function ingest(e: FormEvent) {
    e.preventDefault();
    await runIngest(form);
  }

  async function saveProfile(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const res = await fetch("/api/settings/profile", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ client_profile: serializeProfile(structured) }),
    });
    const data = (await res.json()) as { clientProfile?: string; error?: string };
    if (!res.ok) {
      setError(data.error || "Could not save profile");
      return;
    }
    if (data.clientProfile) setStructured(parseProfile(data.clientProfile));
    setProfileSaved(true);
    window.setTimeout(() => setProfileSaved(false), 2000);
  }

  async function ingestFile(file: File) {
    setPdfBusy(true);
    setPdfProgress(18);
    setError(null);
    const tick = window.setInterval(() => {
      setPdfProgress((p) => Math.min(88, p + 9));
    }, 180);
    try {
      const payload = new FormData();
      payload.set("file", file);
      const res = await fetch("/api/rfps/extract", { method: "POST", body: payload });
      const data = (await res.json()) as {
        title?: string;
        issuer?: string;
        body?: string;
        preview?: string;
        error?: string;
      };
      if (!res.ok) throw new Error(data.error || `Extract ${res.status}`);
      const next = {
        title: data.title?.trim() || file.name.replace(/\.(pdf|docx|txt)$/i, ""),
        issuer: data.issuer?.trim() || "",
        body: data.body || "",
      };
      setForm(next);
      setPdfPreview({ name: file.name, text: data.preview || next.body.slice(0, 1400) });
      setPdfProgress(100);
      // Drop → extract → score in one motion (edit fields first if you cancel mid-flight).
      await runIngest(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setPdfProgress(0);
    } finally {
      window.clearInterval(tick);
      setPdfBusy(false);
    }
  }

  async function askCorpus(id: string) {
    const res = await fetch(`/api/rfps/${id}/corpus`, { method: "POST" });
    const data = (await res.json()) as { rfp?: StoredRfp; note?: string; error?: string };
    if (data.error) {
      setError(data.error);
      return;
    }
    if (data.rfp) {
      setRfps((prev) => prev.map((r) => (r.id === id ? data.rfp! : r)));
      setSelected(data.rfp);
    }
  }

  async function clearReview(
    id: string,
    payload: { verdict: PartnerVerdict; coiCleared: boolean; bidAmount: string; notes: string }
  ) {
    const res = await fetch(`/api/rfps/${id}/review`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = (await res.json()) as { rfp?: StoredRfp; error?: string };
    if (data.rfp) {
      setRfps((prev) => prev.map((r) => (r.id === id ? data.rfp! : r)));
      setSelected(data.rfp);
    }
  }

  function exportRfp(rfp: StoredRfp) {
    const blob = new Blob([JSON.stringify(rfp, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${rfp.id}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  function exportCsv() {
    const header = "Title,Issuer,Method,Amount,Match,Confidence,Deadline";
    const rows = visible.map((r) =>
      [r.title, r.issuer, r.method, formatUsdAmount(r.amount), r.matchScore, Math.round(r.confidence * 100), r.deadline]
        .map((cell) => `"${String(cell).replaceAll('"', '""')}"`)
        .join(",")
    );
    const blob = new Blob([[header, ...rows].join("\n")], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "helix-legal-opportunities.csv";
    a.click();
    URL.revokeObjectURL(a.href);
  }

  function goNav(id: LegalNavId) {
    setNav(id);
    if (id === "deadlines") setFilter("all");
    if (id === "opportunities") setFilter("all");
    window.requestAnimationFrame(() => {
      document.getElementById(`legal-${id}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  function downloadProposal(rfp: StoredRfp) {
    const coi = conflicts[rfp.id];
    const quote = pricing[rfp.id];
    downloadProposalDoc(rfp, serializeProfile(structured), similarRfp(rfp, rfps), {
      bidTarget: quote ? formatUsdNumber(quote.target) : undefined,
      coiVerdict: coi?.verdict,
      coiWhy: coi?.why,
    });
    void fetch("/api/audit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        actor: "ops",
        action: "proposal",
        detail: `Proposal pack downloaded for ${rfp.title}`,
      }),
    }).catch(() => undefined);
  }

  if (!mounted) {
    return <div className="helix-grid min-h-full" />;
  }

  const filters: { id: Filter; label: string }[] = [
    { id: "all", label: "All" },
    { id: "hot", label: "Hot" },
    { id: "warm", label: "Warm" },
    { id: "cold", label: "Cold" },
    { id: "review", label: "Needs review" },
    { id: "BEAR", label: "BEAR" },
    { id: "SPI", label: "SPI" },
    { id: "other", label: "Other method" },
  ];

  const extractPct = ingestProgress(logs.length, running);
  const firstReview = rfps.find((r) => r.needsReview);
  const totalTier = Math.max(metrics.hot + metrics.warm + metrics.cold, 1);
  const goldSpark = sparkGold(metrics.spark, 240, 28);
  const bearWin = winLoss.find((w) => w.method === "BEAR")?.rate ?? 0;
  const modeledWin =
    rfps.length === 0 ? 0 : Math.round((rfps.filter((r) => r.tier === "hot").length / rfps.length) * 1000) / 10;
  const analytics = winAnalytics(rfps);

  return (
    <>
      <main className="mx-auto w-full max-w-[1720px] flex-1 space-y-4 p-5">
        <section
          id="legal-dashboard"
          data-tour="legal-metrics"
          className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4"
        >
          <div
            className="group animate-entrance stagger-1 relative overflow-hidden rounded-xl p-4 transition-all duration-300"
            style={{
              background:
                "linear-gradient(145deg, rgba(24, 29, 41, 0.75) 0%, rgba(13, 16, 23, 0.85) 100%)",
              backdropFilter: "blur(12px)",
              border: "1px solid rgba(226, 232, 240, 0.12)",
              boxShadow:
                "0 10px 30px -5px rgba(0, 0, 0, 0.6), inset 0 1px 0 0 rgba(255, 255, 255, 0.15)",
            }}
          >
            <div className="pointer-events-none absolute -top-12 -right-12 size-28 rounded-full bg-white/5 blur-2xl transition-colors group-hover:bg-white/10" />
            <div className="relative z-10 flex items-center justify-between">
              <span className="text-[10px] font-medium tracking-widest text-slate-400 uppercase">Hot Share</span>
              <span className="material-symbols-outlined text-[18px] text-slate-400 transition-colors group-hover:text-white">
                local_fire_department
              </span>
            </div>
            <div className="relative z-10 my-2 flex items-baseline gap-2">
              <span
                className="text-[28px] font-bold tracking-tight"
                style={{
                  background: "linear-gradient(180deg, #ffffff 0%, #cbd5e1 100%)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                }}
              >
                {metrics.hotShare}%
              </span>
              <span className="font-mono-numbers text-[10px] text-slate-400">{metrics.delta} vs last week</span>
            </div>
            <div className="relative z-10 mt-3 flex h-8 w-full items-end">
              <svg
                className="h-7 w-full overflow-visible"
                fill="none"
                viewBox={`0 0 ${goldSpark.width} ${goldSpark.height}`}
              >
                <path
                  className="sparkline-line"
                  d={goldSpark.line}
                  stroke="#e2e8f0"
                  strokeLinecap="square"
                  strokeLinejoin="miter"
                  strokeWidth="1.5"
                  fill="none"
                />
              </svg>
            </div>
          </div>

          <div
            className="group animate-entrance stagger-2 relative overflow-hidden rounded-xl p-4 transition-all duration-300"
            style={{
              background:
                "linear-gradient(145deg, rgba(24, 29, 41, 0.75) 0%, rgba(13, 16, 23, 0.85) 100%)",
              backdropFilter: "blur(12px)",
              border: "1px solid rgba(226, 232, 240, 0.12)",
              boxShadow:
                "0 10px 30px -5px rgba(0, 0, 0, 0.6), inset 0 1px 0 0 rgba(255, 255, 255, 0.15)",
            }}
          >
            <div className="pointer-events-none absolute -top-12 -right-12 size-28 rounded-full bg-white/5 blur-2xl transition-colors group-hover:bg-white/10" />
            <div className="relative z-10 flex items-center justify-between">
              <span className="text-[10px] font-medium tracking-widest text-slate-400 uppercase">Avg Match</span>
              <span className="material-symbols-outlined text-[18px] text-slate-400 transition-colors group-hover:text-white">
                auto_graph
              </span>
            </div>
            <div className="relative z-10 my-2 flex items-baseline gap-2">
              <span
                className="text-[28px] font-bold tracking-tight"
                style={{
                  background: "linear-gradient(180deg, #ffffff 0%, #cbd5e1 100%)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                }}
              >
                {metrics.avgMatch}
              </span>
              <span className="font-mono-numbers text-[10px] text-slate-400">/ 100 pt index</span>
            </div>
            <div className="relative z-10 space-y-1.5">
              <div className="flex items-center justify-between font-mono-numbers text-[10px]">
                <span className="font-medium text-slate-200">{metrics.hot} Hot ({Math.round((metrics.hot / totalTier) * 100)}%)</span>
                <span className="font-medium text-slate-400">{metrics.warm} Warm ({Math.round((metrics.warm / totalTier) * 100)}%)</span>
                <span className="text-slate-500">{metrics.cold} Cold ({Math.round((metrics.cold / totalTier) * 100)}%)</span>
              </div>
              <div
                className="flex h-1.5 gap-0.5 overflow-hidden rounded-full p-0.5"
                style={{ background: "rgba(15, 20, 30, 0.9)", border: "1px solid rgba(226, 232, 240, 0.08)" }}
              >
                <div
                  className="h-full rounded-full"
                  style={{ width: `${(metrics.hot / totalTier) * 100}%`, background: "linear-gradient(90deg, #e2e8f0, #ffffff)" }}
                />
                <div
                  className="h-full rounded-full"
                  style={{ width: `${(metrics.warm / totalTier) * 100}%`, background: "#64748b" }}
                />
                <div
                  className="h-full rounded-full"
                  style={{ width: `${(metrics.cold / totalTier) * 100}%`, background: "#334155" }}
                />
              </div>
            </div>
          </div>

          <div
            id="legal-deadlines"
            className="group animate-entrance stagger-3 relative overflow-hidden rounded-xl p-4 transition-all duration-300"
            style={{
              background:
                "linear-gradient(145deg, rgba(24, 29, 41, 0.75) 0%, rgba(13, 16, 23, 0.85) 100%)",
              backdropFilter: "blur(12px)",
              border: "1px solid rgba(226, 232, 240, 0.12)",
              boxShadow:
                "0 10px 30px -5px rgba(0, 0, 0, 0.6), inset 0 1px 0 0 rgba(255, 255, 255, 0.15)",
            }}
          >
            <div className="pointer-events-none absolute -top-12 -right-12 size-28 rounded-full bg-white/5 blur-2xl transition-colors group-hover:bg-white/10" />
            <div className="relative z-10 flex items-center justify-between">
              <span className="text-[10px] font-medium tracking-widest text-slate-400 uppercase">Due in 14D</span>
              <span className="material-symbols-outlined text-[18px] text-slate-400 transition-colors group-hover:text-white">
                schedule
              </span>
            </div>
            <div className="relative z-10 my-2 flex items-baseline gap-2">
              <span
                className="text-[28px] font-bold tracking-tight"
                style={{
                  background: "linear-gradient(180deg, #ffffff 0%, #cbd5e1 100%)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                }}
              >
                {metrics.close}
              </span>
              <span className="text-[11px] text-slate-300">RFP{metrics.close === 1 ? "" : "s"} expiring soon</span>
            </div>
            <div
              className="relative z-10 flex items-center gap-1.5 rounded font-mono-numbers text-[10px]"
              style={{ background: "rgba(226, 232, 240, 0.05)", border: "1px solid rgba(226, 232, 240, 0.1)", padding: "4px 10px" }}
            >
              <span className="material-symbols-outlined text-[14px] text-slate-300">calendar_today</span>
              <span className="text-slate-400">Next:</span>
              <span className="font-medium text-white">{metrics.nextDue?.date ?? "—"}</span>
            </div>
          </div>

          <div
            className="animate-entrance stagger-4 relative flex flex-col justify-between overflow-hidden rounded-xl p-4 transition-all duration-300"
            style={{
              background:
                metrics.review > 0
                  ? "linear-gradient(145deg, rgba(32, 24, 28, 0.75) 0%, rgba(18, 14, 18, 0.85) 100%)"
                  : "linear-gradient(145deg, rgba(24, 29, 41, 0.75) 0%, rgba(13, 16, 23, 0.85) 100%)",
              backdropFilter: "blur(12px)",
              border:
                metrics.review > 0 ? "1px solid rgba(248, 113, 113, 0.25)" : "1px solid rgba(226, 232, 240, 0.12)",
              boxShadow:
                "0 10px 30px -5px rgba(0, 0, 0, 0.6), inset 0 1px 0 0 rgba(255, 255, 255, 0.12)",
            }}
          >
            <div className="relative z-10 flex items-center justify-between">
              <span className="text-[10px] font-medium tracking-widest text-slate-400 uppercase">Review Queue</span>
              {metrics.review > 0 ? (
                <span
                  className="rounded px-2 py-0.5 text-[10px] font-bold tracking-widest uppercase"
                  style={{ background: "rgba(239, 68, 68, 0.18)", color: "#fca5a5", border: "1px solid rgba(239, 68, 68, 0.35)" }}
                >
                  Urgent
                </span>
              ) : null}
            </div>
            <div className="relative z-10 my-2 flex items-baseline gap-2">
              <span className="text-[28px] font-bold tracking-tight text-white">{metrics.review}</span>
              <span className="text-[11px] text-slate-300">
                item{metrics.review === 1 ? "" : "s"} awaiting partner sign-off
              </span>
            </div>
            <button
              type="button"
              disabled={!firstReview}
              className="relative z-10 flex items-center justify-center gap-1.5 rounded px-3 py-1.5 text-[11px] font-semibold transition-all disabled:cursor-not-allowed disabled:opacity-40"
              style={{
                background: "linear-gradient(180deg, #ffffff 0%, #cbd5e1 50%, #94a3b8 100%)",
                color: "#090b10",
                boxShadow: "0 2px 10px rgba(0,0,0,0.5), inset 0 1px 1px rgba(255,255,255,0.9)",
                border: "1px solid rgba(255,255,255,0.4)",
              }}
              onClick={() => {
                if (!firstReview) return;
                openRfp(firstReview, "overview");
              }}
            >
              <span>Review now</span>
              <span className="material-symbols-outlined text-[15px]">arrow_forward</span>
            </button>
          </div>
        </section>

        <AskAiCard rfpId={selected?.id} />

        <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-12">
          <div className="animate-entrance stagger-5 space-y-4 lg:col-span-8">
            <section
              id="legal-opportunities"
              data-tour="legal-opportunities"
              className="relative overflow-hidden rounded-xl p-4"
              style={{
                background:
                  "linear-gradient(145deg, rgba(24, 29, 41, 0.75) 0%, rgba(13, 16, 23, 0.85) 100%)",
                backdropFilter: "blur(12px)",
                border: "1px solid rgba(226, 232, 240, 0.12)",
                boxShadow:
                  "0 10px 30px -5px rgba(0, 0, 0, 0.6), inset 0 1px 0 0 rgba(255, 255, 255, 0.15)",
              }}
            >
              <div
                className="flex flex-col justify-between gap-3 pb-3 sm:flex-row sm:items-center"
                style={{ borderBottom: "1px solid rgba(226, 232, 240, 0.1)" }}
              >
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-[14px] font-semibold text-slate-100">Opportunities</h2>
                    <span
                      className="font-mono-numbers rounded-[3px] px-1.5 py-0.5 text-[10px] text-slate-300"
                      style={{ border: "1px solid rgba(226, 232, 240, 0.25)" }}
                    >
                      {rfps.length} total
                    </span>
                  </div>
                  <p className="mt-0.5 text-[11px] text-slate-400">Match bars, formatted amounts, hover actions.</p>
                </div>
                <div className="flex items-center gap-2 self-start sm:self-auto">
                  <button
                    type="button"
                    className="btn-tactile rounded-[4px] px-3 py-1.5 text-[11px] font-medium text-slate-300 transition-colors hover:text-white"
                    style={{ border: "1px solid rgba(226, 232, 240, 0.18)", background: "rgba(226, 232, 240, 0.06)" }}
                    onClick={exportCsv}
                  >
                    Export CSV
                  </button>
                  <button
                    type="button"
                    className="btn-tactile flex items-center gap-1 rounded-[4px] px-3 py-1.5 text-[11px] font-semibold transition-all"
                    style={{
                      background: "linear-gradient(180deg, #ffffff 0%, #cbd5e1 50%, #94a3b8 100%)",
                      color: "#090b10",
                      boxShadow: "0 2px 10px rgba(0,0,0,0.5), inset 0 1px 1px rgba(255,255,255,0.9)",
                      border: "1px solid rgba(255,255,255,0.4)",
                    }}
                    onClick={() => goNav("documents")}
                  >
                    <span className="material-symbols-outlined text-[14px]">add</span>
                    New Target
                  </button>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 pt-3 pb-2">
                {filters.map((f) => (
                  <span key={f.id} className="contents">
                    {f.id === "BEAR" ? <div className="mx-0.5 h-4 w-px" style={{ background: "rgba(226, 232, 240, 0.12)" }} /> : null}
                    <button
                      type="button"
                      className={cn(
                        "btn-tactile rounded-[4px] px-2.5 py-1 text-[11px] transition-colors",
                        filter === f.id ? "font-semibold" : "text-slate-400 hover:text-slate-100"
                      )}
                      style={
                        filter === f.id
                          ? {
                              background: "linear-gradient(180deg, #ffffff 0%, #cbd5e1 100%)",
                              color: "#0b0d12",
                            }
                          : { border: "1px solid rgba(226, 232, 240, 0.14)", background: "transparent" }
                      }
                      onClick={() => setFilter(f.id)}
                    >
                      {f.label}
                    </button>
                  </span>
                ))}
              </div>

              <div className="group relative my-2 h-[32px]">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-2.5 text-slate-400 transition-colors duration-150 group-focus-within:text-white">
                  <span className="material-symbols-outlined text-[16px]">search</span>
                </div>
                <input
                  ref={searchRef}
                  className="h-full w-full rounded-[4px] py-0 pr-3 pl-8 text-xs text-slate-100 placeholder-slate-500 transition-colors duration-150 focus:outline-none"
                  style={{ background: "rgba(9, 11, 16, 0.85)", border: "1px solid rgba(226, 232, 240, 0.14)" }}
                  placeholder="Filter title, issuer, method..."
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </div>

              <div className="mt-2 overflow-x-auto">
                <table className="w-full min-w-[760px] border-collapse text-left">
                  <thead>
                    <tr
                      className="text-[9px] font-semibold tracking-wider text-slate-400 uppercase"
                      style={{ borderBottom: "1px solid rgba(226, 232, 240, 0.1)", background: "rgba(9, 11, 16, 0.6)" }}
                    >
                      <th className="px-3 py-2">Title</th>
                      <th className="px-2 py-2">Issuer</th>
                      <th className="px-2 py-2">Method</th>
                      <th className="px-2 py-2">Amount</th>
                      <th className="px-2 py-2">Match</th>
                      <th className="px-2 py-2">Conf.</th>
                      <th className="py-2 pr-3 pl-2 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="text-xs">
                    {visible.map((rfp) => {
                      const gaps = complianceGaps(rfp);
                      const due = nearestDeadline(rfp, now);
                      const hotDue = due?.days != null && due.days >= 0 && due.days < 1;
                      const incumbents = battleCard(rfp).names;
                      const assign = assignTeam(rfp);
                      const coi = conflicts[rfp.id];
                      const quote = pricing[rfp.id];
                      const accentBar =
                        rfp.tier === "hot"
                          ? "bg-[#10B981]"
                          : rfp.tier === "warm"
                            ? "bg-[#F59E0B]"
                            : "bg-[#EF4444]";
                      return (
                        <tr
                          key={rfp.id}
                          className="table-row-interactive group relative cursor-pointer transition-colors hover:bg-white/[0.03]"
                          style={{ borderBottom: "1px solid rgba(226, 232, 240, 0.08)" }}
                          onClick={() => openRfp(rfp, "overview")}
                        >
                          <td className="relative max-w-[280px] min-w-0 px-3 py-2">
                            <div
                              className={cn(
                                "absolute top-0 bottom-0 left-0 w-[2px] transition-all duration-150 group-hover:w-[3px]",
                                accentBar
                              )}
                            />
                            <div
                              className="max-w-[280px] truncate text-[12px] font-semibold text-slate-100"
                              title={rfp.title}
                            >
                              {rfp.title}
                            </div>
                            <div className="mt-1.5 flex items-center gap-1.5 overflow-x-auto text-[9px] whitespace-nowrap">
                              <span
                                className={cn(
                                  "rounded-[3px] px-1.5 py-0.5 font-medium",
                                  hotDue
                                    ? "animate-pulse bg-[#7F1D1D] text-[#FCA5A5]"
                                    : "bg-[#422006] text-[#FCD34D]"
                                )}
                              >
                                {countdownLabel(due?.days ?? null)}
                              </span>
                              {gaps.length ? (
                                <span className="rounded-[3px] bg-[#7F1D1D] px-1.5 py-0.5 font-medium text-[#FCA5A5]">
                                  ⚠ {gaps.length} compliance gap{gaps.length === 1 ? "" : "s"}
                                </span>
                              ) : null}
                              {incumbents[0] ? (
                                <span className="rounded-[3px] bg-[#164E63] px-1.5 py-0.5 font-medium text-[#67E8F9]">
                                  Incumbent: {incumbents[0]}
                                </span>
                              ) : null}
                              {coi ? (
                                <button
                                  type="button"
                                  className={cn(
                                    "rounded-[3px] px-1.5 py-[2px] font-medium leading-none",
                                    coiChipClass(coi.verdict)
                                  )}
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    openRfp(rfp, "conflicts");
                                  }}
                                >
                                  COI {coi.verdict}
                                </button>
                              ) : null}
                              {quote ? (
                                <button
                                  type="button"
                                  className="font-mono-numbers rounded-[3px] px-1.5 py-[2px] leading-none text-slate-300"
                                  style={{ border: "1px solid rgba(226, 232, 240, 0.16)", background: "rgba(226, 232, 240, 0.06)" }}
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    openRfp(rfp, "pricing");
                                  }}
                                >
                                  Bid {formatUsdNumber(quote.target)}
                                </button>
                              ) : null}
                              <span
                                className="rounded-[3px] px-1.5 py-[2px] leading-none text-slate-400"
                                style={{ background: "rgba(226, 232, 240, 0.06)" }}
                              >
                                {assign.initials} · {assign.role}
                              </span>
                            </div>
                          </td>
                          <td className="min-w-[130px] truncate px-2 py-2 text-[12px] text-slate-400">
                            {rfp.issuer || "Unspecified"}
                          </td>
                          <td className="whitespace-nowrap px-2 py-2">
                            <span
                              className={cn(
                                "font-mono-numbers rounded-[3px] px-1.5 py-0.5 text-[9px] font-semibold",
                                methodClass(rfp.method)
                              )}
                            >
                              {rfp.method}
                            </span>
                          </td>
                          <td className="font-mono-numbers whitespace-nowrap px-2 py-2 text-[13px] font-semibold text-slate-100">
                            {formatUsdAmount(rfp.amount)}
                          </td>
                          <td className="whitespace-nowrap px-2 py-2">
                            <div className="flex items-center gap-1.5">
                              <MiniBar value={rfp.matchScore} className={matchBarClass(rfp.tier)} />
                              <span className={cn("font-mono-numbers text-[11px]", matchTextClass(rfp.tier))}>
                                {rfp.matchScore}
                              </span>
                            </div>
                          </td>
                          <td className="whitespace-nowrap px-2 py-2">
                            <div className="flex items-center gap-1.5">
                              <MiniBar value={rfp.confidence * 100} className="bg-[#F59E0B]" />
                              <span className="font-mono-numbers text-[11px] text-[#F59E0B]">
                                {Math.round(rfp.confidence * 100)}%
                              </span>
                            </div>
                          </td>
                          <td
                            className="whitespace-nowrap py-2 pr-3 pl-2 text-right"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <div className="flex items-center justify-end gap-1.5">
                              <div className="flex items-center gap-1 text-slate-400">
                                <button
                                  type="button"
                                  className="btn-tactile rounded-[4px] p-1 transition-colors hover:bg-white/10 hover:text-slate-100"
                                  title="View"
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    openRfp(rfp, "overview");
                                  }}
                                >
                                  <span className="material-symbols-outlined text-[14px]">visibility</span>
                                </button>
                                <button
                                  type="button"
                                  className="btn-tactile rounded-[4px] p-1 transition-colors hover:bg-white/10 hover:text-slate-100"
                                  title="Edit"
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    openRfp(rfp, "overview");
                                  }}
                                >
                                  <span className="material-symbols-outlined text-[14px]">edit</span>
                                </button>
                                <button
                                  type="button"
                                  className="btn-tactile rounded-[4px] p-1 transition-colors hover:bg-white/10 hover:text-slate-100"
                                  title="Download"
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    exportRfp(rfp);
                                  }}
                                >
                                  <span className="material-symbols-outlined text-[14px]">download</span>
                                </button>
                              </div>
                              <button
                                type="button"
                                className="btn-tactile rounded-[3px] px-2 py-[3px] text-[10px] leading-none font-semibold text-slate-100 transition-all hover:brightness-110"
                                style={{ border: "1px solid rgba(226, 232, 240, 0.3)", background: "rgba(226, 232, 240, 0.08)" }}
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  openRfp(rfp, "overview");
                                }}
                              >
                                Review
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                {visible.length === 0 ? (
                  <p className="px-4 py-8 text-sm text-slate-400">No RFPs in this filter.</p>
                ) : null}
              </div>

              <div
                className="mt-1 flex flex-col items-center justify-between pt-3 text-[10px] sm:flex-row"
                style={{ borderTop: "1px solid rgba(226, 232, 240, 0.1)" }}
              >
                <span className="text-slate-400">
                  Showing {visible.length} matching legal RFP opportunit{visible.length === 1 ? "y" : "ies"}
                </span>
                <span className="font-mono-numbers text-[#6EE7B7]">All models up-to-date: BEAR v2.4 / SPI v1.8</span>
              </div>
            </section>

            <div
              id="legal-analytics"
              className="relative flex flex-col items-start justify-between gap-3 overflow-hidden rounded-xl p-3 md:flex-row md:items-center"
              style={{
                background:
                  "linear-gradient(145deg, rgba(24, 29, 41, 0.75) 0%, rgba(13, 16, 23, 0.85) 100%)",
                backdropFilter: "blur(12px)",
                border: "1px solid rgba(226, 232, 240, 0.12)",
                boxShadow:
                  "0 10px 30px -5px rgba(0, 0, 0, 0.6), inset 0 1px 0 0 rgba(255, 255, 255, 0.15)",
              }}
            >
              <div className="flex items-center gap-2.5">
                <div className="shrink-0 text-slate-300">
                  <span className="material-symbols-outlined text-[18px]">bar_chart</span>
                </div>
                <div className="text-[11px] leading-snug">
                  <span className="font-semibold text-slate-100">Win / Loss (modeled):</span>
                  <span className="ml-1 text-[10px] text-slate-400">
                    {modeledWin}% desk alignment
                    {bearWin ? ` · BEAR ${bearWin}%` : ""}. Hot = modeled win, not a closed-file archive.
                  </span>
                  <p className="mt-1 text-[10px] text-slate-400">{analytics.insight}</p>
                </div>
              </div>
              <div className="w-full shrink-0 space-y-1 text-[10px] md:w-56">
                {analytics.slices.map((row) => (
                  <div key={row.key} className="flex items-center justify-between">
                    <span className="font-mono-numbers w-10 text-slate-400">{row.key}</span>
                    <div
                      className="mx-2 h-[3px] flex-1 rounded-full"
                      style={{ background: "rgba(226, 232, 240, 0.1)" }}
                    >
                      <div
                        className={cn("h-full rounded-full", row.rate > 0 ? "bar-animate" : "")}
                        style={{
                          width: `${row.rate}%`,
                          background: row.rate > 0 ? "linear-gradient(90deg, #e2e8f0, #ffffff)" : "transparent",
                        }}
                      />
                    </div>
                    <span
                      className={cn(
                        "font-mono-numbers whitespace-nowrap",
                        row.rate > 0 ? "font-semibold text-slate-100" : "text-slate-500"
                      )}
                    >
                      {row.rate}% · {row.n}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="animate-entrance stagger-6 space-y-4 lg:col-span-4">
            <section
              id="legal-documents"
              data-tour="legal-ingest"
              className="relative overflow-hidden rounded-xl p-4"
              style={{
                background:
                  "linear-gradient(145deg, rgba(24, 29, 41, 0.75) 0%, rgba(13, 16, 23, 0.85) 100%)",
                backdropFilter: "blur(12px)",
                border: "1px solid rgba(226, 232, 240, 0.12)",
                boxShadow:
                  "0 10px 30px -5px rgba(0, 0, 0, 0.6), inset 0 1px 0 0 rgba(255, 255, 255, 0.15)",
              }}
            >
              <div className="flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[16px] text-slate-300">description</span>
                <h3 className="text-[13px] font-semibold text-slate-100">Ingest RFP</h3>
              </div>
              <p className="mt-0.5 mb-3 text-[11px] text-slate-400">
                Drop PDF / DOCX / TXT — extract text, then run the match pipeline.
              </p>
              <form className="space-y-2" onSubmit={(e) => void ingest(e)}>
                <div
                  className="dropzone-box group relative flex min-h-[120px] cursor-pointer flex-col items-center justify-center rounded-[6px] border border-dashed p-4 text-center transition-colors"
                  style={{
                    background: "rgba(9, 11, 16, 0.6)",
                    borderColor: dragOver ? "rgba(255,255,255,0.6)" : "rgba(226, 232, 240, 0.2)",
                  }}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDragOver(true);
                  }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setDragOver(false);
                    const file = e.dataTransfer.files[0];
                    if (file) void ingestFile(file);
                  }}
                >
                  <span className="material-symbols-outlined mb-1.5 text-[22px] text-slate-400 transition-all duration-150 group-hover:-translate-y-0.5 group-hover:text-white">
                    upload_file
                  </span>
                  <span className="text-xs text-slate-300 transition-colors duration-150 group-hover:text-white">
                    {pdfBusy ? "Reading document…" : running ? "Scoring…" : "Drop RFP or click to upload"}
                  </span>
                  <span className="font-mono-numbers mt-1 text-[10px] text-slate-500">
                    PDF · DOCX · TXT · max 8MB
                  </span>
                  <input
                    type="file"
                    accept=".pdf,.docx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
                    className="absolute inset-0 z-10 cursor-pointer opacity-0"
                    disabled={pdfBusy || running}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) void ingestFile(file);
                      e.target.value = "";
                    }}
                  />
                </div>
                {pdfBusy || pdfProgress > 0 ? (
                  <div>
                    <p className="mb-1 text-[11px] text-slate-400">Extraction {pdfProgress}%</p>
                    <div className="h-[3px] overflow-hidden rounded-full" style={{ background: "rgba(226, 232, 240, 0.1)" }}>
                      <div
                        className="h-full rounded-full transition-all"
                        style={{ width: `${pdfProgress}%`, background: "linear-gradient(90deg, #e2e8f0, #ffffff)" }}
                      />
                    </div>
                  </div>
                ) : null}
                {pdfPreview ? (
                  <div className="rounded-[6px] p-2.5" style={{ border: "1px solid rgba(226, 232, 240, 0.14)", background: "rgba(9, 11, 16, 0.6)" }}>
                    <p className="mb-1 text-[10px] tracking-wide text-slate-300 uppercase">
                      Preview · {pdfPreview.name}
                    </p>
                    <p className="max-h-28 overflow-y-auto text-[11px] leading-relaxed whitespace-pre-wrap text-slate-400">
                      {pdfPreview.text}
                    </p>
                  </div>
                ) : null}
                {running ? (
                  <div>
                    <p className="mb-1 text-[11px] text-slate-400">Pipeline {extractPct}%</p>
                    <div className="h-[3px] overflow-hidden rounded-full" style={{ background: "rgba(226, 232, 240, 0.1)" }}>
                      <div
                        className="h-full rounded-full transition-all"
                        style={{ width: `${extractPct}%`, background: "linear-gradient(90deg, #6EE7B7, #10B981)" }}
                      />
                    </div>
                  </div>
                ) : null}
                <div>
                  <label className="mb-1 block text-[10px] font-medium text-slate-400">Title</label>
                  <Input
                    required
                    className="h-[32px] rounded-[6px] border-0 px-2.5 py-0 text-xs text-slate-100 placeholder-slate-500 focus-visible:ring-1 focus-visible:ring-white/40"
                    style={{ background: "rgba(9, 11, 16, 0.6)", border: "1px solid rgba(226, 232, 240, 0.14)" }}
                    placeholder="e.g. Mass Tort Intake Automation RFP"
                    value={form.title}
                    onChange={(e) => setForm({ ...form, title: e.target.value })}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[10px] font-medium text-slate-400">Issuer</label>
                  <Input
                    className="h-[32px] rounded-[6px] border-0 px-2.5 py-0 text-xs text-slate-100 placeholder-slate-500 focus-visible:ring-1 focus-visible:ring-white/40"
                    style={{ background: "rgba(9, 11, 16, 0.6)", border: "1px solid rgba(226, 232, 240, 0.14)" }}
                    placeholder="e.g. State Department of Justice"
                    value={form.issuer}
                    onChange={(e) => setForm({ ...form, issuer: e.target.value })}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[10px] font-medium text-slate-400">RFP body</label>
                  <Textarea
                    required
                    rows={2}
                    className="min-h-[64px] resize-none rounded-[6px] border-0 px-2.5 py-1.5 text-xs text-slate-100 placeholder-slate-500 focus-visible:ring-1 focus-visible:ring-white/40"
                    style={{ background: "rgba(9, 11, 16, 0.6)", border: "1px solid rgba(226, 232, 240, 0.14)" }}
                    placeholder="Paste solicitation text or executive summary..."
                    value={form.body}
                    onChange={(e) => setForm({ ...form, body: e.target.value })}
                  />
                </div>
                {error ? <p className="text-[11px] text-[#FCA5A5]">{error}</p> : null}
                <button
                  type="submit"
                  disabled={running}
                  className="btn-tactile h-[30px] w-full rounded-[6px] px-3 py-1 text-[11px] leading-none font-semibold transition-all disabled:cursor-not-allowed disabled:opacity-50"
                  style={{
                    background: "linear-gradient(180deg, #ffffff 0%, #cbd5e1 50%, #94a3b8 100%)",
                    color: "#090b10",
                    boxShadow: "0 2px 10px rgba(0,0,0,0.5), inset 0 1px 1px rgba(255,255,255,0.9)",
                    border: "1px solid rgba(255,255,255,0.4)",
                  }}
                >
                  {running ? "Extracting…" : "Extract & match"}
                </button>
              </form>
            </section>

            <section
              id="legal-settings"
              className="relative overflow-hidden rounded-xl p-4"
              style={{
                background:
                  "linear-gradient(145deg, rgba(24, 29, 41, 0.75) 0%, rgba(13, 16, 23, 0.85) 100%)",
                backdropFilter: "blur(12px)",
                border: "1px solid rgba(226, 232, 240, 0.12)",
                boxShadow:
                  "0 10px 30px -5px rgba(0, 0, 0, 0.6), inset 0 1px 0 0 rgba(255, 255, 255, 0.15)",
              }}
            >
              <form onSubmit={(e) => void saveProfile(e)}>
                <div className="flex items-center justify-between">
                  <h3 className="text-[13px] font-semibold text-slate-100">Client profile</h3>
                  <a className="text-[11px] text-slate-300 hover:text-white hover:underline" href="#legal-settings">
                    Desk
                  </a>
                </div>
                <p className="mt-0.5 mb-2.5 text-[11px] text-slate-400">
                  Custom scoring weights & qualification rules
                </p>
                <div className="mb-3 flex flex-wrap gap-1">
                  {PRACTICE_OPTIONS.map((area) => {
                    const on = structured.practiceAreas.includes(area);
                    return (
                      <button
                        key={area}
                        type="button"
                        className={cn(
                          "rounded-[3px] px-2 py-0.5 text-[10px] transition-colors duration-150",
                          on ? "font-semibold text-white" : "text-slate-400 hover:text-slate-100"
                        )}
                        style={
                          on
                            ? { border: "1px solid rgba(255,255,255,0.35)", background: "rgba(226, 232, 240, 0.14)" }
                            : { border: "1px solid rgba(226, 232, 240, 0.14)", background: "rgba(226, 232, 240, 0.04)" }
                        }
                        onClick={() =>
                          setStructured((p) => ({
                            ...p,
                            practiceAreas: on
                              ? p.practiceAreas.filter((a) => a !== area)
                              : [...p.practiceAreas, area],
                          }))
                        }
                      >
                        {area}
                      </button>
                    );
                  })}
                </div>
                <div
                  className="mb-3 grid grid-cols-3 gap-2 py-2 text-center"
                  style={{ borderTop: "1px solid rgba(226, 232, 240, 0.1)", borderBottom: "1px solid rgba(226, 232, 240, 0.1)" }}
                >
                  <div>
                    <span className="text-[9px] font-semibold tracking-wider text-slate-400 uppercase">BUDGET</span>
                    <div className="font-mono-numbers mt-0.5 text-[11px] font-semibold text-slate-100">
                      {formatUsdAmount(String(structured.budgetMin))}–{formatUsdAmount(String(structured.budgetMax))}
                    </div>
                  </div>
                  <div>
                    <span className="text-[9px] font-semibold tracking-wider text-slate-400 uppercase">
                      JURISDICTION
                    </span>
                    <div className="mt-0.5 flex items-center justify-center gap-1 text-[11px] font-medium text-slate-100">
                      <select
                        className="max-w-full truncate bg-transparent text-center outline-none"
                        value={structured.jurisdiction}
                        onChange={(e) => setStructured((p) => ({ ...p, jurisdiction: e.target.value }))}
                      >
                        {JURISDICTIONS.map((j) => (
                          <option key={j} value={j} className="bg-[#111827]">
                            {j}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div>
                    <span className="text-[9px] font-semibold tracking-wider text-slate-400 uppercase">WIN RATE</span>
                    <div className="font-mono-numbers mt-0.5 text-[11px] font-semibold text-[#6EE7B7]">
                      {modeledWin}%
                    </div>
                  </div>
                </div>
                <div className="mb-3">
                  <input
                    type="range"
                    min={10000}
                    max={400000}
                    step={5000}
                    value={structured.budgetMax}
                    className="w-full"
                    onChange={(e) =>
                      setStructured((p) => ({
                        ...p,
                        budgetMax: Number(e.target.value),
                        budgetMin: Math.min(p.budgetMin, Number(e.target.value) - 5000),
                      }))
                    }
                  />
                </div>
                <div className="mb-3">
                  <textarea
                    className="w-full resize-none rounded-[6px] border-0 px-2.5 py-1.5 text-xs leading-normal text-slate-100 focus:outline-none focus:ring-1 focus:ring-white/40"
                    style={{ background: "rgba(9, 11, 16, 0.6)", border: "1px solid rgba(226, 232, 240, 0.14)" }}
                    rows={2}
                    placeholder="Key practice notes, exclusions..."
                    value={structured.exclusions.join(", ")}
                    onChange={(e) =>
                      setStructured((p) => ({
                        ...p,
                        exclusions: e.target.value
                          .split(",")
                          .map((s) => s.trim())
                          .filter(Boolean),
                      }))
                    }
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-[11px] text-[#6EE7B7]">
                    <span className="pulse-dot-green size-[6px] rounded-full bg-[#10B981]" />
                    <span>{profileSaved ? "Saved" : "Synced"}</span>
                  </div>
                  <button
                    type="submit"
                    className="btn-tactile rounded-[6px] px-2.5 py-1 text-[11px] font-semibold text-slate-100 transition-all hover:brightness-110"
                    style={{ border: "1px solid rgba(226, 232, 240, 0.3)", background: "rgba(226, 232, 240, 0.08)" }}
                  >
                    Save changes
                  </button>
                </div>
              </form>
            </section>

            <div
              id="legal-audit"
              className="relative space-y-2.5 overflow-hidden rounded-xl p-3"
              style={{
                background:
                  "linear-gradient(145deg, rgba(24, 29, 41, 0.75) 0%, rgba(13, 16, 23, 0.85) 100%)",
                backdropFilter: "blur(12px)",
                border: "1px solid rgba(226, 232, 240, 0.12)",
                boxShadow:
                  "0 10px 30px -5px rgba(0, 0, 0, 0.6), inset 0 1px 0 0 rgba(255, 255, 255, 0.15)",
              }}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span
                    className={cn("size-[6px] rounded-full bg-white", running ? "pulse-dot-amber" : "")}
                  />
                  <span className="text-xs font-semibold text-slate-100">Live pipeline</span>
                </div>
                <span className="font-mono-numbers live-status-pulse text-[10px] text-slate-300">
                  {running ? "Extracting…" : "Waiting for next batch..."}
                </span>
              </div>
              {logs.length === 0 ? (
                <div
                  className="flex items-center justify-between pt-2 text-[11px]"
                  style={{ borderTop: "1px solid rgba(226, 232, 240, 0.1)" }}
                >
                  <div className="flex items-center gap-2 text-slate-400">
                    <span className="material-symbols-outlined text-[14px] text-slate-500">hourglass_empty</span>
                    <span>Waiting for ingest</span>
                  </div>
                  <span className="font-mono-numbers text-[10px] text-slate-500">idle</span>
                </div>
              ) : (
                <div
                  className="space-y-1.5 pt-2 text-[11px] text-slate-400"
                  style={{ borderTop: "1px solid rgba(226, 232, 240, 0.1)" }}
                >
                  {logs
                    .slice(-4)
                    .reverse()
                    .map((log, i) => (
                      <div key={log.id} className="flex items-center justify-between gap-2">
                        <div className="flex min-w-0 items-center gap-2">
                          <span
                            className={cn(
                              "size-[6px] shrink-0 rounded-full",
                              i === 0 ? "bg-white" : "bg-[#6EE7B7]"
                            )}
                          />
                          <span className="truncate text-slate-100">
                            [{log.agent}] {log.message}
                          </span>
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </main>


      <Sheet
        open={sheetOpen && Boolean(selected)}
        onOpenChange={(open) => {
          if (!open) closeRfp();
        }}
      >
        <SheetContent className="w-full border-gold-500/20 bg-navy-850 sm:max-w-lg">
          {selected ? (
            <RfpSheet
              selected={selected}
              all={rfps}
              now={now}
              tab={sheetTab}
              setTab={setSheetTab}
              conflict={conflicts[selected.id]}
              quote={pricing[selected.id]}
              profile={serializeProfile(structured)}
              onReview={(payload) => void clearReview(selected.id, payload)}
              onCorpus={() => void askCorpus(selected.id)}
              onProposal={() => downloadProposal(selected)}
            />
          ) : null}
        </SheetContent>
      </Sheet>
    </>
  );
}

function RfpSheet({
  selected,
  all,
  now,
  tab,
  setTab,
  conflict,
  quote,
  profile,
  onReview,
  onCorpus,
  onProposal,
}: {
  selected: StoredRfp;
  all: StoredRfp[];
  now: number;
  tab: SheetTab;
  setTab: (t: SheetTab) => void;
  conflict?: ConflictReport;
  quote?: PricingQuote;
  profile: string;
  onReview: (payload: { verdict: PartnerVerdict; coiCleared: boolean; bidAmount: string; notes: string }) => void;
  onCorpus: () => void;
  onProposal: () => void;
}) {
  const deadlines = extractDeadlines(selected, now);
  const gaps = complianceGaps(selected);
  const battle = battleCard(selected);
  const assign = assignTeam(selected);
  const peer = similarRfp(selected, all);
  const diff = peer ? diffBodies(peer.body, selected.body) : null;
  const go = goNoGo(selected);
  const prob = winProbability(selected, all);
  const [events, setEvents] = useState<{ id: string; at: string; kind: string; text: string }[]>([]);
  const [note, setNote] = useState("");
  const [kind, setKind] = useState("note");
  const heuristic = goNoGo({ ...selected, partnerDecision: undefined });
  const [verdict, setVerdict] = useState<PartnerVerdict>(selected.partnerDecision?.verdict ?? heuristic.verdict);
  const [coiCleared, setCoiCleared] = useState(Boolean(selected.partnerDecision?.coiCleared));
  const [bidAmount, setBidAmount] = useState(selected.partnerDecision?.bidAmount ?? selected.amount ?? "");
  const [partnerNotes, setPartnerNotes] = useState(selected.partnerDecision?.notes ?? "");

  useEffect(() => {
    void fetch(`/api/rfps/${selected.id}/comms`)
      .then((r) => r.json())
      .then((d: { events?: typeof events }) => setEvents(Array.isArray(d.events) ? d.events : []))
      .catch(() => setEvents([]));
  }, [selected.id]);

  const tabs = [
    ["overview", "Overview"],
    ["deadlines", "Deadlines"],
    ["compliance", "Compliance"],
    ["compete", "Compete"],
    ["proposal", "Proposal"],
    ["compare", "Compare"],
    ["team", "Team"],
    ["comms", "Comms"],
    ["conflicts", "Conflicts"],
    ["pricing", "Pricing"],
  ] as const;

  return (
    <>
      <SheetHeader>
        <SheetTitle>{selected.title}</SheetTitle>
        <SheetDescription>
          {selected.issuer} · {selected.method} · {assign.attorney}
        </SheetDescription>
      </SheetHeader>
      <div className="flex flex-wrap gap-1 px-4">
        {tabs.map(([id, label]) => (
          <Button key={id} size="xs" variant={tab === id ? "default" : "outline"} onClick={() => setTab(id)}>
            {label}
          </Button>
        ))}
      </div>
      <div className="flex flex-col gap-4 overflow-y-auto px-4 pb-4">
        {tab === "overview" ? (
          <>
            <div className="flex flex-wrap gap-2">
              <span className={cn("inline-flex rounded-full px-2 py-0.5 text-xs ring-1", tierClass(selected.tier))}>
                {selected.matchScore} · {selected.tier}
              </span>
              <Badge
                variant="outline"
                className={
                  go.verdict === "NO-GO"
                    ? "border-rose-500/40 text-rose-300"
                    : go.verdict === "CONDITIONAL"
                      ? "border-amber-500/40 text-amber-200"
                      : "border-emerald-500/40 text-emerald-300"
                }
              >
                Fit {go.verdict} {go.score}
              </Badge>
              {conflict ? (
                <Badge variant="outline" className={coiChipClass(conflict.verdict)}>
                  COI {conflict.verdict} {conflict.score}
                </Badge>
              ) : null}
              <Badge variant="outline">{prob}% win probability</Badge>
              <Badge variant="secondary">{countdownLabel(deadlines[0]?.days ?? null)}</Badge>
              <Badge variant="outline">{assign.attorney} · {assign.role}</Badge>
            </div>
            <p className="text-sm leading-relaxed">{selected.reasoning}</p>
            <p className="text-xs text-muted-foreground">
              {assign.reason} · {assign.workload}h / {assign.capacity}h this week
              {assign.conflict ? ` · ${assign.conflict}` : ""}
            </p>
            {selected.corpusHits && selected.corpusHits.length > 0 ? (
              <div className="space-y-2 rounded-xl border border-[#F59E0B]/30 bg-[#F59E0B]/5 p-3">
                <p className="text-xs font-semibold text-[#F59E0B]">
                  Firm corpus · {selected.corpusStatus} · {selected.corpusHits.length} cite
                  {selected.corpusHits.length === 1 ? "" : "s"}
                </p>
                <ul className="space-y-2">
                  {selected.corpusHits.map((hit) => (
                    <li key={hit.chunkId} className="rounded-lg bg-[#0B0F19]/60 p-2 text-xs">
                      <p className="font-medium text-[#F3F4F6]">{hit.docTitle}</p>
                      <p className="mt-1 text-[#9CA3AF]">“{hit.quote}”</p>
                      <p className="mt-1 font-mono text-[10px] text-[#6B7280]">
                        {hit.verified ? `chars ${hit.spanStart}–${hit.spanEnd}` : "unverified"} · score{" "}
                        {hit.score}
                      </p>
                    </li>
                  ))}
                </ul>
              </div>
            ) : selected.corpusStatus === "unavailable" ? (
              <p className="rounded-lg border border-[#374151] px-3 py-2 text-xs text-[#9CA3AF]">
                Corpus queried — no firm precedents matched. Ingest a closer playbook under Documents.
              </p>
            ) : selected.corpusStatus === "live" ? null : (
              <p className="text-[11px] text-[#6B7280]">
                Corpus not asked yet. Use Ask corpus for live firm cites (not mock).
              </p>
            )}
            <ul className="space-y-2">
              {selected.fields.map((field) => (
                <li key={field.key} className="rounded-lg bg-muted/40 p-2">
                  <div className="flex justify-between text-sm">
                    <span>{field.label}</span>
                    <span className="text-muted-foreground">{Math.round(field.confidence * 100)}%</span>
                  </div>
                  <p className="text-sm">{field.value}</p>
                </li>
              ))}
            </ul>
          </>
        ) : null}
        {tab === "deadlines" ? (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <Button size="xs" variant="outline" onClick={() => downloadIcs(selected, now)}>
                Download .ics (Outlook)
              </Button>
              {deadlines[0] ? (
                <a
                  className="inline-flex h-7 items-center rounded-lg border border-input px-2 text-xs"
                  href={googleCalendarUrl(deadlines[0], selected.title)}
                  target="_blank"
                  rel="noreferrer"
                >
                  Add next to Google Calendar
                </a>
              ) : null}
            </div>
            <p className="text-[11px] text-muted-foreground">
              Alerts fire at 7 days, 3 days, and 1 day. Bidirectional Google/Outlook sync is the .ics + Calendar link on this desk — live OAuth comes with the client tenant.
            </p>
            <ol className="relative ml-2 border-l border-gold-500/30 pl-4">
              {deadlines.length === 0 ? (
                <p className="text-sm text-muted-foreground">No dated deadlines parsed.</p>
              ) : (
                deadlines.map((d) => {
                  const urgent = d.days != null && d.days >= 0 && d.days < 1;
                  return (
                    <li key={`${d.label}-${d.date}`} className="mb-4">
                      <p className="flex flex-wrap items-center gap-2 text-sm font-medium">
                        {d.label} · {d.date}
                        <span
                          className={cn(
                            "rounded-md border px-1.5 py-0.5 font-mono text-[10px]",
                            urgent
                              ? "animate-pulse border-rose-500/50 bg-rose-500/20 text-rose-300"
                              : "border-white/10 text-slate-400"
                          )}
                        >
                          {countdownLabel(d.days)}
                        </span>
                      </p>
                      <p className="text-xs text-muted-foreground">{alertCadence(d.days)}</p>
                    </li>
                  );
                })
              )}
            </ol>
          </div>
        ) : null}
        {tab === "compliance" ? (
          <div className="space-y-3">
            <div
              className={cn(
                "rounded-xl border p-3 text-sm",
                go.verdict === "NO-GO"
                  ? "border-rose-500/30 bg-rose-500/10"
                  : go.verdict === "CONDITIONAL"
                    ? "border-amber-500/30 bg-amber-500/10"
                    : "border-emerald-500/30 bg-emerald-500/10"
              )}
            >
              <p className="font-semibold">
                Go/No-Go: {go.verdict} · {go.score}
                <InfoTooltip content={LEGAL_HELP.goNoGo} side="top" label="About Go/No-Go" />
              </p>
              <p className="text-xs text-muted-foreground">{go.why}</p>
            </div>
            <div className="space-y-2 rounded-xl border border-border p-3">
              <p className="text-xs font-semibold">Partner sign-off</p>
              <select
                className="h-8 w-full rounded-lg border border-input bg-background px-2 text-xs"
                value={verdict}
                onChange={(e) => setVerdict(e.target.value as PartnerVerdict)}
              >
                <option value="GO">GO</option>
                <option value="CONDITIONAL">CONDITIONAL</option>
                <option value="NO-GO">NO-GO</option>
              </select>
              <label className="flex items-center gap-2 text-xs">
                <input type="checkbox" checked={coiCleared} onChange={(e) => setCoiCleared(e.target.checked)} />
                COI cleared
              </label>
              <Input value={bidAmount} onChange={(e) => setBidAmount(e.target.value)} placeholder="Bid amount" />
              <Textarea rows={2} value={partnerNotes} onChange={(e) => setPartnerNotes(e.target.value)} placeholder="Partner notes" />
            </div>
            <ul className="space-y-2">
              {gaps.length === 0 ? (
                <p className="text-sm text-muted-foreground">No eliminator language flagged.</p>
              ) : (
                gaps.map((g) => (
                  <li
                    key={g.label}
                    className={cn(
                      "rounded-lg p-3 text-sm ring-1",
                      g.severity === "red"
                        ? "bg-rose-500/10 ring-rose-500/30"
                        : "bg-amber-500/10 ring-amber-500/30"
                    )}
                  >
                    <p className="font-medium">
                      {g.severity === "red" ? "⚠ " : ""}
                      {g.label}
                    </p>
                    <p className="text-muted-foreground">{g.detail}</p>
                  </li>
                ))
              )}
            </ul>
          </div>
        ) : null}
        {tab === "compete" ? (
          <div className="space-y-3 text-sm">
            <p>
              <span className="text-muted-foreground">Incumbent / named: </span>
              {battle.names.length ? battle.names.join(", ") : "none extracted"}
            </p>
            <div>
              <p className="text-xs tracking-wide text-primary uppercase">Battle card</p>
              <ul className="mt-1 list-disc pl-4">
                {battle.differentiators.map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </ul>
            </div>
            <div>
              <p className="text-xs tracking-wide text-primary uppercase">Our strengths</p>
              <ul className="list-disc pl-4">
                {battle.strengths.map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </ul>
            </div>
            <div>
              <p className="text-xs tracking-wide text-primary uppercase">Watch</p>
              <ul className="list-disc pl-4">
                {battle.weaknesses.map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </ul>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Historical win/loss vs. this name is modeled from desk mix ({prob}% on this method). Public pricing benches land with the client’s closed-file archive.
            </p>
          </div>
        ) : null}
        {tab === "proposal" ? (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Proposal pack: draft + COI + bid target + compliance checklist. Partner review before send.
            </p>
            <div className="rounded-lg border border-[#1F2937] bg-[#0B0F19] p-3 text-[11px] text-[#9CA3AF]">
              <p className="mb-2 font-semibold tracking-wide text-[#F59E0B] uppercase">Pack checklist</p>
              <ul className="space-y-1">
                <li>[ ] Partner sign-off on Go/No-Go ({go.verdict})</li>
                <li>
                  [ ] COI {conflict?.verdict ?? "pending"}
                  {conflict?.why ? ` — ${conflict.why.slice(0, 80)}` : ""}
                </li>
                <li>
                  [ ] Bid target {quote ? formatUsdNumber(quote.target) : selected.amount}
                </li>
                <li>
                  [ ] Compliance gaps: {gaps.length === 0 ? "none" : `${gaps.length} open`}
                </li>
              </ul>
            </div>
            <pre className="max-h-64 overflow-auto rounded-lg bg-muted/40 p-3 text-[11px] leading-relaxed whitespace-pre-wrap">
              {draftProposal(selected, profile, peer, {
                bidTarget: quote ? formatUsdNumber(quote.target) : undefined,
                coiVerdict: conflict?.verdict,
                coiWhy: conflict?.why,
              })}
            </pre>
            <div className="flex flex-wrap gap-2">
              <Button onClick={onProposal}>
                <Download className="size-4" />
                Download proposal pack
              </Button>
              <Button variant="outline" onClick={onCorpus}>
                <Database className="size-4" />
                Pull corpus into draft
              </Button>
            </div>
          </div>
        ) : null}
        {tab === "compare" ? (
          peer && diff ? (
            <div className="space-y-3 text-xs">
              <p className="text-sm text-slate-200">
                {diff.added.length + diff.removed.length + diff.modified.length} changes vs. {peer.title}
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-lg border border-white/10 p-2">
                  <p className="mb-1 font-medium">Prior similar</p>
                  <p className="text-muted-foreground">{peer.title}</p>
                  <ul className="mt-2 space-y-1 text-slate-400">
                    {diff.shared.map((s) => (
                      <li key={s}>{s}</li>
                    ))}
                  </ul>
                  {diff.removed.map((s) => (
                    <p key={s} className="mt-1 rounded bg-rose-500/10 p-1 text-rose-300">
                      − {s}
                    </p>
                  ))}
                </div>
                <div className="rounded-lg border border-white/10 p-2">
                  <p className="mb-1 font-medium">This RFP</p>
                  {diff.added.map((s) => (
                    <p key={s} className="mt-1 rounded bg-emerald-500/10 p-1 text-emerald-300">
                      + {s}
                    </p>
                  ))}
                  {diff.modified.map((s) => (
                    <p key={s} className="mt-1 rounded bg-amber-500/10 p-1 text-amber-200">
                      ~ {s}
                    </p>
                  ))}
                  {!diff.added.length && !diff.modified.length ? (
                    <p className="text-muted-foreground">No extra clauses spotted.</p>
                  ) : null}
                </div>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Need another RFP on the desk to compare.</p>
          )
        ) : null}
        {tab === "team" ? (
          <div className="space-y-3 text-sm">
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-full border-2 border-gold-500 text-xs font-semibold text-gold-300">
                {assign.initials}
              </div>
              <div>
                <p className="font-medium">
                  Assigned to: {assign.attorney} ({assign.role})
                </p>
                <p className="text-xs text-muted-foreground">{assign.reason}</p>
              </div>
            </div>
            <p>Estimated hours: {assign.hours}h</p>
            <div>
              <p className="mb-1 text-xs text-muted-foreground">
                Current workload: {assign.workload}h / {assign.capacity}h this week
              </p>
              <div className="h-2 overflow-hidden rounded-full bg-navy-950">
                <div
                  className="h-full bg-gold-500"
                  style={{ width: `${Math.min(100, (assign.workload / assign.capacity) * 100)}%` }}
                />
              </div>
            </div>
            {assign.conflict ? (
              <p className="rounded-lg border border-rose-500/30 bg-rose-500/10 p-2 text-rose-300">
                ⚠ {assign.conflict}
              </p>
            ) : (
              <p className="text-xs text-emerald-400">No issuer conflict flagged on this desk.</p>
            )}
          </div>
        ) : null}
        {tab === "comms" ? (
          <div className="space-y-3 text-sm">
            <p className="text-xs text-muted-foreground">
              Last contact:{" "}
              {events[0] ? new Date(events[0].at).toLocaleString() : "none logged"}
              {events[0]
                ? ` · next follow-up if silent ${Math.max(0, 3 - Math.floor((now - Date.parse(events[0].at)) / 86_400_000))}d`
                : ""}
            </p>
            <ol className="space-y-2 border-l border-gold-500/25 pl-3">
              {events.map((ev) => (
                <li key={ev.id}>
                  <p className="text-[11px] uppercase text-gold-400">{ev.kind}</p>
                  <p>{ev.text}</p>
                  <p className="text-[11px] text-muted-foreground">{new Date(ev.at).toLocaleString()}</p>
                </li>
              ))}
              {events.length === 0 ? <li className="text-muted-foreground">No communications yet.</li> : null}
            </ol>
            <form
              className="space-y-2"
              onSubmit={(e) => {
                e.preventDefault();
                void fetch(`/api/rfps/${selected.id}/comms`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ kind, text: note }),
                })
                  .then((r) => r.json())
                  .then((d: { events?: typeof events }) => {
                    if (Array.isArray(d.events)) setEvents(d.events);
                    setNote("");
                  });
              }}
            >
              <select
                className="h-8 w-full rounded-lg border border-input bg-background px-2 text-xs"
                value={kind}
                onChange={(e) => setKind(e.target.value)}
              >
                <option value="note">Note</option>
                <option value="email">Email</option>
                <option value="call">Call</option>
                <option value="meeting">Meeting</option>
              </select>
              <Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Log contact…" />
              <Button type="submit" size="sm">
                Log
              </Button>
            </form>
            <p className="text-[11px] text-muted-foreground">
              Gmail/Outlook live sync is tenant-scoped. This desk logs HITL contact so follow-ups do not drop.
            </p>
          </div>
        ) : null}
        {tab === "conflicts" ? (
          <ConflictPanel rfpId={selected.id} rfp={selected} initialReport={conflict ?? null} />
        ) : null}
        {tab === "pricing" ? (
          <PricingPanel rfpId={selected.id} rfp={selected} initialQuote={quote ?? null} />
        ) : null}
      </div>
      <SheetFooter>
        {selected.needsReview || !selected.partnerDecision ? (
          <Button
            variant="secondary"
            onClick={() => onReview({ verdict, coiCleared, bidAmount, notes: partnerNotes })}
          >
            Partner {verdict}
          </Button>
        ) : null}
        <Button variant="outline" onClick={onProposal}>
          <Download className="size-4" />
          Proposal pack
        </Button>
        <Button onClick={onCorpus}>
          <Database className="size-4" />
          {selected.corpusStatus === "live"
            ? "Refresh corpus"
            : selected.corpusStatus === "unavailable"
              ? "Retry corpus"
              : "Ask corpus"}
        </Button>
      </SheetFooter>
    </>
  );
}
