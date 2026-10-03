"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CampaignAction, StoredCampaign } from "@helix/core";
import { isSnoozed, snoozeId } from "@/lib/desk-prefs";
import { useDeskWindow } from "@/lib/use-desk-snapshot";
import { recommendedSpend } from "@/lib/desk-derive";
import { DemoChip } from "@helix/ui";
import { ReviewCharts, useDemoMode } from "@/components/desk-charts";
import { money } from "@/lib/format";
import { cn } from "@/lib/utils";

type Candidate = {
  id: string;
  campaignId: string;
  storeId: string;
  platform: "meta" | "google" | "other";
  title: string;
  blurb: string;
  confidence: number;
  current: number;
  recommended: number;
  deltaLabel: string;
  deltaTone: "up" | "down" | "pause";
  kind: CampaignAction;
  real: StoredCampaign;
};

function mapCampaign(c: StoredCampaign): Candidate {
  const current = Math.max(0, Math.round(c.spend));
  const recommended = recommendedSpend(c);
  // confidence exactly as the engine reports it: no floor, no cap
  const conf = Math.round(c.confidence * 1000) / 10;
  return {
    id: c.id,
    campaignId: c.campaignId,
    storeId: c.id,
    platform: c.platform === "google" ? "google" : c.platform === "meta" ? "meta" : "other",
    title:
      c.action === "scale"
        ? `Scale: ${c.name}`
        : c.action === "pause"
          ? `Pause: ${c.name}`
          : `Review: ${c.name}`,
    blurb:
      c.reasoning ||
      `Avg score ${Math.round(c.metrics.avgScore)} · ${c.metrics.nLeads} leads · cost/hot ${
        c.metrics.costPerHot != null ? money(c.metrics.costPerHot) : "—"
      }`,
    confidence: conf,
    current,
    recommended,
    deltaLabel:
      c.action === "pause"
        ? "PAUSE"
        : c.action === "scale"
          ? `+${Math.round(((recommended - current) / Math.max(1, current)) * 100)}%`
          : "KEEP",
    deltaTone: c.action === "pause" ? "pause" : "up",
    kind: c.action,
    real: c,
  };
}

function PlatformPill({ platform }: { platform: Candidate["platform"] }) {
  if (platform === "meta") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-[#3131c0]/40 px-2 py-0.5 font-mono text-[11px] font-bold text-[#c0c1ff]">
        <span className="size-1.5 rounded-full bg-[#c0c1ff]" />
        Meta Ads
      </span>
    );
  }
  if (platform === "google") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-primary-container/20 px-2 py-0.5 font-mono text-[11px] font-bold text-marketing-amber">
        <span className="size-1.5 rounded-full bg-primary-container" />
        Google Ads
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-surface-container-highest px-2 py-0.5 font-mono text-[11px] font-bold text-on-surface">
      <span className="size-1.5 rounded-full bg-on-surface" />
      Other
    </span>
  );
}

function TrajectoryChart({ liftPct }: { liftPct: number }) {
  return (
    <div className="relative space-y-3 rounded-lg bg-obsidian-base p-3 shadow-inner">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <span className="text-[16px] font-semibold text-on-surface">
            Spend trajectory sketch <DemoChip kind="illustrative" />
          </span>
          <p className="font-mono text-[11px] text-outline">
            Not a forecast: a sketch of the intended change · lift ~{liftPct.toFixed(0)}% vs baseline
          </p>
        </div>
        <div className="flex items-center gap-4 font-mono text-[11px]">
          <span className="flex items-center gap-1.5 text-on-surface-variant">
            <span className="h-0.5 w-3 border-b border-dashed border-outline" /> Baseline
          </span>
          <span className="flex items-center gap-1.5 font-semibold text-marketing-amber">
            <span className="h-1 w-3 rounded bg-primary-container shadow-[0_0_8px_rgba(249,115,22,0.6)]" />{" "}
            Helix Engine
          </span>
        </div>
      </div>
      <div className="relative h-48 w-full pt-2">
        <svg className="h-full w-full" viewBox="0 0 600 180" preserveAspectRatio="none" fill="none">
          <defs>
            <linearGradient id="areaGlow" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="#f97316" stopOpacity="0.25" />
              <stop offset="100%" stopColor="#f97316" stopOpacity="0" />
            </linearGradient>
            <linearGradient id="lineGlow" x1="0" x2="1" y1="0" y2="0">
              <stop offset="0%" stopColor="#fb923c" />
              <stop offset="50%" stopColor="#f97316" />
              <stop offset="100%" stopColor="#ffb690" />
            </linearGradient>
          </defs>
          {[30, 75, 120].map((y) => (
            <line key={y} x1="40" x2="580" y1={y} y2={y} stroke="rgba(255,255,255,0.05)" />
          ))}
          <line
            x1="310"
            x2="310"
            y1="15"
            y2="150"
            stroke="#f97316"
            strokeDasharray="3 3"
            strokeWidth="1.5"
            opacity="0.6"
          />
          <rect x="280" y="8" width="60" height="18" rx="3" fill="#161824" />
          <text
            x="310"
            y="21"
            textAnchor="middle"
            fill="#f97316"
            fontFamily="monospace"
            fontSize="9"
            fontWeight="600"
          >
            T-0 (NOW)
          </text>
          <path
            d="M 40 95 Q 150 100 230 110 T 310 125 T 450 145 T 580 160"
            stroke="#64748b"
            strokeDasharray="4 4"
            strokeWidth="1.5"
          />
          <path
            d="M 40 95 Q 150 100 230 110 L 310 125 Q 400 70 480 48 T 580 32 L 580 170 L 40 170 Z"
            fill="url(#areaGlow)"
          />
          <path
            d="M 40 95 Q 150 100 230 110 L 310 125 Q 400 70 480 48 T 580 32"
            stroke="url(#lineGlow)"
            strokeWidth="3"
            strokeLinecap="round"
          />
          <circle cx="310" cy="125" r="5" fill="#f97316" stroke="#fff" strokeWidth="2" />
          <circle cx="560" cy="35" r="4.5" fill="#10b981" stroke="#fff" strokeWidth="2" />
        </svg>
        <div className="flex items-center justify-between px-4 pt-1 font-mono text-[11px] text-outline">
          <span>Day −7</span>
          <span className="font-semibold text-primary-container">T-0 Execution</span>
          <span className="font-semibold text-success-emerald">Day +7</span>
        </div>
      </div>
    </div>
  );
}

export function HitlReviewDesk() {
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [win] = useDeskWindow();
  const demo = useDemoMode();
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [budget, setBudget] = useState(0);
  const [filter, setFilter] = useState<"all" | "high" | "meta">("all");
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [metaReady, setMetaReady] = useState(false);
  const [sandboxMode, setSandboxMode] = useState(false);
  const [simResult, setSimResult] = useState<{
    spend: number;
    delta: number;
    deltaPct: string;
    kind: string;
    title: string;
  } | null>(null);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 3200);
  }, []);

  const loadSeq = useRef(0);
  const load = useCallback(async () => {
    const seq = ++loadSeq.current;
    setLoading(true);
    try {
      const [campRes, syncRes] = await Promise.all([
        fetch(`/api/campaigns?window=${win}`),
        fetch("/api/ads/sync"),
      ]);
      const d = (await campRes.json()) as { campaigns?: StoredCampaign[] };
      const s = (await syncRes.json()) as { metaConfigured?: boolean };
      // the window can change while a request is in flight; only the latest one may write state
      if (seq !== loadSeq.current) return;
      setMetaReady(Boolean(s.metaConfigured));
      const mapped = (d.campaigns ?? [])
        .filter((c) => c.needsReview && !isSnoozed(c.id))
        .map(mapCampaign);
      setCandidates(mapped);
      setSelectedId((prev) => {
        if (prev && mapped.some((c) => c.id === prev)) return prev;
        return mapped[0]?.id ?? null;
      });
      if (mapped[0]) setBudget(mapped[0].recommended);
    } catch {
      showToast("Failed to load review queue");
    } finally {
      setLoading(false);
    }
  }, [showToast, win]);

  useEffect(() => {
    void load();
  }, [load]);

  const selected = candidates.find((c) => c.id === selectedId) ?? null;
  const floor = selected?.current ?? 0;

  useEffect(() => {
    if (selected) setBudget(selected.recommended);
    setSimResult(null);
  }, [selectedId]); // eslint-disable-line react-hooks/exhaustive-deps

  const delta = budget - floor;
  const deltaPct = floor > 0 ? ((delta / floor) * 100).toFixed(1) : "0.0";
  const liftPct =
    selected?.kind === "scale" ? Math.max(5, Math.abs(Number(deltaPct))) : selected?.kind === "pause" ? 12 : 4;

  const visible = useMemo(() => {
    return candidates.filter((c) => {
      if (filter === "high") return c.confidence >= 90;
      if (filter === "meta") return c.platform === "meta";
      return true;
    });
  }, [candidates, filter]);

  const removeFromQueue = useCallback((id: string) => {
    setCandidates((list) => {
      const next = list.filter((c) => c.id !== id);
      setSelectedId((prev) => (prev === id ? next[0]?.id ?? null : prev));
      return next;
    });
  }, []);

  async function postReview(
    c: Candidate,
    action: CampaignAction,
    opts?: { writeAds?: boolean; note?: string }
  ) {
    const res = await fetch(`/api/campaigns/${c.storeId}/review`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action,
        note:
          opts?.note ||
          `HITL ${action} · budget override $${budget}/day (floor $${floor})`,
        writeAds: opts?.writeAds ?? !sandboxMode,
      }),
    });
    const data = (await res.json()) as {
      error?: string;
      adsWrite?: { attempted: boolean; ok: boolean; detail: string };
    };
    if (!res.ok) throw new Error(data.error || "Review failed");
    return data;
  }

  async function approve() {
    if (!selected) return;
    setBusy(true);
    try {
      const action: CampaignAction =
        selected.kind === "pause" || selected.kind === "scale" ? selected.kind : "keep";
      const data = await postReview(selected, action, { writeAds: !sandboxMode });
      const w = data.adsWrite;
      if (sandboxMode) {
        showToast(`Sandbox: ${action} saved locally (no ads write) · $${budget}/day`);
      } else if (w?.attempted && w.ok) {
        showToast(`Approved + Meta: ${w.detail}`);
      } else if (w?.attempted && !w.ok) {
        showToast(`Saved locally; ads write failed: ${w.detail}`);
      } else {
        showToast(w?.detail || `Approved ${action} · $${budget}/day`);
      }
      removeFromQueue(selected.id);
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Approve failed");
    } finally {
      setBusy(false);
    }
  }

  async function reject() {
    if (!selected) return;
    setBusy(true);
    try {
      await postReview(selected, "keep", {
        writeAds: false,
        note: `HITL rejected recommended ${selected.kind} · kept as-is`,
      });
      showToast("Rejected — recommendation discarded (keep)");
      removeFromQueue(selected.id);
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Reject failed");
    } finally {
      setBusy(false);
    }
  }

  function snooze() {
    if (!selected) return;
    snoozeId(selected.id, 4);
    showToast("Snoozed 4h (hidden from queue)");
    removeFromQueue(selected.id);
  }

  async function batchApprove() {
    const batch = visible.filter((c) => c.kind === "pause" || c.kind === "scale" || c.kind === "keep");
    if (batch.length === 0) {
      showToast("Nothing to batch-approve");
      return;
    }
    setBusy(true);
    let ok = 0;
    let fail = 0;
    for (const c of batch) {
      try {
        const action: CampaignAction =
          c.kind === "pause" || c.kind === "scale" ? c.kind : "keep";
        await postReview(c, action, {
          writeAds: !sandboxMode,
          note: `HITL batch ${action}`,
        });
        ok += 1;
        removeFromQueue(c.id);
      } catch {
        fail += 1;
      }
    }
    setBusy(false);
    showToast(`Batch done: ${ok} ok${fail ? `, ${fail} failed` : ""}${sandboxMode ? " (sandbox)" : ""}`);
    await load();
  }

  function runSandboxSim() {
    if (!selected) {
      showToast("Select a candidate first");
      return;
    }
    const result = {
      spend: budget,
      delta,
      deltaPct,
      kind: selected.kind,
      title: selected.title,
    };
    setSimResult(result);
    showToast(
      `Sandbox sim: ${selected.kind} · ${selected.title} · Δ ${
        delta >= 0 ? "+" : ""
      }$${delta}/day (${deltaPct}%) · writeAds=${!sandboxMode ? "would fire on Approve" : "off"}`
    );
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (busy) return;
      if (e.key === "a" || e.key === "A") void approve();
      if (e.key === "r" || e.key === "R") void reject();
      if (e.key === "s" || e.key === "S") {
        setSandboxMode((v) => {
          showToast(v ? "Sandbox off — Approve may write Meta" : "Sandbox on — local only");
          return !v;
        });
      }
      if (e.key === "j" || e.key === "J") {
        const i = visible.findIndex((c) => c.id === selectedId);
        if (i < visible.length - 1) setSelectedId(visible[i + 1].id);
      }
      if (e.key === "k" || e.key === "K") {
        const i = visible.findIndex((c) => c.id === selectedId);
        if (i > 0) setSelectedId(visible[i - 1].id);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, visible, budget, busy, sandboxMode, selected]);

  const risk =
    candidates.length === 0
      ? 0
      : Math.min(
          1,
          candidates.reduce((s, c) => s + (c.kind === "pause" ? 0.15 : 0.05), 0) / candidates.length
        );

  return (
    <div className="flex w-full flex-col gap-5 pb-20 text-on-surface">
      {toast ? (
        <div className="fixed right-6 bottom-24 z-50 max-w-sm rounded-lg border border-[var(--border-hairline)] bg-surface-container-high px-4 py-2.5 text-xs shadow-2xl">
          {toast}
        </div>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 font-mono text-[11px] tracking-wider uppercase">
          <span className="text-outline">Control Plane</span>
          <span className="text-outline">/</span>
          <span className="text-on-surface-variant">HITL Queue</span>
          <span className="text-outline">/</span>
          <span className="font-semibold text-primary">{candidates.length} pending</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[#161824] px-2.5 py-1 font-mono text-[11px] text-marketing-amber shadow-sm">
            <span className="size-1.5 animate-ping rounded-full bg-marketing-amber" />
            {candidates.length > 0 ? "Review Mandate Active" : "Queue Clear"}
          </span>
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded-full px-2.5 py-1 font-mono text-[11px]",
              sandboxMode
                ? "bg-tertiary/15 text-tertiary"
                : "bg-surface-container-high text-on-surface-variant"
            )}
          >
            <span className="material-symbols-outlined text-[14px]">shield</span>
            {sandboxMode ? "Sandbox: Local Only" : metaReady ? "Meta Write: Armed" : "Meta Write: Needs Keys"}
          </span>
        </div>
      </div>

      <div className="relative overflow-hidden rounded-xl bg-surface-container-low p-4 shadow-md">
        <div className="pointer-events-none absolute -top-16 -right-16 size-80 rounded-full bg-primary-container/5 blur-3xl" />
        <div className="relative z-10 flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
          <div className="max-w-3xl space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-[32px] leading-10 font-semibold tracking-tight text-on-surface">
                HITL Action Verification Queue
              </h1>
            </div>
            <p className="max-w-2xl text-[13px] leading-5 text-on-surface-variant">
              Confirm pause / scale / keep from the scoring engine. Approve writes to Meta when keys are set
              and campaign ids are numeric. Budget slider is recorded in the HITL note (Meta scale still uses
              +20% daily_budget when writable).
            </p>
          </div>
          <div className="relative z-10 flex shrink-0 flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={runSandboxSim}
              className="flex h-9 items-center gap-2 rounded-lg bg-surface-container px-3 text-xs font-medium text-on-surface shadow-sm hover:bg-surface-container-high"
            >
              <span className="material-symbols-outlined text-[18px] text-tertiary">science</span>
              Simulation Sandbox
            </button>
            <button
              type="button"
              onClick={() => setSandboxMode((v) => !v)}
              className={cn(
                "flex h-9 items-center gap-2 rounded-lg px-3 text-xs font-medium shadow-sm",
                sandboxMode
                  ? "bg-tertiary/20 text-tertiary"
                  : "bg-surface-container text-on-surface hover:bg-surface-container-high"
              )}
            >
              <span className="material-symbols-outlined text-[18px]">
                {sandboxMode ? "science" : "cloud_upload"}
              </span>
              {sandboxMode ? "Sandbox ON" : "Sandbox OFF"}
            </button>
            <button
              type="button"
              disabled={busy || visible.length === 0}
              onClick={() => void batchApprove()}
              className="flex h-9 items-center gap-2 rounded-lg bg-primary-container px-4 text-xs font-semibold text-on-primary-container shadow-[0_0_20px_rgba(249,115,22,0.3)] hover:bg-marketing-amber disabled:opacity-50"
            >
              <span className="material-symbols-outlined text-[18px]">verified_user</span>
              Deploy Approved ({visible.length})
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="relative overflow-hidden rounded-lg bg-obsidian-raised p-3 shadow-sm">
          <div className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-marketing-amber via-primary-container to-transparent opacity-80" />
          <div className="mb-2 flex items-center justify-between text-outline">
            <span className="text-[11px] font-medium tracking-wide uppercase">Pending Actions</span>
            <span className="material-symbols-outlined text-[18px] text-marketing-amber">pending_actions</span>
          </div>
          <span className="text-[32px] leading-10 font-semibold text-on-surface">
            {loading ? "…" : candidates.length}
          </span>
          <div className="mt-2 font-mono text-[11px] text-outline">needsReview · {win} window</div>
        </div>
        <div className="relative overflow-hidden rounded-lg bg-obsidian-raised p-3 shadow-sm">
          <div className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-success-emerald via-tertiary to-transparent opacity-70" />
          <div className="mb-2 text-[11px] font-medium tracking-wide text-outline uppercase">
            Est. Budget Delta (selected)
          </div>
          <span className="text-[32px] leading-10 font-semibold text-on-surface">
            {selected ? `${delta >= 0 ? "+" : ""}${money(delta)}` : "—"}
          </span>
          <div className="mt-2 font-mono text-[11px] text-outline">
            {selected ? `${deltaPct}% vs current floor` : "Select a candidate"}
          </div>
        </div>
        <div className="relative overflow-hidden rounded-lg bg-obsidian-raised p-3 shadow-sm">
          <div className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-[#c0c1ff] via-[#3131c0] to-transparent opacity-60" />
          <div className="mb-2 text-[11px] font-medium tracking-wide text-outline uppercase">
            Aggregated Risk
          </div>
          <span className="text-[32px] leading-10 font-semibold text-on-surface">
            {risk.toFixed(2)}
          </span>
          <div className="mt-2 font-mono text-[11px] text-outline">pause-weighted / queue</div>
        </div>
        <div className="relative overflow-hidden rounded-lg bg-obsidian-raised p-3 shadow-sm">
          <div className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-tertiary via-[#00a9c5] to-transparent opacity-60" />
          <div className="mb-2 text-[11px] font-medium tracking-wide text-outline uppercase">Meta Ready</div>
          <span className="text-[32px] leading-10 font-semibold text-on-surface">
            {metaReady ? "Yes" : "No"}
          </span>
          <div className="mt-2 font-mono text-[11px] text-outline">
            {metaReady ? "Insights + write keys present" : "Configure in Settings"}
          </div>
        </div>
      </div>

      <ReviewCharts campaigns={candidates.map((c) => c.real)} ctx={{ demo, win, from: "", to: "" }} />

      <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-12">
        <div className="flex flex-col gap-4 lg:col-span-5">
          <div className="space-y-3 rounded-lg bg-surface-container-low p-3 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[20px] text-primary-container">tune</span>
                <span className="text-[16px] font-semibold text-on-surface">Dispatch Candidates</span>
              </div>
              <button
                type="button"
                onClick={() => void load()}
                className="font-mono text-[11px] text-tertiary hover:underline"
              >
                Refresh
              </button>
            </div>
            <div className="flex gap-1.5 overflow-x-auto pb-1">
              {(
                [
                  { id: "all" as const, label: `All (${candidates.length})` },
                  { id: "high" as const, label: "Confidence ≥ 90%" },
                  { id: "meta" as const, label: "Meta only" },
                ] as const
              ).map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setFilter(f.id)}
                  className={cn(
                    "shrink-0 rounded-full px-2.5 py-1 font-mono text-[11px] transition-colors",
                    filter === f.id
                      ? "bg-primary-container font-semibold text-on-primary-container shadow-sm"
                      : "bg-surface-container-high text-on-surface-variant hover:bg-surface-bright"
                  )}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            {loading ? (
              <div className="rounded-lg bg-obsidian-raised p-6 text-center text-sm text-on-surface-variant">
                Loading review queue…
              </div>
            ) : null}
            {!loading && visible.length === 0 ? (
              <div className="rounded-lg bg-obsidian-raised p-6 text-center text-sm text-on-surface-variant">
                Queue clear — no campaigns need review in the {win} window.
                <div className="mt-3">
                  <a href="/" className="text-primary-container hover:underline">
                    ← Performance Engine
                  </a>
                </div>
              </div>
            ) : null}
            {visible.map((c) => {
              const on = c.id === selectedId;
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setSelectedId(c.id)}
                  className={cn(
                    "relative w-full rounded-lg p-3 text-left shadow-sm transition-all",
                    on
                      ? "bg-gradient-to-r from-primary-container/10 via-[#161824] to-[#161824] shadow-md"
                      : "bg-obsidian-raised hover:bg-[#161824]"
                  )}
                >
                  {on ? (
                    <div className="absolute top-0 bottom-0 left-0 w-1 rounded-l bg-primary-container" />
                  ) : null}
                  <div className="mb-1 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                      <PlatformPill platform={c.platform} />
                      <span className="font-mono text-[11px] text-outline">#{c.campaignId}</span>
                    </div>
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 font-mono text-[11px] font-semibold",
                        c.confidence >= 90
                          ? "bg-success-emerald/15 text-success-emerald"
                          : "bg-marketing-amber/15 text-marketing-amber"
                      )}
                    >
                      {c.confidence.toFixed(1)}%
                    </span>
                  </div>
                  <h3 className="mt-1 mb-1 text-[16px] font-semibold text-on-surface">{c.title}</h3>
                  <p className="mb-3 line-clamp-2 text-[11px] text-on-surface-variant">{c.blurb}</p>
                  <div className="flex items-center justify-between rounded bg-surface-container-lowest p-2 font-mono text-[11px]">
                    <div>
                      <span className="block text-outline">Current / Rec.</span>
                      <span className="font-semibold text-on-surface">
                        {money(c.current)} →{" "}
                        <span className="text-primary-container">{money(c.recommended)}</span>
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="block text-outline">Action</span>
                      <span
                        className={cn(
                          "font-bold uppercase",
                          c.deltaTone === "pause" ? "text-alert-rose" : "text-success-emerald"
                        )}
                      >
                        {c.kind}
                      </span>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex flex-col gap-4 lg:col-span-7">
          {selected ? (
            <div className="relative flex flex-col overflow-hidden rounded-xl bg-obsidian-raised shadow-xl">
              <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-primary-container via-marketing-amber to-[#c0c1ff]" />
              <div className="space-y-2 bg-surface-container-low p-5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="rounded bg-primary-container/20 px-2 py-0.5 font-mono text-[11px] font-bold tracking-wider text-marketing-amber">
                      RECOMMENDED · {selected.kind.toUpperCase()}
                    </span>
                    <span className="font-mono text-[11px] text-outline">#{selected.campaignId}</span>
                  </div>
                  <span className="font-mono text-[11px] font-semibold text-success-emerald">
                    {selected.confidence.toFixed(1)}% confidence
                  </span>
                </div>
                <h2 className="text-[28px] leading-8 font-semibold text-on-surface">{selected.title}</h2>
                <p className="text-[12px] text-on-surface-variant">{selected.blurb}</p>
                <div className="flex flex-wrap gap-x-4 gap-y-1 pt-1 text-[12px] text-on-surface-variant">
                  <span>
                    Platform: <strong className="text-on-surface">{selected.platform}</strong>
                  </span>
                  <span>
                    Spend: <strong className="text-on-surface">{money(selected.current)}</strong>
                  </span>
                  <a className="text-primary-container hover:underline" href={`/campaigns/${selected.campaignId}`}>
                    Open campaign →
                  </a>
                </div>
                {simResult ? (
                  <div className="mt-3 rounded-lg border border-tertiary/30 bg-tertiary/10 px-3 py-2.5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-mono text-[11px] font-bold tracking-wider text-tertiary uppercase">
                        Simulation result
                      </span>
                      <button
                        type="button"
                        onClick={() => setSimResult(null)}
                        className="font-mono text-[11px] text-outline hover:text-on-surface"
                      >
                        Dismiss
                      </button>
                    </div>
                    <p className="mt-1 text-[12px] text-on-surface">
                      Projected{" "}
                      <strong>{money(simResult.spend)}</strong>/day · Δ{" "}
                      <strong className={simResult.delta >= 0 ? "text-success-emerald" : "text-alert-rose"}>
                        {simResult.delta >= 0 ? "+" : ""}
                        {money(simResult.delta)} ({simResult.deltaPct}%)
                      </strong>{" "}
                      · {simResult.kind} on {simResult.title}
                    </p>
                  </div>
                ) : null}
              </div>

              <div className="space-y-5 p-5">
                <TrajectoryChart liftPct={liftPct} />

                <div className="space-y-3 rounded-xl bg-surface-container-low p-4 shadow-sm">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-[16px] font-semibold text-on-surface">
                        Human Override Budget Adjuster
                      </span>
                      <p className="font-mono text-[11px] text-outline">
                        Recorded in HITL note · Meta scale uses engine +20% when writable
                      </p>
                    </div>
                    <div className="text-right">
                      <span className="font-mono text-[28px] font-bold text-marketing-amber">
                        ${budget.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </span>
                      <span
                        className={cn(
                          "block font-mono text-[11px] font-medium",
                          delta >= 0 ? "text-success-emerald" : "text-alert-rose"
                        )}
                      >
                        {delta >= 0 ? "+" : "−"}${Math.abs(delta).toFixed(2)} ({delta >= 0 ? "+" : ""}
                        {deltaPct}%)
                      </span>
                    </div>
                  </div>
                  <input
                    type="range"
                    min={Math.max(0, Math.floor(floor * 0.5))}
                    max={Math.max(floor * 2 || 100, selected.recommended * 1.5 || 100)}
                    step={10}
                    value={budget}
                    onChange={(e) => setBudget(Number(e.target.value))}
                    className="h-2 w-full cursor-pointer appearance-none rounded-lg bg-surface-container-highest accent-primary-container"
                  />
                  <div className="flex justify-between font-mono text-[11px] text-outline">
                    <span>{money(floor)} (current)</span>
                    <span className="text-marketing-amber">{money(selected.recommended)} (AI)</span>
                    <span>
                      {money(Math.max(floor * 2 || 100, selected.recommended * 1.5 || 100))} (cap)
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex flex-col items-center justify-between gap-3 bg-[#161824] p-5 sm:flex-row">
                <div className="flex w-full items-center gap-1.5 sm:w-auto">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void reject()}
                    className="flex h-10 flex-1 items-center justify-center gap-1.5 rounded-lg bg-surface-container px-3 text-xs font-medium text-on-surface shadow-sm transition-all hover:bg-alert-rose/20 hover:text-alert-rose disabled:opacity-50 sm:flex-initial"
                  >
                    <span className="material-symbols-outlined text-[18px]">close</span>
                    Reject
                    <span className="ml-1 rounded bg-surface-container-high px-1.5 py-0.5 font-mono text-[11px] text-outline">
                      R
                    </span>
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={snooze}
                    className="flex h-10 flex-1 items-center justify-center gap-1.5 rounded-lg bg-surface-container px-3 text-xs font-medium text-on-surface-variant shadow-sm hover:bg-surface-container-high hover:text-on-surface disabled:opacity-50 sm:flex-initial"
                  >
                    <span className="material-symbols-outlined text-[18px]">snooze</span>
                    Snooze (4h)
                  </button>
                </div>
                <div className="flex w-full items-center justify-end gap-1.5 sm:w-auto">
                  <button
                    type="button"
                    onClick={() => {
                      setSandboxMode(true);
                      showToast("Sandbox ON — Approve stays local");
                    }}
                    className="flex h-10 items-center gap-1.5 rounded-lg bg-surface-container px-3 text-xs font-medium text-on-surface shadow-sm hover:bg-surface-container-high"
                  >
                    <span className="material-symbols-outlined text-[18px] text-tertiary">science</span>
                    Sandbox
                    <span className="ml-1 rounded bg-surface-container-high px-1.5 py-0.5 font-mono text-[11px] text-outline">
                      S
                    </span>
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void approve()}
                    className="flex h-10 items-center gap-2 rounded-lg bg-primary-container px-4 text-xs font-bold text-on-primary-container shadow-[0_0_24px_rgba(249,115,22,0.35)] transition-all hover:bg-marketing-amber disabled:opacity-60"
                  >
                    <span className="material-symbols-outlined text-[20px]">
                      {busy ? "sync" : "check_circle"}
                    </span>
                    {busy
                      ? "Working…"
                      : sandboxMode
                        ? "Approve (Local)"
                        : `Approve & Push${selected.platform === "meta" ? " to Meta" : ""}`}
                    <span className="ml-1 rounded bg-on-primary-container/20 px-1.5 py-0.5 font-mono text-[11px]">
                      A
                    </span>
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between bg-obsidian-base px-5 py-2 font-mono text-[11px] text-outline">
                <div className="flex flex-wrap items-center gap-4">
                  <span>
                    <strong className="text-on-surface">A</strong> Approve
                  </span>
                  <span>
                    <strong className="text-on-surface">R</strong> Reject
                  </span>
                  <span>
                    <strong className="text-on-surface">J / K</strong> Navigate
                  </span>
                  <span>
                    <strong className="text-on-surface">S</strong> Toggle sandbox
                  </span>
                </div>
                <span>Decisions persist to desk store</span>
              </div>
            </div>
          ) : !loading ? (
            <div className="rounded-xl bg-obsidian-raised p-10 text-center text-sm text-on-surface-variant">
              Select a dispatch candidate to inspect.
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
