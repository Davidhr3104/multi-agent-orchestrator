"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
import type { AgentRun, LeadStreamEvent, PipelineLog, PipelineStage, StoredLead } from "@helix/core";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { readOnboarding, writeOnboarding } from "@/lib/prefs";
import { cn } from "@/lib/utils";
import {
  Activity,
  ArrowRight,
  ArrowUp,
  Ban,
  Bell,
  Clock,
  Component,
  Copy,
  DollarSign,
  Droplet,
  Eye,
  Inbox,
  LayoutGrid,
  Loader2,
  Pencil,
  RefreshCw,
  Send,
  Table2,
  X,
} from "lucide-react";
import { Textarea } from "@/components/ui/textarea";

type Filter = "all" | "hot" | "warm" | "cold" | "review" | "spam" | "lead" | "info";
type ViewMode = "table" | "kanban";

const KANBAN: { id: PipelineStage | "closed"; label: string; stages: PipelineStage[] }[] = [
  { id: "new", label: "New", stages: ["new"] },
  { id: "qualified", label: "Qualified", stages: ["qualified"] },
  { id: "contacted", label: "Contacted", stages: ["contacted"] },
  { id: "closed", label: "Won/Lost", stages: ["won", "lost"] },
];

const fieldClass =
  "h-8 w-full rounded-md border border-sky-900/50 bg-[#0a1e30] px-3 py-1.5 text-sm text-slate-200 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500";

const pillBtn =
  "rounded-md px-3 py-1 text-sm font-medium transition-colors border border-sky-900/50 bg-[#0f2942] text-slate-300 hover:bg-[#153450]";

function tierText(tier: StoredLead["tier"]) {
  if (tier === "hot") return "text-emerald-400";
  if (tier === "warm") return "text-amber-400";
  return "text-rose-400";
}

function tierBar(tier: StoredLead["tier"]) {
  if (tier === "hot") return "bg-emerald-500";
  if (tier === "warm") return "bg-amber-500";
  return "bg-rose-500";
}

function rowBar(lead: StoredLead) {
  if (lead.classification === "spam") return "bg-rose-500";
  if (lead.tier === "hot") return "bg-emerald-500";
  if (lead.tier === "warm") return "bg-amber-500";
  return "bg-rose-500";
}

function inboxAgeHours(iso: string, now: number) {
  return Math.max(0, (now - new Date(iso).getTime()) / 36e5);
}

function stageOf(lead: StoredLead): PipelineStage {
  return lead.pipelineStage ?? "new";
}

function formatDecision(decision?: string) {
  if (decision === "aprobado") return "approved";
  if (decision === "requiere revisión") return "needs review";
  if (decision === "bloqueado") return "blocked";
  return decision;
}

function exportCsv(rows: StoredLead[]) {
  const header = ["name", "email", "source", "classification", "score", "tier", "confidence", "stage"];
  const lines = [
    header.join(","),
    ...rows.map((l) =>
      [l.name, l.email, l.source, l.classification, l.score, l.tier, l.confidence, stageOf(l)]
        .map((v) => `"${String(v).replaceAll('"', '""')}"`)
        .join(",")
    ),
  ];
  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "helix-leads.csv";
  a.click();
  URL.revokeObjectURL(url);
}

export function LeadDashboard() {
  const [leads, setLeads] = useState<StoredLead[]>([]);
  const [ghlConfigured, setGhlConfigured] = useState(false);
  const [nowMs, setNowMs] = useState<number | null>(null);
  const [lastSyncAt, setLastSyncAt] = useState<number | null>(null);
  const [mounted, setMounted] = useState(false);
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<StoredLead | null>(null);
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [view, setView] = useState<ViewMode>("table");
  const [running, setRunning] = useState(false);
  const [logs, setLogs] = useState<PipelineLog[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [bellOpen, setBellOpen] = useState(false);
  const [attribution, setAttribution] = useState<{ source: string; total: number; hotPct: number }[]>(
    []
  );
  const [roi, setRoi] = useState<{ hoursSaved: number; pipelineUsd: number; spamBlocked: number } | null>(
    null
  );
  const [resurrect, setResurrect] = useState<
    { id: string; name: string; reason: string; scoreBoost: number }[]
  >([]);
  const [reactivateOpen, setReactivateOpen] = useState(false);
  const [reactivateBusy, setReactivateBusy] = useState(false);
  const [reactivateDrafts, setReactivateDrafts] = useState<
    { id: string; name: string; email: string; reactivation_email: string }[]
  >([]);
  const [form, setForm] = useState({
    name: "",
    email: "",
    source: "website",
    budget: "",
    timeline: "",
    message: "",
  });
  const nameRef = useRef<HTMLInputElement>(null);

  function showToast(message: string) {
    setToast(message);
    window.setTimeout(() => setToast(null), 3200);
  }

  async function refresh() {
    const res = await fetch("/api/leads");
    const data = (await res.json()) as {
      leads: StoredLead[];
      ghlConfigured?: boolean;
      attribution?: { source: string; total: number; hotPct: number }[];
    };
    setLeads(data.leads);
    setSelected((cur) => (cur ? (data.leads.find((l) => l.id === cur.id) ?? cur) : null));
    setGhlConfigured(Boolean(data.ghlConfigured));
    setAttribution(data.attribution ?? []);
    setLastSyncAt(Date.now());
    const [roiRes, rezz] = await Promise.all([
      fetch("/api/roi").then((r) => r.json()),
      fetch("/api/leads/resurrect").then((r) => r.json()),
    ]);
    setRoi(roiRes);
    setResurrect(rezz.hits ?? []);
  }

  useEffect(() => {
    setMounted(true);
    void refresh();
  }, []);

  useEffect(() => {
    setNowMs(Date.now());
    const timer = window.setInterval(() => setNowMs(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    function onNew() {
      setSelected(null);
      window.setTimeout(() => nameRef.current?.focus(), 50);
    }
    function onClose() {
      setSelected(null);
    }
    function onOpen(e: Event) {
      const id = (e as CustomEvent<string>).detail;
      const lead = leads.find((l) => l.id === id);
      if (lead) setSelected(lead);
    }
    window.addEventListener("helix:new-lead", onNew);
    window.addEventListener("helix:close-panel", onClose);
    window.addEventListener("helix:open-lead", onOpen);
    return () => {
      window.removeEventListener("helix:new-lead", onNew);
      window.removeEventListener("helix:close-panel", onClose);
      window.removeEventListener("helix:open-lead", onOpen);
    };
  }, [leads]);

  const metrics = useMemo(() => {
    const usable = leads.filter((l) => l.classification !== "spam");
    const inboxHealth =
      leads.length === 0 ? 0 : Math.round((usable.length / leads.length) * 100);
    const avgScore =
      usable.length === 0
        ? 0
        : Math.round(usable.reduce((s, l) => s + l.score, 0) / usable.length);
    const avgHours =
      usable.length === 0 || nowMs === null
        ? 0
        : usable.reduce((s, l) => s + inboxAgeHours(l.createdAt, nowMs), 0) /
          usable.length;
    const review = leads.filter((l) => l.needsReview).length;
    return { inboxHealth, avgScore, avgHours, review };
  }, [leads, nowMs]);

  const syncLabel = useMemo(() => {
    if (!lastSyncAt || nowMs === null) return "Last sync: —";
    const mins = Math.max(0, Math.round((nowMs - lastSyncAt) / 60_000));
    if (mins < 1) return "Last sync: just now";
    return `Last sync: ${mins} min ago`;
  }, [lastSyncAt, nowMs]);

  const alerts = useMemo(() => {
    const review = leads
      .filter((l) => l.needsReview)
      .map((l) => ({ id: l.id, text: `${l.name} needs review`, lead: l }));
    const hot = leads
      .filter((l) => l.tier === "hot" && l.classification === "lead")
      .slice(0, 3)
      .map((l) => ({ id: `hot-${l.id}`, text: `Hot lead: ${l.name}`, lead: l }));
    const competitors = leads
      .filter((l) => (l.competitors?.length ?? 0) > 0)
      .map((l) => ({
        id: `comp-${l.id}`,
        text: `${l.name} mentioned ${l.competitors![0].name}`,
        lead: l,
      }));
    const risk = leads
      .filter((l) => l.sentiment === "negative")
      .map((l) => ({ id: `sent-${l.id}`, text: `${l.name} tone is negative`, lead: l }));
    return [...review, ...competitors, ...risk, ...hot].slice(0, 8);
  }, [leads]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return leads.filter((lead) => {
      if (filter === "review" && !lead.needsReview) return false;
      if (filter === "hot" || filter === "warm" || filter === "cold") {
        if (lead.tier !== filter) return false;
      }
      if (filter === "spam" || filter === "lead" || filter === "info") {
        if (lead.classification !== filter) return false;
      }
      if (!q) return true;
      return [lead.name, lead.email, lead.source, lead.classification]
        .join(" ")
        .toLowerCase()
        .includes(q);
    });
  }, [leads, filter, query]);

  const allVisibleChecked =
    visible.length > 0 && visible.every((l) => checked.has(l.id));

  async function ingest(e: FormEvent) {
    e.preventDefault();
    setRunning(true);
    setError(null);
    setLogs([]);
    try {
      const res = await fetch("/api/leads/ingest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
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
          const event = JSON.parse(line) as LeadStreamEvent;
          if (event.type === "log") setLogs((prev) => [...prev, event.log]);
          if (event.type === "result") {
            setLeads((prev) => [event.lead, ...prev.filter((l) => l.id !== event.lead.id)]);
            setSelected(event.lead);
          }
          if (event.type === "error") setError(event.message);
        }
      }
      setForm((f) => ({ ...f, name: "", email: "", message: "", budget: "", timeline: "" }));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setRunning(false);
      void refresh();
    }
  }

  async function sendCrm(id: string) {
    setError(null);
    const res = await fetch(`/api/leads/${id}/crm`, { method: "POST" });
    const data = (await res.json()) as { lead?: StoredLead; error?: string };
    if (data.lead) {
      setLeads((prev) => prev.map((l) => (l.id === id ? data.lead! : l)));
      setSelected(data.lead);
      showToast("Lead sent to CRM");
    }
    if (!res.ok) setError(data.error || `GHL ${res.status}`);
  }

  async function trackBehavior(id: string, kind: string) {
    const res = await fetch(`/api/leads/${id}/behavior`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind }),
    });
    const data = (await res.json()) as { lead?: StoredLead };
    if (data.lead) {
      setLeads((prev) => prev.map((l) => (l.id === id ? data.lead! : l)));
      setSelected(data.lead);
    }
  }

  async function clearReview(id: string) {
    const res = await fetch(`/api/leads/${id}/review`, { method: "POST" });
    const data = (await res.json()) as { lead?: StoredLead };
    if (data.lead) {
      setLeads((prev) => prev.map((l) => (l.id === id ? data.lead! : l)));
      setSelected(data.lead);
    }
  }

  async function setStage(id: string, pipelineStage: PipelineStage) {
    const res = await fetch(`/api/leads/${id}/stage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pipelineStage }),
    });
    const data = (await res.json()) as { lead?: StoredLead };
    if (data.lead) {
      setLeads((prev) => prev.map((l) => (l.id === id ? data.lead! : l)));
      if (selected?.id === id) setSelected(data.lead);
    }
  }

  async function bulk(action: "ghl" | "review" | "delete") {
    const ids = [...checked];
    if (ids.length === 0) return;
    const res = await fetch("/api/leads/bulk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids, action }),
    });
    const data = (await res.json()) as { leads?: StoredLead[]; ok?: boolean };
    if (action === "delete") {
      setLeads((prev) => prev.filter((l) => !checked.has(l.id)));
      if (selected && checked.has(selected.id)) setSelected(null);
      setChecked(new Set());
      return;
    }
    if (data.leads) {
      const map = new Map(data.leads.map((l) => [l.id, l]));
      setLeads((prev) => prev.map((l) => map.get(l.id) ?? l));
    }
    if (action === "ghl") showToast(`Lead sent to CRM (${ids.length})`);
    setChecked(new Set());
    void refresh();
  }

  function toggleCheck(id: string) {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAllVisible() {
    setChecked((prev) => {
      const next = new Set(prev);
      if (allVisibleChecked) {
        for (const l of visible) next.delete(l.id);
      } else {
        for (const l of visible) next.add(l.id);
      }
      return next;
    });
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
    { id: "lead", label: "Leads" },
    { id: "info", label: "Info" },
    { id: "spam", label: "Spam" },
  ];

  return (
    <div className="helix-grid min-h-full text-slate-300">
      <svg className="absolute h-0 w-0" aria-hidden>
        <defs>
          <linearGradient id="cyan-gradient" x1="0%" x2="0%" y1="0%" y2="100%">
            <stop offset="0%" stopColor="#38bdf8" stopOpacity="1" />
            <stop offset="100%" stopColor="#021426" stopOpacity="0" />
          </linearGradient>
        </defs>
      </svg>

      <div className="mx-auto flex w-full max-w-[1300px] flex-col gap-6 px-4 py-8 sm:px-8">
        <header className="flex items-start justify-between gap-4">
          <div className="space-y-4">
            <div className="flex h-[4.5rem] w-[min(100%,36rem)] items-center gap-3">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white p-1.5 ring-1 ring-black/10">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/helix-leads-icon.png"
                  alt=""
                  className="h-full w-full object-contain"
                />
              </div>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/helix-leads-wordmark.png"
                alt="Helix Leads"
                className="h-[3.75rem] w-auto max-w-[min(100%,28rem)] object-contain object-left brightness-0 invert"
              />
            </div>
            <p className="max-w-2xl text-sm leading-relaxed text-slate-400">
              EXT extracts the contact, REC classifies and scores, REV flags mid-confidence
              cases.
              <br />
              Send to GHL upserts the contact when GHL_API_KEY and GHL_LOCATION_ID are set;
              <br />
              otherwise crm_status stays mocked.
            </p>
          </div>
          <div className="flex flex-col items-end gap-2">
            <div className="flex items-center gap-2">
              <div className="relative">
                <button
                  type="button"
                  className="relative rounded-full border border-sky-900/50 bg-[#041a2e] p-1.5 text-slate-400"
                  onClick={() => setBellOpen((o) => !o)}
                  aria-label="Notifications"
                >
                  <Bell className="size-3.5 text-sky-400" />
                  {alerts.length > 0 ? (
                    <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[9px] font-bold text-white">
                      {alerts.length}
                    </span>
                  ) : null}
                </button>
                {bellOpen ? (
                  <div className="card-bg absolute top-9 right-0 z-30 w-72 rounded-xl p-3">
                    <p className="mb-2 text-xs font-medium text-slate-400">Alerts</p>
                    <ul className="space-y-1">
                      {alerts.length === 0 ? (
                        <li className="text-xs text-slate-500">No alerts</li>
                      ) : (
                        alerts.map((a) => (
                          <li key={a.id}>
                            <button
                              type="button"
                              className="w-full rounded-md px-2 py-1.5 text-left text-xs text-slate-300 hover:bg-white/5"
                              onClick={() => {
                                setSelected(a.lead);
                                setBellOpen(false);
                              }}
                            >
                              {a.text}
                            </button>
                          </li>
                        ))
                      )}
                    </ul>
                  </div>
                ) : null}
              </div>
              <div className="flex items-center gap-2 rounded-full border border-sky-900/50 bg-[#041a2e] px-3 py-1.5 text-xs text-slate-400">
                <span>{syncLabel}</span>
                <RefreshCw className="size-3 text-sky-400" />
              </div>
            </div>
            <span className="text-[11px] text-slate-500">
              {ghlConfigured ? "GHL connected" : "GHL keys missing · mock"}
            </span>
            <button
              type="button"
              className={pillBtn}
              disabled={reactivateBusy}
              onClick={() => {
                setReactivateBusy(true);
                void fetch("/api/leads/reactivate", { method: "POST" })
                  .then((r) => r.json())
                  .then((d: { leads?: { id: string; name: string; email: string; reactivation_email: string }[] }) => {
                    setReactivateDrafts(d.leads ?? []);
                    setReactivateOpen(true);
                    if ((d.leads ?? []).length === 0) showToast("No cold/archived leads older than 6 months");
                  })
                  .finally(() => setReactivateBusy(false));
              }}
            >
              {reactivateBusy ? "Reactivating…" : "Reactivate Cold Leads"}
            </button>
          </div>
        </header>

        <OnboardingCard ghlConfigured={ghlConfigured} />

        {resurrect.length > 0 ? (
          <section className="card-bg rounded-xl p-4">
            <h2 className="text-sm font-semibold text-white">Lead resurrection</h2>
            <p className="mb-2 text-xs text-slate-500">Cold/lost contacts ready for another touch.</p>
            <ul className="space-y-1 text-xs text-slate-400">
              {resurrect.map((h) => (
                <li key={h.id}>
                  <button
                    type="button"
                    className="text-left hover:text-sky-300"
                    onClick={() => {
                      const lead = leads.find((l) => l.id === h.id);
                      if (lead) setSelected(lead);
                    }}
                  >
                    {h.name} · +{h.scoreBoost} · {h.reason}
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard
            icon={<Inbox className="size-3.5" />}
            label="Inbox health"
            value={`${metrics.inboxHealth}%`}
            hint="Non-spam share"
            delta="↑ 5% vs last week"
            spark="M0 25 Q 10 15, 20 20 T 40 10 T 60 22 T 80 15 T 100 5"
          />
          <MetricCard
            icon={<Droplet className="size-3.5" />}
            label="Lead quality"
            value={String(metrics.avgScore)}
            hint="Avg score excluding spam"
            delta="↑ 5% vs last week"
            spark="M0 20 Q 15 25, 30 15 T 60 20 T 80 10 T 100 5"
          />
          <MetricCard
            icon={<Activity className="size-3.5" />}
            label="Time in inbox"
            value={`${metrics.avgHours.toFixed(1)}h`}
            hint="Proxy for conversion time"
            delta="↑ 5% vs last week"
            spark="M0 10 Q 20 20, 40 15 T 70 25 T 90 10 T 100 15"
          />
          <MetricCard
            icon={<Clock className="size-3.5" />}
            label="Review queue"
            value={String(metrics.review)}
            hint="HITL required"
            delta="↑ 5% vs last week"
            spark="M0 25 Q 15 20, 30 22 T 50 18 T 70 20 T 85 10 T 100 12"
            action={
              <button
                type="button"
                className="inline-flex items-center text-xs text-sky-400 transition-colors hover:text-sky-300"
                onClick={() => setFilter("review")}
              >
                Review now <ArrowRight className="ml-1 size-3" />
              </button>
            }
          />
        </section>

        {attribution.length > 0 ? (
          <section className="card-bg rounded-xl p-4">
            <h2 className="text-sm font-semibold text-white">Lead sources</h2>
            <p className="mb-3 text-xs text-slate-500">Share of hot leads by inbound source.</p>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {attribution.map((row) => (
                <div key={row.source}>
                  <div className="mb-1 flex justify-between text-xs text-slate-400">
                    <span>
                      {row.source}: {row.hotPct}% hot leads
                    </span>
                    <span>{row.total}</span>
                  </div>
                  <div className="h-1 w-full overflow-hidden rounded-full bg-slate-800">
                    <div className="h-full bg-emerald-500" style={{ width: `${row.hotPct}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
          <div className="space-y-0">
            {roi ? (
              <section className="mb-4 grid gap-3 sm:grid-cols-3">
                <div className="card-bg rounded-xl p-4">
                  <div className="flex items-center gap-2 text-slate-400">
                    <Clock className="size-3.5 text-sky-400" />
                    <span className="text-[11px] tracking-wide uppercase">Hours saved</span>
                  </div>
                  <p className="mt-2 text-3xl font-semibold text-white">{roi.hoursSaved}h</p>
                  <p className="mt-1 text-xs text-slate-500">
                    Helix saved you {roi.hoursSaved} hours of data entry
                  </p>
                </div>
                <div className="card-bg rounded-xl p-4">
                  <div className="flex items-center gap-2 text-slate-400">
                    <Ban className="size-3.5 text-rose-400" />
                    <span className="text-[11px] tracking-wide uppercase">Spam filtered</span>
                  </div>
                  <p className="mt-2 text-3xl font-semibold text-white">{roi.spamBlocked}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    Helix filtered {roi.spamBlocked} spam leads this month
                  </p>
                </div>
                <div className="card-bg rounded-xl p-4">
                  <div className="flex items-center gap-2 text-slate-400">
                    <DollarSign className="size-3.5 text-emerald-400" />
                    <span className="text-[11px] tracking-wide uppercase">Potential pipeline</span>
                  </div>
                  <p className="mt-2 text-3xl font-semibold text-white">
                    ${roi.pipelineUsd.toLocaleString("en-US")}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">Sum of estimated budget on hot leads</p>
                </div>
              </section>
            ) : null}
            <div className="card-bg rounded-t-xl p-5">
              <div className="mb-4 flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold text-white">Leads</h2>
                  <p className="text-sm text-slate-400">
                    Green = hot, amber = warm, red = cold or spam.
                  </p>
                </div>
                <div className="flex shrink-0 gap-1">
                  <button
                    type="button"
                    className={cn(
                      "rounded-md px-2 py-1 text-xs font-medium",
                      view === "table"
                        ? "bg-sky-500 text-white"
                        : "border border-sky-900/50 bg-[#0f2942] text-slate-300"
                    )}
                    onClick={() => setView("table")}
                  >
                    <span className="inline-flex items-center gap-1">
                      <Table2 className="size-3" /> Table view
                    </span>
                  </button>
                  <button
                    type="button"
                    className={cn(
                      "rounded-md px-2 py-1 text-xs font-medium",
                      view === "kanban"
                        ? "bg-sky-500 text-white"
                        : "border border-sky-900/50 bg-[#0f2942] text-slate-300"
                    )}
                    onClick={() => setView("kanban")}
                  >
                    <span className="inline-flex items-center gap-1">
                      <LayoutGrid className="size-3" /> Kanban view
                    </span>
                  </button>
                </div>
              </div>
              <div className="mb-4 flex flex-wrap gap-2">
                {filters.map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setFilter(f.id)}
                    className={cn(
                      "rounded-md px-3 py-1 text-sm font-medium transition-colors",
                      filter === f.id
                        ? "bg-sky-500 text-white"
                        : "border border-sky-900/50 bg-[#0f2942] text-slate-300 hover:bg-[#153450]"
                    )}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
              <input
                className="w-full rounded-lg border border-sky-900/50 bg-[#0a1e30] px-4 py-2 text-sm text-slate-200 placeholder-slate-500 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                placeholder="Filter name, email, source..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
              {checked.size > 0 ? (
                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <span className="text-xs text-slate-400">{checked.size} selected</span>
                  <button type="button" className={pillBtn} onClick={() => void bulk("ghl")}>
                    Send to GHL ({checked.size} selected)
                  </button>
                  <button type="button" className={pillBtn} onClick={() => void bulk("review")}>
                    Mark as reviewed
                  </button>
                  <button
                    type="button"
                    className={pillBtn}
                    onClick={() => exportCsv(leads.filter((l) => checked.has(l.id)))}
                  >
                    Export CSV
                  </button>
                  <button type="button" className={pillBtn} onClick={() => void bulk("delete")}>
                    Delete
                  </button>
                </div>
              ) : null}
            </div>
            <div className="card-bg overflow-hidden rounded-b-xl border-t-0">
              {view === "table" ? (
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-left text-sm">
                    <thead>
                      <tr className="border-b border-sky-900/30 text-slate-500">
                        <th className="w-8 px-3 py-3 font-medium">
                          <input
                            type="checkbox"
                            checked={allVisibleChecked}
                            onChange={toggleAllVisible}
                            aria-label="Select all"
                            className="accent-sky-500"
                          />
                        </th>
                        <th className="px-5 py-3 font-medium">Name</th>
                        <th className="px-5 py-3 font-medium">Email</th>
                        <th className="px-5 py-3 font-medium">Source</th>
                        <th className="px-5 py-3 font-medium">Class</th>
                        <th className="px-5 py-3 font-medium">Score</th>
                        <th className="px-5 py-3 font-medium">Conf.</th>
                        <th className="w-12 px-5 py-3 font-medium" />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-sky-900/20">
                      {visible.map((lead) => (
                        <tr
                          key={lead.id}
                          className="group relative cursor-pointer transition-colors hover:bg-white/5"
                          onClick={() => setSelected(lead)}
                        >
                          <td className={cn("absolute top-0 bottom-0 left-0 w-1", rowBar(lead))} />
                          <td
                            className="px-3 py-3 pl-6"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <input
                              type="checkbox"
                              checked={checked.has(lead.id)}
                              onChange={() => toggleCheck(lead.id)}
                              aria-label={`Select ${lead.name}`}
                              className="accent-sky-500"
                            />
                          </td>
                          <td className="px-5 py-3 font-medium text-white">{lead.name}</td>
                          <td className="px-5 py-3 text-slate-400">{lead.email}</td>
                          <td className="px-5 py-3 text-slate-400">{lead.source}</td>
                          <td className="px-5 py-3 text-slate-400">{lead.classification}</td>
                          <td className="px-5 py-3">
                            <div className="flex w-16 flex-col gap-1">
                              <span className={cn("font-medium", tierText(lead.tier))}>
                                {lead.score} · {lead.tier}
                              </span>
                              <div className="h-1 w-full overflow-hidden rounded-full bg-slate-800">
                                <div
                                  className={cn("h-full", tierBar(lead.tier))}
                                  style={{ width: `${lead.score}%` }}
                                />
                              </div>
                            </div>
                          </td>
                          <td className="px-5 py-3 text-slate-400">
                            {Math.round(lead.confidence * 100)}%
                            {lead.needsReview ? (
                              <span className="ml-1 text-[10px] font-bold text-amber-500">
                                HITL
                              </span>
                            ) : null}
                            {(lead.reingestCount ?? 0) > 0 ? (
                              <span className="ml-1 text-[10px] font-bold text-sky-400">DUP</span>
                            ) : null}
                            {(lead.competitors?.length ?? 0) > 0 ? (
                              <span className="ml-1 text-[10px] font-bold text-violet-400">VS</span>
                            ) : null}
                          </td>
                          <td className="px-5 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                            <div className="relative flex h-5 items-center justify-end gap-2">
                              <span className="absolute right-0 text-slate-500 transition-opacity group-hover:opacity-0">
                                Review
                              </span>
                              <div className="table-row-actions absolute right-0 flex gap-1 rounded bg-[#021426]/80 px-1 py-0.5 backdrop-blur-sm">
                                <button
                                  type="button"
                                  className="rounded p-1 text-white/60 transition-colors hover:bg-white/10 hover:text-white"
                                  onClick={() => setSelected(lead)}
                                  aria-label="Review"
                                >
                                  <Eye className="size-3.5" />
                                </button>
                                <button
                                  type="button"
                                  className="rounded p-1 text-white/60 transition-colors hover:bg-white/10 hover:text-white"
                                  onClick={() => setSelected(lead)}
                                  aria-label="Edit review"
                                >
                                  <Pencil className="size-3.5" />
                                </button>
                                <button
                                  type="button"
                                  className="rounded p-1 text-white/60 transition-colors hover:bg-white/10 hover:text-white"
                                  onClick={() => void sendCrm(lead.id)}
                                  aria-label="Send to GHL"
                                >
                                  <ArrowUp className="size-3.5" />
                                </button>
                              </div>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {visible.length === 0 ? (
                    <p className="px-5 py-8 text-sm text-slate-500">No leads in this filter.</p>
                  ) : null}
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-3 p-4 md:grid-cols-4">
                  {KANBAN.map((col) => {
                    const items = visible.filter((l) => col.stages.includes(stageOf(l)));
                    return (
                      <div key={col.id} className="min-h-[200px] rounded-xl bg-[#0a1e30] p-2">
                        <p className="mb-2 px-1 text-xs font-medium text-slate-400">
                          {col.label} · {items.length}
                        </p>
                        <div
                          className="space-y-2"
                          onDragOver={(e) => e.preventDefault()}
                          onDrop={(e) => {
                            e.preventDefault();
                            const id = e.dataTransfer.getData("text/lead-id");
                            const stage = col.stages[0];
                            if (id && stage) void setStage(id, stage);
                          }}
                        >
                          {items.map((lead) => (
                            <button
                              key={lead.id}
                              type="button"
                              draggable
                              onDragStart={(e) => e.dataTransfer.setData("text/lead-id", lead.id)}
                              onClick={() => setSelected(lead)}
                              className="card-bg relative w-full overflow-hidden rounded-xl p-3 text-left"
                            >
                              <span
                                className={cn("absolute top-0 bottom-0 left-0 w-1", rowBar(lead))}
                              />
                              <p className="pl-2 text-sm font-medium text-white">{lead.name}</p>
                              <p className="pl-2 text-xs text-slate-400">{lead.email}</p>
                              <p className={cn("mt-1 pl-2 text-xs font-medium", tierText(lead.tier))}>
                                {lead.score} · {lead.tier}
                              </p>
                            </button>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          <div className="flex flex-col gap-6">
            {selected ? (
              <LeadDetail
                lead={selected}
                ghlConfigured={ghlConfigured}
                onClose={() => setSelected(null)}
                onCrm={() => void sendCrm(selected.id)}
                onReview={() => void clearReview(selected.id)}
                onStage={(s) => void setStage(selected.id, s)}
                onBehavior={(kind) => void trackBehavior(selected.id, kind)}
                onPickLead={(id) => {
                  const lead = leads.find((l) => l.id === id);
                  if (lead) setSelected(lead);
                }}
                onPatched={(lead) => {
                  setSelected(lead);
                  setLeads((rows) => rows.map((r) => (r.id === lead.id ? lead : r)));
                }}
                onToast={showToast}
              />
            ) : (
              <div className="card-bg rounded-xl p-5">
                <div className="mb-4">
                  <h2 className="flex items-center gap-2 text-base font-semibold text-white">
                    <Component className="size-4 text-sky-400" />
                    Ingest lead
                  </h2>
                  <p className="mt-1 text-xs text-slate-500">JSON POST to /api/leads/ingest</p>
                </div>
                <form className="space-y-4" onSubmit={(e) => void ingest(e)}>
                  <Field label="Name">
                    <input
                      ref={nameRef}
                      required
                      className={fieldClass}
                      value={form.name}
                      onChange={(e) => setForm({ ...form, name: e.target.value })}
                    />
                  </Field>
                  <Field label="Email">
                    <input
                      required
                      type="email"
                      className={fieldClass}
                      value={form.email}
                      onChange={(e) => setForm({ ...form, email: e.target.value })}
                    />
                  </Field>
                  <Field label="Source">
                    <input
                      className={fieldClass}
                      value={form.source}
                      onChange={(e) => setForm({ ...form, source: e.target.value })}
                    />
                  </Field>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Budget">
                      <input
                        className={fieldClass}
                        value={form.budget}
                        onChange={(e) => setForm({ ...form, budget: e.target.value })}
                      />
                    </Field>
                    <Field label="Timeline">
                      <input
                        className={fieldClass}
                        value={form.timeline}
                        onChange={(e) => setForm({ ...form, timeline: e.target.value })}
                      />
                    </Field>
                  </div>
                  <Field label="Message">
                    <textarea
                      className="h-20 w-full resize-none rounded-md border border-sky-900/50 bg-[#0a1e30] px-3 py-2 text-sm text-slate-200 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                      value={form.message}
                      onChange={(e) => setForm({ ...form, message: e.target.value })}
                    />
                  </Field>
                  {error ? (
                    <span className="inline-flex items-center rounded-md bg-rose-500/15 px-2 py-1 text-xs font-medium text-rose-400">
                      Classification failed
                    </span>
                  ) : null}
                  {error ? <p className="text-sm text-rose-400">{error}</p> : null}
                  <button
                    type="submit"
                    disabled={running}
                    className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-md bg-[#38bdf8] py-2 text-sm font-semibold text-slate-900 transition-colors hover:bg-[#0ea5e9] disabled:opacity-60"
                  >
                    {running ? <Loader2 className="size-4 animate-spin" /> : null}
                    {running ? "Scoring…" : "Classify & score"}
                  </button>
                </form>
              </div>
            )}
            <div className="card-bg min-h-[120px] rounded-xl p-5">
              <h2 className="mb-2 text-base font-semibold text-white">Live pipeline</h2>
              <ol className="max-h-40 space-y-1 overflow-auto font-mono text-xs text-slate-500">
                {logs.map((log) => (
                  <li key={log.id}>
                    [{log.agent}] {log.message}
                  </li>
                ))}
                {logs.length === 0 ? <li>Waiting for ingest...</li> : null}
              </ol>
            </div>
          </div>
        </div>
      </div>

      {reactivateOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="card-bg max-h-[85vh] w-full max-w-lg overflow-auto rounded-xl p-5">
            <div className="mb-3 flex items-start justify-between">
              <h2 className="text-base font-semibold text-white">Cold lead drafts</h2>
              <button type="button" className="text-slate-500 hover:text-white" onClick={() => setReactivateOpen(false)}>
                <X className="size-4" />
              </button>
            </div>
            {reactivateDrafts.length === 0 ? (
              <p className="text-sm text-slate-400">No matching cold or archived leads older than 6 months.</p>
            ) : (
              <ul className="space-y-4">
                {reactivateDrafts.map((d) => (
                  <li key={d.id} className="rounded-lg bg-[#0a1e30] p-3">
                    <p className="text-sm font-medium text-white">
                      {d.name} · {d.email}
                    </p>
                    <p className="mt-2 whitespace-pre-wrap text-xs text-slate-300">{d.reactivation_email}</p>
                  </li>
                ))}
              </ul>
            )}
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setReactivateOpen(false)}>
                Close
              </Button>
              <Button
                disabled={reactivateDrafts.length === 0}
                onClick={() => {
                  const blob = reactivateDrafts
                    .map((d) => `To: ${d.email}\n${d.reactivation_email}`)
                    .join("\n\n---\n\n");
                  void navigator.clipboard.writeText(blob).then(() => showToast("Drafts copied"));
                  const first = reactivateDrafts[0];
                  if (first) {
                    window.location.href = `mailto:${encodeURIComponent(first.email)}?subject=${encodeURIComponent("Checking in")}&body=${encodeURIComponent(first.reactivation_email)}`;
                  }
                }}
              >
                Send Drafts
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {toast ? (
        <div className="card-bg fixed right-6 bottom-6 z-40 rounded-xl px-4 py-3 text-sm text-white">
          {toast}
        </div>
      ) : null}
    </div>
  );
}

function LeadDetail({
  lead,
  ghlConfigured,
  onClose,
  onCrm,
  onReview,
  onStage,
  onBehavior,
  onPickLead,
  onPatched,
  onToast,
}: {
  lead: StoredLead;
  ghlConfigured: boolean;
  onClose: () => void;
  onCrm: () => void;
  onReview: () => void;
  onStage: (stage: PipelineStage) => void;
  onBehavior: (kind: string) => void;
  onPickLead: (id: string) => void;
  onPatched: (lead: StoredLead) => void;
  onToast: (message: string) => void;
}) {
  const [draft, setDraft] = useState(lead.outreachDraft ?? "");
  const [likes, setLikes] = useState<{ id: string; name: string; score: number; source: string }[]>([]);
  const [slots, setSlots] = useState<{ label: string; url: string }[]>([]);
  const [emailBusy, setEmailBusy] = useState(false);
  const [scoreDraft, setScoreDraft] = useState(String(lead.score));

  useEffect(() => {
    setDraft(lead.outreachDraft ?? "");
    setScoreDraft(String(lead.score));
    setLikes([]);
    setSlots([]);
  }, [lead.id, lead.outreachDraft, lead.score]);

  const competitorNames = (lead.competitors ?? []).map((c) => c.name).filter(Boolean);
  const category = (re: RegExp, max: number) => {
    const field = lead.fields.find((f) => re.test(`${f.key} ${f.label}`));
    const pts = field ? Math.round(field.confidence * max) : Math.round((lead.score / 100) * max);
    return { pts, max, conf: field?.confidence ?? lead.confidence };
  };
  const budgetBar = category(/budget/i, 30);
  const timelineBar = category(/timeline/i, 25);
  const fitBar = category(/fit|intent|contact/i, 35);

  return (
    <div className="card-bg rounded-xl p-5">
      <div className="mb-4 flex items-start justify-between gap-2">
        <div>
          <h2 className="text-base font-semibold text-white">{lead.name}</h2>
          <p className="mt-1 text-xs text-slate-500">
            {lead.email} · {lead.source}
          </p>
        </div>
        <button
          type="button"
          className="rounded p-1 text-slate-500 hover:bg-white/5 hover:text-white"
          onClick={onClose}
          aria-label="Close detail"
        >
          <X className="size-4" />
        </button>
      </div>
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap gap-2">
          {competitorNames.length > 0 ? (
            <span className="rounded-md bg-rose-500/20 px-2 py-0.5 text-[10px] font-bold text-rose-400">
              ⚠️ Uses: {competitorNames.join(", ")}
            </span>
          ) : null}
          <span className={cn("text-sm font-medium", tierText(lead.tier))}>
            {lead.score} · {lead.tier}
          </span>
          <Badge variant="secondary">{lead.classification}</Badge>
          <Badge variant="outline">{Math.round(lead.confidence * 100)}% confidence</Badge>
          <Badge variant="outline">{lead.crmStatus}</Badge>
          {lead.needsReview ? (
            <span className="text-[10px] font-bold text-amber-500">HITL</span>
          ) : null}
          {(lead.reingestCount ?? 0) > 0 ? (
            <span className="text-[10px] font-bold text-sky-400">DUP</span>
          ) : null}
          {lead.sentiment === "positive" ? (
            <span className="text-[10px] font-bold text-emerald-400">POS</span>
          ) : null}
          {lead.sentiment === "negative" ? (
            <span className="text-[10px] font-bold text-rose-400">NEG</span>
          ) : null}
          {lead.competitors?.map((c) => (
            <span key={c.name} className="text-[10px] font-bold text-violet-400">
              VS {c.name}
            </span>
          ))}
        </div>
        {lead.assignee ? (
          <p className="text-xs text-slate-400">
            Routed to {lead.assignee}
            {lead.routingReason ? ` · ${lead.routingReason}` : ""}
          </p>
        ) : null}
        <p className="text-sm leading-relaxed text-slate-300">{lead.reasoning}</p>
        {lead.agentTrace && lead.agentTrace.length > 0 ? (
          <div>
            <p className="mb-2 text-xs tracking-wide text-slate-500 uppercase">Agent brain</p>
            <ol className="space-y-1 font-mono text-xs text-slate-500">
              {lead.agentTrace.map((run: AgentRun) => (
                <li key={`${run.agent}-${run.status}`}>
                  {run.agent}: {run.summary}
                  {run.decision ? ` → ${formatDecision(run.decision)}` : ""}
                </li>
              ))}
            </ol>
          </div>
        ) : null}
        <div>
          <p className="mb-2 text-xs tracking-wide text-slate-500 uppercase">Score breakdown</p>
          <ul className="space-y-2">
            {(
              [
                { label: "Budget", bar: budgetBar },
                { label: "Timeline", bar: timelineBar },
                { label: "Fit", bar: fitBar },
              ] as const
            ).map(({ label, bar }) => (
                <li key={label} className="rounded-lg bg-[#0a1e30] p-2">
                  <div className="flex justify-between text-sm">
                    <span>{label}</span>
                    <span className="text-slate-500">
                      {bar.pts}/{bar.max} pts
                    </span>
                  </div>
                  <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-slate-800">
                    <div
                      className={cn("h-full", tierBar(lead.tier))}
                      style={{ width: `${Math.round((bar.pts / bar.max) * 100)}%` }}
                    />
                  </div>
                </li>
              ))}
          </ul>
        </div>
        {lead.fields.length > 0 ? (
          <div>
            <p className="mb-2 text-xs tracking-wide text-slate-500 uppercase">Extracted data</p>
            <ul className="space-y-2">
              {lead.fields.map((field) => (
                <li key={field.key} className="rounded-lg bg-[#0a1e30] p-2">
                  <div className="flex justify-between text-sm">
                    <span>{field.label}</span>
                    <span className="text-slate-500">{Math.round(field.confidence * 100)}%</span>
                  </div>
                  <p className="text-sm">{field.value}</p>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        <div>
          <p className="mb-2 text-xs tracking-wide text-slate-500 uppercase">Activity</p>
          <ol className="space-y-1 font-mono text-xs text-slate-500">
            {(lead.scoreHistory ?? []).map((h, i) => (
              <li key={`${h.at}-${i}`}>
                {new Date(h.at).toLocaleDateString("en-US")} · {h.score} ({h.tier}) — {h.reason}
              </li>
            ))}
            {(lead.scoreHistory?.length ?? 0) === 0 ? (
              <>
                <li>Ingested {new Date(lead.createdAt).toLocaleString("en-US")}</li>
                <li>
                  Classified {lead.classification} · {lead.tier}
                </li>
              </>
            ) : null}
            <li>Stage {stageOf(lead)}</li>
            <li>CRM {lead.crmStatus}</li>
          </ol>
        </div>
        {lead.enrichment ? (
          <div>
            <p className="mb-2 text-xs tracking-wide text-slate-500 uppercase">Enrichment</p>
            <ul className="space-y-1 text-xs text-slate-400">
              <li>{lead.enrichment.company} · {lead.enrichment.industry}</li>
              <li>
                {lead.enrichment.employees} · {lead.enrichment.revenue}
              </li>
              {lead.enrichedIndustry || lead.enrichedSize || lead.enrichedCountry ? (
                <li>
                  Domain: {lead.enrichedIndustry ?? "—"} · {lead.enrichedSize ?? "—"} ·{" "}
                  {lead.enrichedCountry ?? "—"}
                </li>
              ) : null}
              {lead.enrichment.techStack.length > 0 ? (
                <li>Stack: {lead.enrichment.techStack.join(", ")}</li>
              ) : null}
              <li>
                <a
                  className="text-sky-400 hover:text-sky-300"
                  href={lead.enrichment.linkedin}
                  target="_blank"
                  rel="noreferrer"
                >
                  LinkedIn search
                </a>
              </li>
            </ul>
          </div>
        ) : null}
        {lead.decisionMaker || lead.meetingIntent ? (
          <div className="text-xs text-slate-400">
            {lead.decisionMaker ? <p>Decision: {lead.decisionMaker}</p> : null}
            {lead.meetingIntent ? <p>Meeting intent detected — offer a demo slot.</p> : null}
            {lead.language ? <p>Language: {lead.language}</p> : null}
          </div>
        ) : lead.language ? (
          <p className="text-xs text-slate-400">Language: {lead.language}</p>
        ) : null}
        {lead.followUp ? (
          <div>
            <p className="mb-1 text-xs tracking-wide text-slate-500 uppercase">Follow-up</p>
            <p className="text-xs text-slate-400">
              {lead.followUp.delay} · {lead.followUp.status} — {lead.followUp.preview}
            </p>
          </div>
        ) : null}
        {competitorNames.length > 0 ? (
          <details className="rounded-lg bg-[#0a1e30] p-2">
            <summary className="cursor-pointer text-xs tracking-wide text-slate-400 uppercase">
              Battle Card
            </summary>
            <p className="mt-2 whitespace-pre-wrap text-xs text-slate-300">
              {lead.battleCard ||
                lead.competitors?.flatMap((c) => c.talkingPoints).map((p) => `• ${p}`).join("\n")}
            </p>
          </details>
        ) : null}
        <div>
          <p className="mb-2 text-xs tracking-wide text-slate-500 uppercase">Behavior</p>
          <div className="flex flex-wrap gap-1">
            {[
              ["email_open", "Email open +5"],
              ["link_click", "Link +10"],
              ["pricing_visit", "Pricing +15"],
              ["email_reply", "Reply +12"],
              ["no_reply_7d", "No reply −10"],
            ].map(([kind, label]) => (
              <button
                key={kind}
                type="button"
                className="rounded-md border border-sky-900/50 bg-[#0f2942] px-2 py-0.5 text-[11px] font-medium text-slate-300 hover:bg-[#153450]"
                onClick={() => onBehavior(kind)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        {lead.message ? (
          <div>
            <p className="mb-1 text-xs tracking-wide text-slate-500 uppercase">Message</p>
            <p className="text-sm">{lead.message}</p>
          </div>
        ) : null}
        <div>
          <p className="mb-2 text-xs tracking-wide text-slate-500 uppercase">Pipeline</p>
          <div className="flex flex-wrap gap-1">
            {(["new", "qualified", "contacted", "won", "lost"] as PipelineStage[]).map((s) => (
              <button
                key={s}
                type="button"
                className={cn(
                  "rounded-md px-2 py-0.5 text-[11px] font-medium",
                  stageOf(lead) === s
                    ? "bg-sky-500 text-white"
                    : "border border-sky-900/50 bg-[#0f2942] text-slate-300"
                )}
                onClick={() => onStage(s)}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
        <div className="flex flex-col gap-2">
          {lead.needsReview ? (
            <Button variant="secondary" onClick={onReview}>
              Mark reviewed
            </Button>
          ) : null}
          <Button onClick={onCrm} disabled={lead.crmStatus === "sent"}>
            <Send className="size-4" />
            {lead.crmStatus === "sent"
              ? "Sent to GHL"
              : ghlConfigured
                ? "Send to GHL"
                : "Send to GHL (mock)"}
          </Button>
          <Button
            variant="secondary"
            disabled={emailBusy}
            onClick={() => {
              setEmailBusy(true);
              void fetch("/api/generate-email", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ id: lead.id }),
              })
                .then((r) => r.json())
                .then((d: { draft?: string; lead?: StoredLead }) => {
                  setDraft(d.draft ?? "");
                  if (d.lead) onPatched(d.lead);
                })
                .finally(() => setEmailBusy(false));
            }}
          >
            {emailBusy ? "Generating…" : "Generate Outreach Email"}
          </Button>
          <div className="flex items-center gap-2">
            <input
              className={cn(fieldClass, "h-8 w-16")}
              value={scoreDraft}
              onChange={(e) => setScoreDraft(e.target.value)}
              aria-label="Edit score"
            />
            <Button
              variant="secondary"
              onClick={() => {
                void fetch(`/api/leads/${lead.id}/score`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ score: Number(scoreDraft) }),
                })
                  .then((r) => r.json())
                  .then((d: { lead?: StoredLead }) => {
                    if (d.lead) onPatched(d.lead);
                    onToast("Score updated");
                  });
              }}
            >
              <Pencil className="size-3.5" />
              Edit Score
            </Button>
          </div>
          <Button
            variant="secondary"
            onClick={() => {
              void fetch(`/api/leads/${lead.id}/archive`, { method: "POST" })
                .then((r) => r.json())
                .then((d: { lead?: StoredLead }) => {
                  if (d.lead) onPatched(d.lead);
                  onToast("Archived");
                });
            }}
          >
            Archive
          </Button>
          {lead.score >= 85 ? (
            <Button
              variant="secondary"
              onClick={() => {
                void fetch(`/api/leads/${lead.id}/outreach`, { method: "POST" })
                  .then((r) => r.json())
                  .then((d: { draft?: string }) => setDraft(d.draft ?? ""));
              }}
            >
              Draft outreach
            </Button>
          ) : null}
          <Button
            variant="secondary"
            onClick={() => {
              void fetch(`/api/leads/${lead.id}/lookalike`)
                .then((r) => r.json())
                .then((d: { likes?: { id: string; name: string; score: number; source: string }[] }) =>
                  setLikes(d.likes ?? [])
                );
            }}
          >
            Find lookalikes
          </Button>
          {lead.score > 90 || lead.meetingIntent ? (
            <Button
              variant="secondary"
              onClick={() => {
                void fetch(`/api/leads/${lead.id}/meeting`, { method: "POST" })
                  .then((r) => r.json())
                  .then((d: { slots?: { label: string; url: string }[] }) => setSlots(d.slots ?? []));
              }}
            >
              Suggest meeting slots
            </Button>
          ) : null}
        </div>
        {draft ? (
          <div className="space-y-2">
            <Textarea
              className="min-h-32 border-sky-900/50 bg-[#0a1e30] text-xs text-slate-200"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
            />
            <div className="flex gap-2">
              <Button
                variant="secondary"
                onClick={() => {
                  void navigator.clipboard.writeText(draft).then(() => onToast("Copied"));
                }}
              >
                <Copy className="size-3.5" />
                Copy
              </Button>
              <Button
                variant="secondary"
                onClick={() => {
                  const lines = draft.split("\n");
                  const subject = lines[0]?.replace(/^Subject:\s*/i, "") ?? "";
                  const body = lines.slice(2).join("\n");
                  window.location.href = `mailto:${encodeURIComponent(lead.email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
                }}
              >
                Send
              </Button>
            </div>
          </div>
        ) : null}
        {likes.length > 0 ? (
          <div>
            <p className="mb-1 text-xs tracking-wide text-slate-500 uppercase">Lookalikes</p>
            <ul className="space-y-1 text-xs text-slate-400">
              {likes.map((l) => (
                <li key={l.id}>
                  <button type="button" className="hover:text-sky-300" onClick={() => onPickLead(l.id)}>
                    {l.name} · {l.score} · {l.source}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        {slots.length > 0 ? (
          <div>
            <p className="mb-1 text-xs tracking-wide text-slate-500 uppercase">Meeting</p>
            <ul className="space-y-1 text-xs">
              {slots.map((s) => (
                <li key={s.url}>
                  <a className="text-sky-400 hover:text-sky-300" href={s.url} target="_blank" rel="noreferrer">
                    {s.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function MetricCard({
  icon,
  label,
  value,
  hint,
  delta,
  spark,
  action,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  hint: string;
  delta: string;
  spark: string;
  action?: ReactNode;
}) {
  return (
    <div className="card-bg relative isolate flex h-[120px] flex-col overflow-hidden rounded-xl p-4">
      <svg
        className="glow-line pointer-events-none absolute inset-x-0 bottom-0 z-0 h-8 w-full"
        preserveAspectRatio="none"
        viewBox="0 0 100 30"
        aria-hidden
      >
        <path d={`${spark} L 100 30 L 0 30 Z`} fill="url(#cyan-gradient)" opacity="0.2" />
        <path
          d={spark}
          fill="none"
          stroke="#38bdf8"
          strokeLinecap="round"
          strokeWidth="1.5"
        />
      </svg>
      <div className="relative z-10 space-y-1">
        <div className="flex items-center gap-2 text-xs font-medium text-slate-400">
          {icon}
          {label}
        </div>
        <div className="text-2xl font-semibold leading-tight text-white">{value}</div>
        <div className="text-[11px] leading-tight text-emerald-400">{delta}</div>
        {action ? (
          <div>{action}</div>
        ) : (
          <div className="text-xs text-slate-500">{hint}</div>
        )}
      </div>
    </div>
  );
}

function OnboardingCard({ ghlConfigured }: { ghlConfigured: boolean }) {
  const [state, setState] = useState({ crm: false, scoring: false, team: false });

  useEffect(() => {
    setState(readOnboarding());
  }, []);

  useEffect(() => {
    if (!ghlConfigured) return;
    setState((s) => {
      if (s.crm) return s;
      const next = { ...s, crm: true };
      writeOnboarding(next);
      return next;
    });
  }, [ghlConfigured]);

  const items = [
    { id: "crm", label: "Connect CRM", done: state.crm },
    { id: "scoring", label: "Configure scoring rules", done: state.scoring },
    { id: "team", label: "Invite team members", done: state.team },
  ] as const;
  const pct = Math.round((items.filter((i) => i.done).length / items.length) * 100);

  return (
    <div className="card-bg rounded-xl p-4">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-sm font-medium text-white">Setup progress: {pct}%</p>
        <div className="h-1 w-32 overflow-hidden rounded-full bg-slate-800">
          <div className="h-full bg-sky-400" style={{ width: `${pct}%` }} />
        </div>
      </div>
      <ul className="flex flex-wrap gap-3 text-xs text-slate-400">
        {items.map((item) => (
          <li key={item.id}>
            <button
              type="button"
              className="hover:text-sky-300"
              onClick={() => {
                const next = { ...state, [item.id]: !item.done };
                writeOnboarding(next);
                setState(next);
              }}
            >
              {item.done ? "[x]" : "[ ]"} {item.label}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-slate-300">{label}</label>
      {children}
    </div>
  );
}
