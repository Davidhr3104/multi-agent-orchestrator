"use client";

import { useEffect, useMemo, useState } from "react";
import type { StoredCampaign } from "@helix/core";
import { loadArmedRules, saveArmedRule, saveJson } from "@/lib/desk-prefs";
import { cn } from "@/lib/utils";

type RuleKind = "all" | "spend" | "kill" | "bid" | "audience";

type Rule = {
  id: string;
  kind: RuleKind;
  title: string;
  platforms: ("meta" | "google" | "tiktok" | "all")[];
  status: "active" | "kill" | "hitl" | "streaming";
  statusLabel: string;
  accent: string;
  ifParts: { label: string; value: string }[];
  thenParts: { label: string; value: string }[];
  mandate: string;
  lastTrigger: string;
  armed: boolean;
};

const RULES: Rule[] = [
  {
    id: "WR-0881-BUDGET",
    kind: "spend",
    title: "Scale Budget on Score ≥ 75 & Cheap CAC",
    platforms: ["meta", "google"],
    status: "active",
    statusLabel: "Active",
    accent: "#f97316",
    ifParts: [
      { label: "Avg score", value: "≥ 75" },
      { label: "Cost / hot", value: "≤ $42" },
    ],
    thenParts: [
      { label: "Scale budget", value: "+15%" },
      { label: "Max increment", value: "$800/day" },
    ],
    mandate: "< $400 Auto / > $400 HITL",
    lastTrigger: "14 mins ago · TOFU-Lookalike-US-Tier1",
    armed: true,
  },
  {
    id: "WR-0219-KILL",
    kind: "kill",
    title: "Instant Auto-Pause on Bot / Tor Anomaly Spike",
    platforms: ["all"],
    status: "kill",
    statusLabel: "Autonomous Kill",
    accent: "#f43f5e",
    ifParts: [
      { label: "Bot / disposable", value: "≥ 35%" },
      { label: "Window", value: "50 leads" },
    ],
    thenParts: [
      { label: "Kill switch", value: "Pause creative" },
      { label: "Alert", value: "#growth-alerts" },
    ],
    mandate: "Autonomous Instant Kill · Slack dispatch",
    lastTrigger: "2h ago · Blocked $620 ad waste",
    armed: true,
  },
  {
    id: "WR-0442-BID",
    kind: "bid",
    title: "TikTok Fast-Drop Negative Bid Modifier",
    platforms: ["tiktok"],
    status: "hitl",
    statusLabel: "Requires HITL",
    accent: "#fb923c",
    ifParts: [
      { label: "Dwell time", value: "< 3.0s" },
      { label: "Share of forms", value: "> 40%" },
    ],
    thenParts: [
      { label: "Target CPA", value: "−25%" },
      { label: "Or", value: "Pause Spark" },
    ],
    mandate: "Sandbox · Pending TikTok Direct Write OAuth",
    lastTrigger: "Yesterday · Simulated",
    armed: true,
  },
  {
    id: "WR-0902-SYNC",
    kind: "audience",
    title: "Sync High-Intent Leads to Lookalike Seed",
    platforms: ["meta"],
    status: "streaming",
    statusLabel: "Streaming Sync",
    accent: "#4cd7f6",
    ifParts: [
      { label: "Score", value: "≥ 85" },
      { label: "Domain", value: "Enterprise MX" },
    ],
    thenParts: [
      { label: "CAPI event", value: "High-Value" },
      { label: "Value weight", value: "3.5×" },
    ],
    mandate: "SHA-256 hashed real-time write",
    lastTrigger: "Synced 312 VIP contacts today",
    armed: true,
  },
];

const WRITE_SERIES = [18, 22, 19, 28, 31, 26, 34, 38, 42, 36, 40, 44, 48, 52];

function Sparkline({
  values,
  color,
  fill,
}: {
  values: number[];
  color: string;
  fill?: string;
}) {
  const { line, area } = useMemo(() => {
    const max = Math.max(...values, 1);
    const min = Math.min(...values, 0);
    const span = Math.max(1, max - min);
    const pts = values.map((v, i) => {
      const x = 2 + (i / Math.max(1, values.length - 1)) * 96;
      const y = 28 - ((v - min) / span) * 22;
      return [x, y] as const;
    });
    const linePath = pts.map((p, i) => `${i === 0 ? "M" : "L"}${p[0]} ${p[1]}`).join(" ");
    const areaPath = `${linePath} L98 30 L2 30 Z`;
    return { line: linePath, area: areaPath };
  }, [values]);

  return (
    <svg viewBox="0 0 100 32" className="h-8 w-full" aria-hidden>
      {fill ? <path d={area} fill={fill} /> : null}
      <path d={line} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function PlatformChip({ p }: { p: Rule["platforms"][number] }) {
  if (p === "all") {
    return (
      <span className="rounded border border-[var(--border-hairline)] bg-surface-bright px-2 py-0.5 font-mono text-[10px] text-on-surface">
        All Platforms
      </span>
    );
  }
  if (p === "meta") {
    return (
      <span
        className="inline-flex items-center gap-1 rounded border px-2 py-0.5 font-mono text-[10px]"
        style={{
          background: "rgba(24,119,242,0.2)",
          borderColor: "rgba(24,119,242,0.4)",
          color: "#5ea4ff",
        }}
      >
        <span className="size-1.5 rounded-full" style={{ background: "#1877F2" }} />
        Meta Ads
      </span>
    );
  }
  if (p === "google") {
    return (
      <span className="inline-flex items-center gap-1 rounded border border-primary-container/40 bg-primary-container/20 px-2 py-0.5 font-mono text-[10px] text-primary">
        <span className="size-1.5 rounded-full bg-primary-container" />
        Google Ads
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded border border-white/20 bg-white/10 px-2 py-0.5 font-mono text-[10px] text-on-surface">
      <span className="size-1.5 rounded-full bg-white" />
      TikTok Ads
    </span>
  );
}

function StatusChip({ rule }: { rule: Rule }) {
  const map = {
    active: "bg-success-emerald/15 text-success-emerald border-success-emerald/30",
    kill: "bg-alert-rose/15 text-alert-rose border-alert-rose/30",
    hitl: "bg-marketing-amber/15 text-marketing-amber border-marketing-amber/30",
    streaming: "bg-tertiary/15 text-tertiary border-tertiary/30",
  } as const;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded border px-2 py-0.5 font-mono text-[10px] font-medium",
        map[rule.status]
      )}
    >
      <span
        className={cn(
          "size-1.5 rounded-full",
          rule.status === "active" && "animate-pulse bg-success-emerald",
          rule.status === "kill" && "bg-alert-rose",
          rule.status === "hitl" && "bg-marketing-amber",
          rule.status === "streaming" && "animate-pulse bg-tertiary"
        )}
      />
      {rule.statusLabel}
    </span>
  );
}

/** Visual IF → THEN flow for each rule */
function LogicFlow({ rule }: { rule: Rule }) {
  return (
    <div className="rounded-lg border border-[var(--border-hairline)] bg-obsidian-base p-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-stretch">
        <div className="flex flex-1 flex-col gap-2">
          <div className="flex items-center gap-2">
            <span
              className="rounded px-1.5 py-0.5 font-mono text-[10px] font-bold"
              style={{ background: `${rule.accent}22`, color: rule.accent }}
            >
              IF
            </span>
            <span className="font-mono text-[10px] text-outline">conditions</span>
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            {rule.ifParts.map((p) => (
              <div
                key={p.label}
                className="rounded-md border border-[var(--border-hairline)] bg-surface-container px-2 py-1.5"
              >
                <div className="font-mono text-[9px] text-outline uppercase">{p.label}</div>
                <div className="text-[12px] font-semibold text-on-surface">{p.value}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-center sm:px-1">
          <div className="flex items-center gap-1">
            <div className="hidden h-px w-6 bg-gradient-to-r from-transparent to-primary-container sm:block" />
            <div className="flex size-8 items-center justify-center rounded-full border border-primary-container/40 bg-primary-container/15 text-primary-container shadow-[0_0_12px_rgba(249,115,22,0.25)]">
              <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
            </div>
            <div className="hidden h-px w-6 bg-gradient-to-r from-primary-container to-transparent sm:block" />
          </div>
        </div>

        <div className="flex flex-1 flex-col gap-2">
          <div className="flex items-center gap-2">
            <span className="rounded bg-success-emerald/15 px-1.5 py-0.5 font-mono text-[10px] font-bold text-success-emerald">
              THEN
            </span>
            <span className="font-mono text-[10px] text-outline">write action</span>
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            {rule.thenParts.map((p) => (
              <div
                key={p.label}
                className="rounded-md border border-success-emerald/20 bg-success-emerald/5 px-2 py-1.5"
              >
                <div className="font-mono text-[9px] text-outline uppercase">{p.label}</div>
                <div className="text-[12px] font-semibold text-success-emerald">{p.value}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function ConfidenceRing({ pct }: { pct: number }) {
  const r = 34;
  const c = 2 * Math.PI * r;
  const offset = c * (1 - pct / 100);
  return (
    <div className="relative flex size-24 items-center justify-center">
      <svg viewBox="0 0 80 80" className="size-24 -rotate-90">
        <circle cx="40" cy="40" r={r} fill="none" stroke="#1e1f25" strokeWidth="8" />
        <circle
          cx="40"
          cy="40"
          r={r}
          fill="none"
          stroke="url(#confGrad)"
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
        />
        <defs>
          <linearGradient id="confGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#fb923c" />
            <stop offset="100%" stopColor="#10b981" />
          </linearGradient>
        </defs>
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-mono text-[14px] font-bold text-success-emerald">{pct}%</span>
        <span className="font-mono text-[8px] text-outline">CONF</span>
      </div>
    </div>
  );
}

function ImpactBars() {
  const bars = [
    { label: "Spend", value: 72, color: "#f97316" },
    { label: "CAC↓", value: 58, color: "#10b981" },
    { label: "ROAS", value: 81, color: "#4cd7f6" },
    { label: "Leads", value: 64, color: "#ffb690" },
  ];
  return (
    <div className="flex h-16 items-end gap-2">
      {bars.map((b) => (
        <div key={b.label} className="flex flex-1 flex-col items-center gap-1">
          <div className="flex h-12 w-full items-end rounded-sm bg-obsidian-base">
            <div
              className="w-full rounded-t-sm transition-all"
              style={{ height: `${b.value}%`, background: b.color }}
            />
          </div>
          <span className="font-mono text-[8px] text-outline">{b.label}</span>
        </div>
      ))}
    </div>
  );
}

export function AutomationsDesk() {
  const [tab, setTab] = useState<RuleKind>("all");
  const [activeOnly, setActiveOnly] = useState(true);
  const [selected, setSelected] = useState("WR-0881-BUDGET");
  const [armed, setArmed] = useState<Record<string, boolean>>(() =>
    loadArmedRules(Object.fromEntries(RULES.map((r) => [r.id, r.armed])))
  );
  const [toast, setToast] = useState<string | null>(null);
  const [campaigns, setCampaigns] = useState<StoredCampaign[]>([]);
  const [busy, setBusy] = useState(false);
  const [ruleFilter, setRuleFilter] = useState("");

  const CAPI_PAYLOAD = `{
  "action": "ADSET_BUDGET_UPDATE",
  "campaign_id": "meta_act_88291047",
  "budget_delta": "+15.0%",
  "hitl_mandate": "BYPASS_TIER1_SAFE",
  "safety_check": "PASSED_CHECKSUM"
}`;

  useEffect(() => {
    void fetch("/api/campaigns?window=30d")
      .then((r) => r.json())
      .then((d: { campaigns?: StoredCampaign[] }) => setCampaigns(d.campaigns ?? []))
      .catch(() => undefined);
  }, []);

  function showToast(msg: string) {
    setToast(msg);
    window.setTimeout(() => setToast(null), 3500);
  }

  function setArmedPersist(id: string, next: boolean) {
    setArmed((s) => ({ ...s, [id]: next }));
    saveArmedRule(id, next);
  }

  async function simulateRule(rule: Rule) {
    setBusy(true);
    try {
      const matches = campaigns.filter((c) => {
        if (!armed[rule.id]) return false;
        if (rule.kind === "spend") return c.metrics.avgScore >= 75 && (c.metrics.costPerHot ?? 999) <= 42;
        if (rule.kind === "kill") return c.metrics.spamRate >= 0.35 || c.metrics.spendOnSpam > 0;
        if (rule.kind === "bid") return c.platform === "other" || c.needsReview;
        if (rule.kind === "audience") return c.metrics.avgScore >= 85;
        return c.needsReview;
      });
      showToast(
        armed[rule.id]
          ? `Sim ${rule.id}: ${matches.length} campaign(s) match thresholds (no ads write)`
          : `Rule ${rule.id} is disarmed — arm it first`
      );
      saveJson("automations.lastSim", {
        ruleId: rule.id,
        at: new Date().toISOString(),
        matches: matches.map((c) => c.campaignId),
      });
    } finally {
      setBusy(false);
    }
  }

  async function runSandboxAll() {
    const armedRules = RULES.filter((r) => armed[r.id]);
    if (armedRules.length === 0) {
      showToast("No armed rules to simulate");
      return;
    }
    for (const r of armedRules) await simulateRule(r);
  }

  function createRuleStub() {
    const name = window.prompt("New write rule title");
    if (!name?.trim()) return;
    const custom = loadArmedRules({});
    const id = `WR-CUSTOM-${Date.now().toString(36).toUpperCase()}`;
    saveJson("automations.customDrafts", [
      ...(JSON.parse(
        typeof window !== "undefined"
          ? window.localStorage.getItem("helix.marketing.automations.customDrafts") || "[]"
          : "[]"
      ) as unknown[]),
      { id, title: name.trim(), at: new Date().toISOString() },
    ]);
    void custom;
    showToast(`Draft saved locally: ${name.trim()} (engine wiring next)`);
  }

  const filtered = RULES.filter((r) => {
    if (tab !== "all" && r.kind !== tab) return false;
    if (activeOnly && !armed[r.id]) return false;
    const q = ruleFilter.trim().toLowerCase();
    if (q) {
      const hay = `${r.title} ${r.id} ${r.kind} ${r.statusLabel} ${r.mandate}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  async function copyCapiPayload() {
    try {
      await navigator.clipboard.writeText(CAPI_PAYLOAD);
      showToast("CAPI payload copied");
    } catch {
      showToast("Clipboard unavailable — copy failed");
    }
  }

  const selectedRule = RULES.find((r) => r.id === selected) ?? RULES[0];
  const armedCount = Object.values(armed).filter(Boolean).length;

  const tabs: { id: RuleKind; label: string; count: number }[] = [
    { id: "all", label: "All Rules", count: RULES.length },
    { id: "spend", label: "Spend Allocators", count: RULES.filter((r) => r.kind === "spend").length },
    { id: "kill", label: "Kill Switches", count: RULES.filter((r) => r.kind === "kill").length },
    { id: "bid", label: "Bid Escalators", count: RULES.filter((r) => r.kind === "bid").length },
    { id: "audience", label: "Audience Sync", count: RULES.filter((r) => r.kind === "audience").length },
  ];

  return (
    <div className="flex w-full flex-col gap-5 pb-16">
      {toast ? (
        <div className="fixed right-6 bottom-24 z-50 max-w-sm rounded-lg border border-[var(--border-hairline)] bg-surface-container-high px-4 py-2.5 text-xs shadow-2xl">
          {toast}
        </div>
      ) : null}
      {/* Header */}
      <section className="border-b border-[var(--border-hairline)] pb-5">
        <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight text-on-surface lg:text-3xl">
                Automations & Write Rules
              </h1>
              <span className="inline-flex items-center gap-1 rounded border border-[var(--border-subtle)] bg-surface-container-high px-2.5 py-0.5 font-mono text-[11px] text-on-surface">
                <span className="material-symbols-outlined text-[13px] text-primary-container">
                  memory
                </span>
                v4.2 Algorithmic Core
              </span>
              <span className="inline-flex items-center gap-1 rounded border border-success-emerald/30 bg-success-emerald/10 px-2.5 py-0.5 font-mono text-[11px] text-success-emerald">
                <span className="size-1.5 animate-ping rounded-full bg-success-emerald" />
                {armedCount} armed · prefs saved locally
              </span>
              <span className="inline-flex items-center gap-1 rounded border border-marketing-amber/40 bg-marketing-amber/10 px-2.5 py-0.5 font-mono text-[11px] text-marketing-amber">
                Simulation only — no live ads dispatch yet
              </span>
            </div>
            <p className="max-w-4xl text-[13px] text-on-surface-variant">
              Arm/disarm persists in this browser. Simulate evaluates thresholds against live desk
              campaigns ({campaigns.length} in 30d). HITL still confirms Meta writes.
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => void runSandboxAll()}
              className="flex h-9 items-center gap-1.5 rounded-lg border border-[var(--border-subtle)] bg-surface-container-low px-4 text-xs font-semibold text-on-surface hover:bg-surface-container disabled:opacity-50"
            >
              <span className="material-symbols-outlined text-[16px] text-marketing-amber">
                network_check
              </span>
              Test Simulation Sandbox
            </button>
            <button
              type="button"
              onClick={createRuleStub}
              className="flex h-9 items-center gap-1.5 rounded-lg bg-primary-container px-4 text-xs font-bold text-on-primary-container shadow-[0_0_18px_rgba(249,115,22,0.4)] hover:bg-marketing-amber"
            >
              <span className="material-symbols-outlined text-[17px]">add_circle</span>
              Create Write Rule
            </button>
          </div>
        </div>
      </section>

      {/* Visual KPIs */}
      <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="flex flex-col justify-between rounded-xl border border-[var(--border-hairline)] bg-surface-container p-4">
          <div className="mb-2 flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-xs text-outline">
              <span className="material-symbols-outlined text-[16px] text-primary">verified</span>
              Autonomous Write Cap
            </span>
            <span className="rounded bg-primary-container/20 px-1.5 py-0.5 font-mono text-[10px] text-primary">
              Tier 1
            </span>
          </div>
          <div className="text-2xl font-bold tracking-tight text-on-surface">
            $400 <span className="text-xs font-normal text-outline">/ action</span>
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-container-high">
            <div className="h-full w-[40%] rounded-full bg-primary-container" />
          </div>
          <p className="mt-1.5 font-mono text-[10px] text-outline">&gt;$400 mandates HITL</p>
        </div>

        <div className="flex flex-col justify-between rounded-xl border border-[var(--border-hairline)] bg-surface-container p-4">
          <div className="mb-1 flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-xs text-outline">
              <span className="material-symbols-outlined text-[16px] text-success-emerald">send</span>
              24h Automated Actions
            </span>
            <span className="rounded bg-success-emerald/10 px-1.5 py-0.5 font-mono text-[10px] text-success-emerald">
              +18.4%
            </span>
          </div>
          <div className="text-2xl font-bold tracking-tight text-on-surface">
            142 <span className="text-xs font-normal text-outline">writes</span>
          </div>
          <Sparkline values={WRITE_SERIES} color="#10b981" fill="rgba(16,185,129,0.12)" />
        </div>

        <div className="flex flex-col justify-between rounded-xl border border-[var(--border-hairline)] bg-surface-container p-4">
          <div className="mb-2 flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-xs text-outline">
              <span className="material-symbols-outlined text-[16px] text-marketing-amber">
                health_and_safety
              </span>
              Circuit Breaker
            </span>
            <span className="flex items-center gap-1 font-mono text-[10px] text-success-emerald">
              <span className="size-1.5 rounded-full bg-success-emerald" /> Armed
            </span>
          </div>
          <div className="text-xl font-bold tracking-tight text-on-surface">Armed & Nominal</div>
          <div className="mt-2">
            <div className="mb-1 flex justify-between font-mono text-[9px] text-outline">
              <span>Anomaly buffer</span>
              <span>24 / 35%</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-surface-container-high">
              <div className="h-full w-[68%] rounded-full bg-gradient-to-r from-primary-container to-success-emerald" />
            </div>
          </div>
        </div>

        <div className="flex flex-col justify-between rounded-xl border border-[var(--border-hairline)] bg-surface-container p-4">
          <div className="mb-1 flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-xs text-outline">
              <span className="material-symbols-outlined text-[16px] text-tertiary">speed</span>
              API Write Latency
            </span>
            <span className="rounded bg-tertiary/10 px-1.5 py-0.5 font-mono text-[10px] text-tertiary">
              p99: 44ms
            </span>
          </div>
          <div className="text-2xl font-bold tracking-tight text-on-surface">
            28ms <span className="text-xs font-normal text-outline">avg</span>
          </div>
          <div className="mt-2 flex items-end gap-1">
            {[22, 28, 19, 31, 24, 27, 18, 33, 25, 29, 22, 26].map((h, i) => (
              <div
                key={i}
                className="flex-1 rounded-sm bg-tertiary/80"
                style={{ height: `${h}px`, opacity: 0.45 + (i % 5) * 0.1 }}
              />
            ))}
          </div>
        </div>
      </section>

      {/* Filters */}
      <section className="flex flex-col justify-between gap-3 border-b border-[var(--border-hairline)] pb-3 md:flex-row md:items-center">
        <div className="flex items-center gap-1 overflow-x-auto">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={cn(
                "rounded-lg px-3.5 py-1.5 text-xs font-medium whitespace-nowrap transition-colors",
                tab === t.id
                  ? "bg-primary-container font-semibold text-on-primary-container shadow-sm"
                  : "text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface"
              )}
            >
              {t.label} ({t.count})
            </button>
          ))}
        </div>
        <div className="flex items-center gap-3">
          <div className="relative w-56">
            <span className="material-symbols-outlined pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-[15px] text-outline">
              filter_list
            </span>
            <input
              className="h-8 w-full rounded-lg border border-[var(--border-hairline)] bg-surface-container-low pr-3 pl-8 text-xs text-on-surface placeholder:text-outline focus:border-primary-container focus:outline-none"
              placeholder="Filter logic, ad set…"
              type="search"
              value={ruleFilter}
              onChange={(e) => setRuleFilter(e.target.value)}
            />
          </div>
          <label className="flex cursor-pointer items-center gap-2 text-xs text-on-surface-variant select-none">
            <input
              type="checkbox"
              checked={activeOnly}
              onChange={(e) => setActiveOnly(e.target.checked)}
              className="accent-primary-container"
            />
            Active only
          </label>
        </div>
      </section>

      {/* Workbench */}
      <section className="grid grid-cols-1 items-start gap-5 xl:grid-cols-12">
        <div className="space-y-4 xl:col-span-7">
          {filtered.map((rule) => {
            const isSel = selected === rule.id;
            return (
              <button
                key={rule.id}
                type="button"
                onClick={() => setSelected(rule.id)}
                className={cn(
                  "relative w-full overflow-hidden rounded-xl border p-5 text-left transition-all",
                  isSel
                    ? "border-primary-container/70 bg-surface-container shadow-[0_0_24px_rgba(249,115,22,0.15)]"
                    : "border-[var(--border-hairline)] bg-surface-container hover:border-white/15"
                )}
              >
                <div
                  className="absolute top-0 bottom-0 left-0 w-1.5"
                  style={{ background: rule.accent }}
                />
                <div className="mb-3 flex items-start justify-between gap-4 pl-2">
                  <div className="space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      {rule.platforms.map((p) => (
                        <PlatformChip key={`${rule.id}-${p}`} p={p} />
                      ))}
                      <span className="rounded border border-[var(--border-hairline)] bg-surface-container-high px-1.5 py-0.5 font-mono text-[10px] text-outline">
                        {rule.id}
                      </span>
                      <StatusChip rule={rule} />
                    </div>
                    <h2 className="text-base font-bold tracking-tight text-on-surface">{rule.title}</h2>
                  </div>
                  <label
                    className="inline-flex cursor-pointer items-center"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <input
                      type="checkbox"
                      className="peer sr-only"
                      checked={armed[rule.id]}
                      onChange={(e) => setArmedPersist(rule.id, e.target.checked)}
                    />
                    <div
                      className="relative h-5 w-9 rounded-full bg-surface-container-high after:absolute after:top-[2px] after:left-[2px] after:h-4 after:w-4 after:rounded-full after:bg-white after:transition-all peer-checked:after:translate-x-full"
                      style={
                        armed[rule.id]
                          ? { background: rule.accent }
                          : undefined
                      }
                    />
                  </label>
                </div>

                <div className="mb-3 pl-2">
                  <LogicFlow rule={rule} />
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[var(--border-hairline)] pt-2 pl-2 text-xs text-on-surface-variant">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-[14px]" style={{ color: rule.accent }}>
                      supervised_user_circle
                    </span>
                    <span>
                      {rule.mandate.includes("HITL") ? (
                        <>
                          Human Mandate: <strong className="text-on-surface">{rule.mandate}</strong>
                        </>
                      ) : (
                        rule.mandate
                      )}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 font-mono text-[11px] text-outline">
                    <span className="material-symbols-outlined text-[13px] text-primary-container">
                      history
                    </span>
                    Last: <span className="text-on-surface">{rule.lastTrigger}</span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {/* Simulator — more visual */}
        <div className="space-y-3 xl:sticky xl:top-20 xl:col-span-5">
          <div className="overflow-hidden rounded-xl border border-[var(--border-subtle)] bg-surface-container shadow-xl">
            <div className="flex items-center justify-between border-b border-[var(--border-hairline)] bg-surface-container-high p-4">
              <div className="flex items-center gap-2.5">
                <div className="flex size-7 items-center justify-center rounded-lg border border-primary-container/40 bg-primary-container/20 text-primary-container">
                  <span className="material-symbols-outlined text-[18px]">terminal</span>
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold text-on-surface">Rule Simulator</h3>
                    <span className="rounded border border-primary-container/40 bg-primary-container/20 px-1.5 font-mono text-[10px] text-primary">
                      {selectedRule.id.split("-").slice(0, 2).join("-")}
                    </span>
                  </div>
                  <p className="text-[11px] text-outline">Execution & rollback preview</p>
                </div>
              </div>
              <span className="inline-flex items-center gap-1 rounded border border-success-emerald/20 bg-success-emerald/10 px-2 py-0.5 font-mono text-[11px] text-success-emerald">
                <span className="size-1.5 rounded-full bg-success-emerald" /> Verified Dry-Run
              </span>
            </div>

            <div className="space-y-5 p-5">
              <div className="space-y-2">
                <p className="font-mono text-[10px] font-semibold tracking-wider text-outline uppercase">
                  Target Campaign Scope
                </p>
                <div className="space-y-2 rounded-lg border border-[var(--border-hairline)] bg-obsidian-base p-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-outline">Target Ad Set</span>
                    <span className="flex items-center gap-1.5 font-medium text-on-surface">
                      <span className="size-2 rounded-full" style={{ background: "#1877F2" }} />
                      Meta: TOFU-Lookalike-US-Tier1
                    </span>
                  </div>
                  <div className="flex items-center justify-between border-t border-[var(--border-hairline)] pt-1.5 text-xs">
                    <span className="text-outline">Current Daily Cap</span>
                    <span className="font-mono text-on-surface-variant">$1,600.00</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-outline">Target Delta</span>
                    <span className="font-mono font-semibold text-success-emerald">
                      +15% (+$240/day)
                    </span>
                  </div>
                  {/* Visual budget delta */}
                  <div className="relative mt-1 h-3 overflow-hidden rounded-full bg-surface-container-high">
                    <div className="absolute inset-y-0 left-0 w-[70%] bg-[#1877F2]/40" />
                    <div className="absolute inset-y-0 left-[70%] w-[12%] bg-success-emerald" />
                  </div>
                  <div className="flex justify-between font-mono text-[9px] text-outline">
                    <span>Current $1.6k</span>
                    <span className="text-success-emerald">+$240 proposed</span>
                  </div>
                </div>
              </div>

              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <p className="font-mono text-[10px] font-semibold tracking-wider text-outline uppercase">
                    7-Day Monte Carlo Impact
                  </p>
                  <span className="font-mono text-[10px] text-primary">n=5,000 runs</span>
                </div>
                <div className="flex items-center gap-4">
                  <ConfidenceRing pct={92.4} />
                  <div className="min-w-0 flex-1">
                    <ImpactBars />
                    <p className="mt-1 font-mono text-[9px] text-outline">
                      Distribution across spend · CAC · ROAS · leads
                    </p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-lg border border-[var(--border-hairline)] bg-obsidian-base p-2.5">
                    <span className="font-mono text-[10px] text-outline">Spend Lift</span>
                    <p className="font-mono text-sm font-bold text-on-surface">+$2,450</p>
                  </div>
                  <div className="rounded-lg border border-[var(--border-hairline)] bg-obsidian-base p-2.5">
                    <span className="font-mono text-[10px] text-outline">Projected CAC</span>
                    <p className="font-mono text-sm font-bold text-success-emerald">
                      $38.10 <span className="text-[10px] font-normal text-outline">(−9%)</span>
                    </p>
                  </div>
                  <div className="rounded-lg border border-[var(--border-hairline)] bg-obsidian-base p-2.5">
                    <span className="font-mono text-[10px] text-outline">Est. ROAS Lift</span>
                    <p className="font-mono text-sm font-bold text-on-surface">
                      3.8× <span className="text-[10px] font-normal text-success-emerald">(+0.4×)</span>
                    </p>
                  </div>
                  <div className="rounded-lg border border-[var(--border-hairline)] bg-obsidian-base p-2.5">
                    <span className="font-mono text-[10px] text-outline">Hot Leads</span>
                    <p className="font-mono text-sm font-bold text-primary">+34 Leads</p>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <p className="font-mono text-[10px] font-semibold tracking-wider text-outline uppercase">
                  Autonomous Safety Checks
                </p>
                <div className="space-y-1.5">
                  {[
                    ["Daily budget cap respected", "< $5,000/day"],
                    ["Rate limit verification", "Max 1× / 24h"],
                    ["2-Way rollback window", "120m undo armed"],
                  ].map(([label, meta]) => (
                    <div
                      key={label}
                      className="flex items-center justify-between rounded-lg border border-[var(--border-hairline)] bg-obsidian-base p-2 text-xs"
                    >
                      <div className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-[16px] text-success-emerald">
                          check_circle
                        </span>
                        <span className="text-on-surface-variant">{label}</span>
                      </div>
                      <span className="font-mono text-[10px] text-outline">{meta}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="font-mono text-[10px] font-semibold tracking-wider text-outline uppercase">
                    Meta Graph CAPI Write Payload
                  </p>
                  <button
                    type="button"
                    onClick={() => void copyCapiPayload()}
                    className="flex items-center gap-1 font-mono text-[10px] text-primary hover:underline"
                  >
                    <span className="material-symbols-outlined text-[12px]">content_copy</span> Copy
                  </button>
                </div>
                <pre className="overflow-x-auto rounded-lg border border-[var(--border-hairline)] bg-obsidian-base p-3 font-mono text-[11px] leading-relaxed text-on-surface-variant">
                  <span className="text-outline">{"{"}</span>
                  {"\n  "}
                  <span className="text-primary-container">&quot;action&quot;</span>
                  {": "}
                  <span className="text-tertiary">&quot;ADSET_BUDGET_UPDATE&quot;</span>,{"\n  "}
                  <span className="text-primary-container">&quot;campaign_id&quot;</span>
                  {": "}
                  <span className="text-tertiary">&quot;meta_act_88291047&quot;</span>,{"\n  "}
                  <span className="text-primary-container">&quot;budget_delta&quot;</span>
                  {": "}
                  <span className="text-success-emerald">&quot;+15.0%&quot;</span>,{"\n  "}
                  <span className="text-primary-container">&quot;hitl_mandate&quot;</span>
                  {": "}
                  <span className="text-marketing-amber">&quot;BYPASS_TIER1_SAFE&quot;</span>,{"\n  "}
                  <span className="text-primary-container">&quot;safety_check&quot;</span>
                  {": "}
                  <span className="text-success-emerald">&quot;PASSED_CHECKSUM&quot;</span>
                  {"\n"}
                  <span className="text-outline">{"}"}</span>
                </pre>
              </div>

              <div className="flex flex-col gap-2.5 pt-1 sm:flex-row">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void simulateRule(selectedRule)}
                  className="flex h-9 flex-1 items-center justify-center gap-1.5 rounded-lg border border-[var(--border-subtle)] bg-surface-container-high text-xs font-semibold text-on-surface hover:bg-surface-bright disabled:opacity-50"
                >
                  <span className="material-symbols-outlined text-[15px] text-marketing-amber">
                    play_arrow
                  </span>
                  Simulate Write Trigger
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setArmedPersist(selectedRule.id, true);
                    showToast(`Armed ${selectedRule.id} (saved locally)`);
                  }}
                  className="flex h-9 flex-1 items-center justify-center gap-1.5 rounded-lg bg-primary-container text-xs font-bold text-on-primary-container shadow-[0_0_16px_rgba(249,115,22,0.4)] hover:bg-marketing-amber"
                >
                  <span className="material-symbols-outlined text-[16px]">lock_reset</span>
                  Save & Arm Rule
                </button>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between rounded-xl border border-[var(--border-hairline)] bg-surface-container px-3.5 py-3 text-xs text-on-surface-variant">
            <div className="flex items-center gap-2.5">
              <span className="size-2 rounded-full bg-success-emerald" />
              Deterministic Rule Dispatcher: <strong className="text-on-surface">Socket Active</strong>
            </div>
            <span className="font-mono text-[10px] text-outline">Heartbeat: 400ms</span>
          </div>
        </div>
      </section>
    </div>
  );
}
