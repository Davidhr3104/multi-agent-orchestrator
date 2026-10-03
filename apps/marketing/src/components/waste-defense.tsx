"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import type { DeskWasteSummary, StoredCampaign } from "@helix/core";
import {
  loadDefenseSwitches,
  loadJson,
  saveDefenseSwitches,
  saveJson,
  type DefenseSwitches,
} from "@/lib/desk-prefs";
import { money } from "@/lib/format";
import { cn } from "@/lib/utils";
import { WasteReportPanel } from "@/components/waste-report-panel";

type Range = "7d" | "30d" | "90d" | "live";

type QuarantineRule = { name: string; at: string };
type WasteActionLog = { at: string; label: string };

export function WasteDefenseDesk() {
  const router = useRouter();
  const [range, setRange] = useState<Range>("live");
  const [waste, setWaste] = useState<DeskWasteSummary | null>(null);
  const [campaigns, setCampaigns] = useState<StoredCampaign[]>([]);
  const [switches, setSwitches] = useState<DefenseSwitches>({ pause: true, capi: true, slack: true });
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<{ msg: string; err?: boolean } | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function showToast(msg: string, err = false) {
    setToast({ msg, err });
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 4200);
  }

  function logAction(label: string) {
    const prev = loadJson<WasteActionLog[]>("waste.actions", []);
    saveJson("waste.actions", [{ at: new Date().toISOString(), label }, ...prev].slice(0, 40));
  }

  const refresh = useCallback(async () => {
    const win = range === "live" ? "7d" : range;
    const res = await fetch(`/api/campaigns?window=${win}`);
    const d = (await res.json()) as { waste?: DeskWasteSummary; campaigns?: StoredCampaign[] };
    setWaste(d.waste ?? null);
    setCampaigns(d.campaigns ?? []);
  }, [range]);

  useEffect(() => {
    setSwitches(loadDefenseSwitches());
  }, []);

  useEffect(() => {
    void refresh().catch(() => undefined);
  }, [refresh]);

  const blocked = waste?.spendOnSpam ?? 0;
  const wastePct = waste ? Math.round(waste.wastePct * 1000) / 10 : 0;
  const nSpam = waste?.nSpam ?? 0;
  const costPerHot = waste?.costPerHot ?? null;
  const wasteHigh = wastePct >= 6 || blocked > 0;

  function onSwitchChange(key: keyof DefenseSwitches, checked: boolean) {
    const next = { ...switches, [key]: checked };
    setSwitches(next);
    saveDefenseSwitches(next);
    if (key === "pause" && checked && wasteHigh) {
      showToast("Auto-pause preference armed — use Disarm Leaking Sets to pause campaigns");
      logAction("Armed auto-pause preference");
    }
  }

  function simulateVector() {
    if (!waste) {
      showToast("No waste summary loaded yet");
      return;
    }
    showToast(
      `Waste: ${money(waste.spendOnSpam)} spam · ${waste.nSpam} spam leads · ${Math.round(waste.wastePct * 1000) / 10}% ratio` +
        (waste.costPerHot != null ? ` · ${money(waste.costPerHot)}/hot` : "")
    );
    logAction("Simulated threat vector");
  }

  async function disarmLeakingSets() {
    const leaking = campaigns
      .filter(
        (c) =>
          (c.metrics.spendOnSpam ?? 0) > 0 &&
          (c.needsReview || (c.metrics.spamRate ?? 0) >= 0.25)
      )
      .slice(0, 5);
    if (leaking.length === 0) {
      showToast("No leaking campaigns to pause");
      return;
    }
    setBusy(true);
    let ok = 0;
    const errors: string[] = [];
    try {
      for (const c of leaking) {
        const res = await fetch(`/api/campaigns/${c.id}/review`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "pause",
            note: "Waste defense: Disarm Leaking Sets",
            writeAds: false,
          }),
        });
        if (res.ok) ok += 1;
        else {
          const data = (await res.json().catch(() => ({}))) as { error?: string };
          errors.push(data.error || c.name);
        }
      }
      await refresh();
      logAction(`Disarmed ${ok}/${leaking.length} leaking sets`);
      if (ok > 0) showToast(`Paused ${ok}/${leaking.length} leaking campaign(s)`);
      else showToast(errors[0] || "Pause failed", true);
    } finally {
      setBusy(false);
    }
  }

  function newQuarantineRule() {
    const name = window.prompt("Quarantine rule name")?.trim();
    if (!name) return;
    const prev = loadJson<QuarantineRule[]>("waste.quarantine", []);
    const next = [{ name, at: new Date().toISOString() }, ...prev];
    saveJson("waste.quarantine", next);
    const cidr = name.match(/\b\d{1,3}(?:\.\d{1,3}){3}\/\d{1,2}\b/);
    if (cidr) {
      const banned = loadJson<string[]>("waste.bannedCidrs", []);
      if (!banned.includes(cidr[0])) saveJson("waste.bannedCidrs", [cidr[0], ...banned]);
    }
    logAction(`Quarantine rule: ${name}`);
    showToast(`Saved quarantine rule “${name}”`);
  }

  function pushBannedCidr() {
    type CidrEntry = { cidr: string; at?: string };
    const stored = loadJson<CidrEntry[] | string[]>("waste.bannedCidrs", []);
    const fromQuarantine = loadJson<QuarantineRule[]>("waste.quarantine", []);
    const defaults = [
      "185.220.101.0/24",
      "104.244.72.0/21",
      "23.129.64.0/24",
      "199.249.230.0/24",
      "171.25.193.0/24",
    ];
    const lines: string[] = [];
    if (Array.isArray(stored) && stored.length > 0) {
      for (const item of stored) {
        if (typeof item === "string") lines.push(item);
        else if (item && typeof item === "object" && "cidr" in item) lines.push(String(item.cidr));
      }
    }
    // Pull CIDR-looking quarantine rule names the user added
    for (const r of fromQuarantine) {
      const m = r.name.match(/\b\d{1,3}(?:\.\d{1,3}){3}\/\d{1,2}\b/);
      if (m && !lines.includes(m[0])) lines.push(m[0]);
    }
    const list = lines.length > 0 ? lines : defaults;
    const blob = new Blob([list.join("\n") + "\n"], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `banned-cidrs-${new Date().toISOString().slice(0, 10)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    saveJson("waste.cidrPush", { at: new Date().toISOString(), count: list.length });
    logAction(`Downloaded ${list.length} banned CIDR(s)`);
    showToast(`Downloaded ${list.length} banned CIDR(s)`);
  }

  function auditStateMachine() {
    const sw = loadDefenseSwitches();
    const rules = loadJson<QuarantineRule[]>("waste.quarantine", []);
    const actions = loadJson<WasteActionLog[]>("waste.actions", []);
    setSwitches(sw);
    const ruleNames = rules.slice(0, 5).map((r) => r.name);
    const summary =
      `Defense: pause=${sw.pause ? "on" : "off"} · capi=${sw.capi ? "on" : "off"} · slack=${sw.slack ? "on" : "off"}` +
      ` · quarantine=${rules.length}` +
      (ruleNames.length ? ` [${ruleNames.join(", ")}]` : "") +
      ` · last action: ${actions[0]?.label ?? "none"}`;
    showToast(summary);
    logAction("Audited state machine");
    try {
      router.push("/settings");
    } catch {
      /* toast already shown */
    }
  }

  return (
    <div className="flex w-full flex-col gap-5 pb-16 text-on-surface">
      {/* Hero header */}
      <div className="relative overflow-hidden rounded-2xl border border-[var(--border-hairline)] bg-gradient-to-r from-surface-container-low via-surface-container-low/95 to-surface-container-low p-5 shadow-lg">
        <div className="pointer-events-none absolute -top-20 -right-20 size-80 rounded-full bg-primary-container/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-20 -left-20 size-80 rounded-full bg-tertiary/5 blur-3xl" />
        <div className="relative z-10 flex flex-col justify-between gap-4 xl:flex-row xl:items-center">
          <div className="max-w-3xl space-y-1.5">
            <div className="flex flex-wrap items-center gap-2.5">
              <div className="flex items-center gap-1.5 rounded-full border border-alert-rose/30 bg-alert-rose/10 px-2.5 py-0.5">
                <span className="size-1.5 animate-ping rounded-full bg-alert-rose" />
                <span className="font-mono text-[10px] font-bold tracking-wider text-alert-rose uppercase">
                  v4.2 Heuristic Defense Core
                </span>
              </div>
              <span className="flex items-center gap-1 font-mono text-[11px] text-tertiary">
                <span className="material-symbols-outlined text-[14px]">shield_lock</span>
                Zero-Trust CAPI Firewall Active
              </span>
              <span className="rounded border border-success-emerald/20 bg-success-emerald/10 px-2 py-0.5 font-mono text-[11px] text-success-emerald">
                Pause/scale need your sign-off
              </span>
            </div>
            <h1 className="flex flex-wrap items-center gap-2 text-2xl font-bold tracking-tight text-on-surface">
              $ on Spam & Ad Waste Monitor
              <span className="rounded border border-[var(--border-hairline)] bg-surface-container px-2 py-0.5 font-mono text-xs font-normal text-on-surface-variant">
                Real-Time Ingress Hub
              </span>
            </h1>
            <p className="max-w-2xl text-xs leading-relaxed text-on-surface-variant">
              Autonomous shield for disposable domains, Tor/DC scrapers, sub-3s ghost bounces, and
              click farms — before junk pollutes CRM & CAPI attribution.
            </p>
          </div>
          <div className="relative z-10 flex flex-wrap items-center gap-2 self-start xl:self-center">
            <div className="flex items-center rounded-xl border border-[var(--border-hairline)] bg-surface-container-lowest p-1 shadow-inner">
              {(["7d", "30d", "90d", "live"] as const).map((id) => {
                const on = range === id;
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setRange(id)}
                    className={cn(
                      "rounded-lg px-2.5 py-1 font-mono text-xs transition-colors",
                      on
                        ? "bg-primary-container font-bold text-white shadow-[0_0_10px_rgba(249,115,22,0.4)]"
                        : "text-on-surface-variant hover:text-on-surface"
                    )}
                  >
                    {id === "live" ? (
                      <span className="flex items-center gap-1.5">
                        <span className="size-1.5 animate-pulse rounded-full bg-white" />
                        1s Stream
                      </span>
                    ) : (
                      id.toUpperCase()
                    )}
                  </button>
                );
              })}
            </div>
            <button
              type="button"
              onClick={simulateVector}
              className="flex h-8 items-center gap-1.5 rounded-lg border border-[var(--border-hairline)] bg-surface-container px-2.5 text-xs text-on-surface hover:bg-surface-container-high"
            >
              <span className="material-symbols-outlined text-[15px] text-tertiary">terminal</span>
              Simulate Vector
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => void disarmLeakingSets()}
              className="flex h-8 items-center gap-1.5 rounded-lg border border-alert-rose/30 bg-alert-rose/15 px-2.5 text-xs font-semibold text-alert-rose hover:bg-alert-rose/25 disabled:opacity-50"
            >
              <span className="material-symbols-outlined text-[15px]">warning</span>
              Disarm Leaking Sets
            </button>
            <button
              type="button"
              onClick={newQuarantineRule}
              className="flex h-8 items-center gap-1.5 rounded-lg bg-gradient-to-r from-primary-container to-marketing-amber px-3 text-xs font-semibold text-white shadow-[0_0_12px_rgba(249,115,22,0.3)]"
            >
              <span className="material-symbols-outlined text-[16px]">add_moderator</span>
              New Quarantine Rule
            </button>
          </div>
        </div>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          title="Blocked / Prevented Drain"
          value={money(blocked, 2)}
          badge={blocked > 0 ? "Spam spend" : "Clear"}
          badgeTone={blocked > 0 ? "bad" : "good"}
          icon="savings"
          iconTone="orange"
          footerL={`${campaigns.length} campaigns in window`}
          footerR={switches.capi ? "CAPI Drop Armed" : "CAPI Drop Off"}
        >
          <svg className="mt-3 h-12 w-full overflow-visible" viewBox="0 0 240 50" preserveAspectRatio="none">
            <defs>
              <linearGradient id="kpiGrad1" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor="#f97316" stopOpacity="0.45" />
                <stop offset="100%" stopColor="#f97316" stopOpacity="0" />
              </linearGradient>
            </defs>
            <path
              d="M0,45 Q30,42 60,35 T120,28 T180,18 T240,8 L240,50 L0,50 Z"
              fill="url(#kpiGrad1)"
            />
            <path
              d="M0,45 Q30,42 60,35 T120,28 T180,18 T240,8"
              fill="none"
              stroke="#f97316"
              strokeWidth="2.5"
              strokeLinecap="round"
            />
            <circle cx="240" cy="8" r="3.5" fill="#ffb690" />
            <circle cx="240" cy="8" r="6" fill="#f97316" opacity="0.75" className="animate-ping" />
          </svg>
        </KpiCard>

        <KpiCard
          title="Disposable & Bot Leads"
          value={`${nSpam.toLocaleString()} leads`}
          badge="Spam class"
          badgeTone={nSpam > 0 ? "bad" : "good"}
          icon="person_cancel"
          iconTone="rose"
          footerL={`Hot leads: ${waste?.nHot ?? 0}`}
          footerR={`Total: ${waste?.nLeads ?? 0}`}
        >
          <div className="mt-3 flex h-12 w-full items-end justify-between gap-1.5 px-1">
            {[30, 45, 38, 60, 75, 90, 100, 65, 40].map((h, i) => (
              <div
                key={i}
                className={cn(
                  "w-full rounded-sm",
                  i < 3 ? "bg-surface-container" : "bg-alert-rose"
                )}
                style={{
                  height: `${h}%`,
                  opacity: i >= 3 ? 0.4 + (i - 3) * 0.1 : 1,
                  boxShadow: i === 6 ? "0 0 8px #f43f5e" : undefined,
                }}
              />
            ))}
          </div>
        </KpiCard>

        <KpiCard
          title="Click-Farm / Tor Velocity"
          value={costPerHot != null ? money(costPerHot, 2) : "—"}
          badge={costPerHot != null ? "$ / hot" : "No hot CPA"}
          badgeTone="cyan"
          icon="radar"
          iconTone="cyan"
          footerL={waste?.worstCampaignName ? `Worst: ${waste.worstCampaignName}` : "No worst campaign"}
          footerR={waste?.worstSpendOnSpam ? money(waste.worstSpendOnSpam, 2) : "—"}
        >
          <svg className="mt-3 h-12 w-full overflow-visible" viewBox="0 0 240 50" preserveAspectRatio="none">
            <defs>
              <linearGradient id="kpiGrad3" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor="#4cd7f6" stopOpacity="0.35" />
                <stop offset="100%" stopColor="#4cd7f6" stopOpacity="0" />
              </linearGradient>
            </defs>
            <path
              d="M0,38 L40,38 L40,30 L80,30 L80,42 L120,42 L120,15 L160,15 L160,25 L200,25 L200,10 L240,10 L240,50 L0,50 Z"
              fill="url(#kpiGrad3)"
            />
            <path
              d="M0,38 L40,38 L40,30 L80,30 L80,42 L120,42 L120,15 L160,15 L160,25 L200,25 L200,10 L240,10"
              fill="none"
              stroke="#4cd7f6"
              strokeWidth="2"
            />
          </svg>
        </KpiCard>

        <KpiCard
          title="Current Waste Ratio"
          value={`${wastePct}%`}
          badge="Goal < 6.0%"
          badgeTone="muted"
          icon={null}
          iconTone="good"
          footerL={waste ? `${money(waste.totalSpend, 0)} total spend` : "No spend window"}
          footerR={wastePct < 6 ? "Safety Corridor OK" : "Above 6% goal"}
          valueClass="text-success-emerald"
          right={
            <div className="relative flex size-12 items-center justify-center">
              <svg className="size-12 -rotate-90" viewBox="0 0 36 36">
                <path
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="3.5"
                  className="text-surface-container-highest"
                />
                <path
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="3.5"
                  strokeLinecap="round"
                  strokeDasharray={`${Math.min(100, (wastePct / 10) * 100)}, 100`}
                  className="text-success-emerald"
                />
              </svg>
              <span className="absolute font-mono text-[10px] font-bold text-success-emerald">
                {wastePct}%
              </span>
            </div>
          }
        >
          <div className="mt-3 flex items-center gap-2">
            <div className="flex h-2 flex-1 overflow-hidden rounded-full bg-surface-container-lowest">
              <div
                className="h-full rounded-full bg-success-emerald"
                style={{ width: `${Math.min(100, wastePct * 10)}%` }}
              />
            </div>
            <span className="font-mono text-[10px] font-semibold text-on-surface-variant">
              {wastePct}% / 10% max
            </span>
          </div>
        </KpiCard>
      </div>

      <WasteReportPanel onChanged={() => void refresh().catch(() => undefined)} />

      <p className="rounded-lg border border-marketing-amber/30 bg-marketing-amber/10 px-3 py-2 text-[11px] text-marketing-amber">
        Illustrative mockups below (timeline, radar, telemetry, IP cluster, defense switches): they show the intended
        product, not your data. Your real numbers are in the KPI cards and the waste report above.
      </p>

      {/* Timeline + Radar */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
        <div className="relative flex flex-col overflow-hidden rounded-2xl border border-[var(--border-hairline)] bg-surface-container-low p-5 shadow-sm lg:col-span-8">
          <div className="flex flex-col justify-between gap-3 border-b border-[var(--border-hairline)] pb-4 sm:flex-row sm:items-center">
            <div className="flex items-center gap-3">
              <div className="flex size-8 items-center justify-center rounded-lg border border-primary-container/30 bg-primary-container/15 text-primary-container">
                <span className="material-symbols-outlined text-[18px]">query_stats</span>
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-bold tracking-tight text-on-surface">
                    Ad Drain & Bot Ingress Timeline
                  </h2>
                  <span className="rounded border border-marketing-amber/30 bg-marketing-amber/10 px-2 py-0.5 font-mono text-[10px] text-marketing-amber">
                    ILLUSTRATIVE
                  </span>
                </div>
                <p className="text-xs text-on-surface-variant">
                  Valid ingress vs quarantine spikes vs prevented drain
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3 font-mono text-[11px] text-on-surface-variant">
              <span className="flex items-center gap-1.5">
                <span className="size-2.5 rounded-sm bg-tertiary" /> Valid
              </span>
              <span className="flex items-center gap-1.5">
                <span className="size-2.5 rounded-sm bg-alert-rose" /> Quarantine
              </span>
              <span className="flex items-center gap-1.5">
                <span className="size-2.5 rounded-sm bg-primary-container" /> Prevented
              </span>
            </div>
          </div>

          <div
            className="relative mt-4 h-64 w-full rounded-xl border border-[var(--border-hairline)] bg-obsidian-base/40 p-2"
            style={{
              backgroundImage:
                "linear-gradient(to right, rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.03) 1px, transparent 1px)",
              backgroundSize: "32px 32px",
            }}
          >
            <div className="pointer-events-none absolute top-6 left-[54%] z-20 flex flex-col items-center">
              <div className="rounded border border-white/20 bg-alert-rose px-2 py-1 font-mono text-[10px] font-bold whitespace-nowrap text-white shadow-[0_0_12px_rgba(244,63,94,0.6)]">
                Bot Spike: 42 yopmail leads/10m
              </div>
              <div className="h-16 w-px bg-gradient-to-b from-alert-rose to-transparent" />
            </div>
            <div className="pointer-events-none absolute top-14 left-[78%] z-20 flex flex-col items-center">
              <div className="rounded border border-white/20 bg-primary-container px-2 py-0.5 font-mono text-[10px] font-bold whitespace-nowrap text-white shadow-[0_0_10px_rgba(249,115,22,0.5)]">
                −$420/hr Throttled
              </div>
              <div className="h-10 w-px bg-gradient-to-b from-primary-container to-transparent" />
            </div>

            <svg className="h-full w-full" viewBox="0 0 800 240" preserveAspectRatio="none">
              <defs>
                <linearGradient id="chartBotGrad" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0%" stopColor="#f43f5e" stopOpacity="0.4" />
                  <stop offset="100%" stopColor="#f43f5e" stopOpacity="0" />
                </linearGradient>
                <linearGradient id="chartValidGrad" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0%" stopColor="#4cd7f6" stopOpacity="0.25" />
                  <stop offset="100%" stopColor="#4cd7f6" stopOpacity="0" />
                </linearGradient>
                <linearGradient id="chartDrainGrad" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0%" stopColor="#f97316" stopOpacity="0.35" />
                  <stop offset="100%" stopColor="#f97316" stopOpacity="0" />
                </linearGradient>
              </defs>
              {[40, 90, 140, 190].map((y) => (
                <line
                  key={y}
                  x1="0"
                  x2="800"
                  y1={y}
                  y2={y}
                  stroke="rgba(255,255,255,0.06)"
                  strokeDasharray="4,4"
                />
              ))}
              <path
                d="M0,170 C80,165 140,150 220,160 C300,170 380,140 450,150 C520,160 580,145 650,155 C720,160 760,150 800,145 L800,240 L0,240 Z"
                fill="url(#chartValidGrad)"
              />
              <path
                d="M0,170 C80,165 140,150 220,160 C300,170 380,140 450,150 C520,160 580,145 650,155 C720,160 760,150 800,145"
                fill="none"
                stroke="#4cd7f6"
                strokeWidth="2"
              />
              <path
                d="M0,210 C60,205 110,215 170,200 C210,190 260,130 300,90 C340,50 380,180 430,70 C470,20 500,160 550,170 C620,180 680,130 730,95 C770,70 780,110 800,100 L800,240 L0,240 Z"
                fill="url(#chartBotGrad)"
              />
              <path
                d="M0,210 C60,205 110,215 170,200 C210,190 260,130 300,90 C340,50 380,180 430,70 C470,20 500,160 550,170 C620,180 680,130 730,95 C770,70 780,110 800,100"
                fill="none"
                stroke="#f43f5e"
                strokeWidth="2.5"
                strokeLinecap="round"
              />
              <path
                d="M0,220 C80,215 160,200 240,180 C320,160 400,120 480,90 C560,75 640,60 720,40 C760,30 780,25 800,20 L800,240 L0,240 Z"
                fill="url(#chartDrainGrad)"
              />
              <path
                d="M0,220 C80,215 160,200 240,180 C320,160 400,120 480,90 C560,75 640,60 720,40 C760,30 780,25 800,20"
                fill="none"
                stroke="#f97316"
                strokeWidth="2.5"
                strokeLinecap="round"
              />
              <circle cx="435" cy="68" r="4" fill="#f43f5e" />
              <circle cx="435" cy="68" r="8" fill="#f43f5e" opacity="0.8" className="animate-ping" />
              <circle cx="800" cy="20" r="4.5" fill="#f97316" />
              <circle cx="800" cy="20" r="9" fill="#f97316" opacity="0.9" className="animate-ping" />
            </svg>
          </div>
          <div className="flex items-center justify-between pt-2 font-mono text-[11px] text-on-surface-variant">
            <span>14:00 (T−25m)</span>
            <span>14:05</span>
            <span>14:10</span>
            <span>14:15 (Bot Spike)</span>
            <span>14:20 (CAPI Drop)</span>
            <span className="flex items-center gap-1 font-bold text-primary">
              <span className="size-1.5 animate-ping rounded-full bg-primary" />
              Now
            </span>
          </div>
        </div>

        {/* Radar */}
        <div className="flex flex-col justify-between rounded-2xl border border-[var(--border-hairline)] bg-surface-container-low p-5 shadow-sm lg:col-span-4">
          <div className="flex items-center justify-between border-b border-[var(--border-hairline)] pb-3">
            <div className="flex items-center gap-2.5">
              <div className="flex size-8 items-center justify-center rounded-lg border border-tertiary/30 bg-tertiary/15 text-tertiary">
                <span className="material-symbols-outlined text-[18px]">radar</span>
              </div>
              <div>
                <h2 className="text-base font-bold tracking-tight text-on-surface">Threat Vector Radar</h2>
                <p className="text-[11px] text-marketing-amber">Illustrative breakdown — not your data</p>
              </div>
            </div>
            <span className="rounded-full border border-[var(--border-hairline)] bg-surface-container px-2 py-0.5 font-mono text-[10px] text-on-surface-variant">
              {nSpam.toLocaleString()} Spam
            </span>
          </div>

          <div className="relative flex items-center justify-center py-2">
            <svg className="size-52 overflow-visible" viewBox="0 0 200 200">
              <defs>
                <linearGradient id="radarFill" x1="0" x2="1" y1="0" y2="1">
                  <stop offset="0%" stopColor="#f97316" stopOpacity="0.45" />
                  <stop offset="50%" stopColor="#f43f5e" stopOpacity="0.3" />
                  <stop offset="100%" stopColor="#4cd7f6" stopOpacity="0.35" />
                </linearGradient>
              </defs>
              <polygon
                points="100,20 180,100 100,180 20,100"
                fill="none"
                stroke="rgba(255,255,255,0.12)"
              />
              <polygon
                points="100,45 155,100 100,155 45,100"
                fill="none"
                stroke="rgba(255,255,255,0.08)"
              />
              <polygon
                points="100,70 130,100 100,130 70,100"
                fill="none"
                stroke="rgba(255,255,255,0.06)"
              />
              <line x1="100" x2="100" y1="10" y2="190" stroke="rgba(255,255,255,0.1)" />
              <line x1="10" x2="190" y1="100" y2="100" stroke="rgba(255,255,255,0.1)" />
              <polygon
                points="100,28 152,100 100,140 76,100"
                fill="url(#radarFill)"
                stroke="#ffb690"
                strokeWidth="2"
              />
              <circle cx="100" cy="28" r="4.5" fill="#f43f5e" stroke="#fff" strokeWidth="1.5" />
              <circle cx="152" cy="100" r="4" fill="#f97316" stroke="#fff" strokeWidth="1.5" />
              <circle cx="100" cy="140" r="4" fill="#4cd7f6" stroke="#fff" strokeWidth="1.5" />
              <circle cx="76" cy="100" r="3.5" fill="#a6a9b6" stroke="#fff" strokeWidth="1.5" />
              <text x="100" y="14" textAnchor="middle" fill="#f43f5e" fontSize="9" fontFamily="monospace" fontWeight="bold">
                EMAIL MX (44%)
              </text>
              <text x="156" y="103" fill="#f97316" fontSize="8" fontFamily="monospace" fontWeight="bold">
                PROXY (31%)
              </text>
              <text x="100" y="196" textAnchor="middle" fill="#4cd7f6" fontSize="8" fontFamily="monospace" fontWeight="bold">
                DWELL (19%)
              </text>
              <text x="42" y="103" textAnchor="end" fill="#a6a9b6" fontSize="8" fontFamily="monospace" fontWeight="bold">
                GEO (6%)
              </text>
            </svg>
          </div>

          <div className="flex flex-col gap-2 border-t border-[var(--border-hairline)] pt-2">
            {[
              { label: "Disposable MX", pct: 44, n: 965, color: "bg-alert-rose", text: "text-alert-rose" },
              { label: "Tor/DC Proxies", pct: 31, n: 680, color: "bg-primary-container", text: "text-primary" },
              { label: "Dwell < 3s", pct: 19, n: 416, color: "bg-tertiary", text: "text-tertiary" },
            ].map((row) => (
              <div key={row.label}>
                <div className="mb-0.5 flex items-center justify-between text-xs">
                  <span className="flex items-center gap-1.5 text-on-surface">
                    <span className={cn("size-2 rounded-full", row.color)} />
                    {row.label}
                  </span>
                  <span className="font-mono">
                    <span className="font-bold text-on-surface">{row.pct}%</span>
                    <span className="text-[10px] text-on-surface-variant"> ({row.n})</span>
                  </span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-surface-container-lowest">
                  <div className={cn("h-full rounded-full", row.color)} style={{ width: `${row.pct}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Telemetry + IP graph */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
        <div className="flex flex-col gap-4 rounded-2xl border border-[var(--border-hairline)] bg-surface-container-low p-5 shadow-sm lg:col-span-8">
          <div className="flex items-center justify-between border-b border-[var(--border-hairline)] pb-3">
            <div className="flex items-center gap-3">
              <div className="flex size-8 items-center justify-center rounded-lg border border-alert-rose/30 bg-alert-rose/15 text-alert-rose">
                <span className="material-symbols-outlined text-[18px]">sensors</span>
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-bold tracking-tight text-on-surface">
                    Live Anomaly Telemetry Stream
                  </h2>
                  <span className="rounded border border-marketing-amber/30 bg-marketing-amber/10 px-2 py-0.5 font-mono text-[10px] text-marketing-amber">
                    ILLUSTRATIVE
                  </span>
                </div>
                <p className="text-xs text-on-surface-variant">UTM + conversion gate heuristics</p>
              </div>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="border-b border-[var(--border-hairline)] bg-surface-container-lowest font-mono text-[10px] tracking-wider text-on-surface-variant uppercase">
                  <th className="rounded-l-lg px-3 py-2.5">Time</th>
                  <th className="px-3 py-2.5">Campaign / UTM</th>
                  <th className="px-3 py-2.5">Platform</th>
                  <th className="px-3 py-2.5">Vector</th>
                  <th className="px-3 py-2.5 text-center">Score</th>
                  <th className="px-3 py-2.5 text-right">Drain</th>
                  <th className="rounded-r-lg px-3 py-2.5 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-hairline)] font-mono text-xs">
                {[
                  {
                    t: "14:22:08",
                    camp: "TOFU-Lookalike-Tier1",
                    utm: "utm_src=fb_cbo",
                    plat: "Meta",
                    platC: "text-[#1877f2] bg-[#1877f2]/15 border-[#1877f2]/30",
                    vec: "@yopmail.com burst",
                    vecSub: "42 leads / 10m · /24 subnet",
                    score: "18/100",
                    scoreC: "bg-alert-rose/20 text-alert-rose border-alert-rose/30",
                    drain: "−$420/hr",
                    drainC: "text-alert-rose",
                    act: "KILL SWITCH",
                    actC: "bg-alert-rose text-white",
                  },
                  {
                    t: "14:21:49",
                    camp: "Spark-UGC-Viral-03",
                    utm: "utm_src=tt_spark",
                    plat: "TikTok",
                    platC: "text-white bg-white/15 border-white/30",
                    vec: "Sub-1.5s Dwell Farm",
                    vecSub: "Ashburn VA (AWS)",
                    score: "22/100",
                    scoreC: "bg-marketing-amber/20 text-marketing-amber border-marketing-amber/30",
                    drain: "−$180/hr",
                    drainC: "text-marketing-amber",
                    act: "Bid Cut −40%",
                    actC: "bg-marketing-amber/20 text-marketing-amber border border-marketing-amber/40",
                  },
                  {
                    t: "14:20:11",
                    camp: "HVAC-Emergency-Search",
                    utm: "utm_term=emergency+ac",
                    plat: "Google",
                    platC: "text-primary bg-primary-container/15 border-primary-container/30",
                    vec: "Click Hijack Loop",
                    vecSub: "Scraper UA match",
                    score: "29/100",
                    scoreC: "bg-marketing-amber/20 text-marketing-amber border-marketing-amber/30",
                    drain: "−$95/hr",
                    drainC: "text-marketing-amber",
                    act: "IP Blacklist",
                    actC: "bg-tertiary/20 text-tertiary border border-tertiary/40",
                  },
                  {
                    t: "14:19:02",
                    camp: "MOFU-Retarget-Enterprise",
                    utm: "utm_src=meta_lead",
                    plat: "Meta",
                    platC: "text-[#1877f2] bg-[#1877f2]/15 border-[#1877f2]/30",
                    vec: "Valid Corporate MX",
                    vecSub: "LinkedIn company match",
                    score: "76/100",
                    scoreC: "bg-success-emerald/20 text-success-emerald border-success-emerald/30",
                    drain: "$0.00",
                    drainC: "text-success-emerald",
                    act: "Ingested to CRM",
                    actC: "bg-success-emerald/20 text-success-emerald border border-success-emerald/30",
                  },
                ].map((row) => (
                  <tr key={row.t + row.camp} className="transition-colors hover:bg-surface-container/60">
                    <td className="px-3 py-3 whitespace-nowrap text-on-surface-variant">{row.t}</td>
                    <td className="px-3 py-3">
                      <div className="flex flex-col">
                        <span className="font-sans font-bold text-on-surface">{row.camp}</span>
                        <span className="text-[10px] text-on-surface-variant">{row.utm}</span>
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      <span
                        className={cn(
                          "inline-flex items-center gap-1.5 rounded border px-2 py-0.5 text-[11px] font-semibold",
                          row.platC
                        )}
                      >
                        {row.plat}
                      </span>
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex flex-col font-sans">
                        <span className={cn("font-semibold", row.drainC)}>{row.vec}</span>
                        <span className="font-mono text-[10px] text-on-surface-variant">{row.vecSub}</span>
                      </div>
                    </td>
                    <td className="px-3 py-3 text-center">
                      <span className={cn("rounded border px-2 py-0.5 font-bold", row.scoreC)}>
                        {row.score}
                      </span>
                    </td>
                    <td className={cn("px-3 py-3 text-right font-bold", row.drainC)}>{row.drain}</td>
                    <td className="px-3 py-3 text-right">
                      <span className={cn("rounded px-2 py-0.5 text-[10px] font-bold", row.actC)}>
                        {row.act}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* IP cluster */}
        <div className="flex flex-col justify-between rounded-2xl border border-[var(--border-hairline)] bg-surface-container-low p-5 shadow-sm lg:col-span-4">
          <div className="flex items-center justify-between border-b border-[var(--border-hairline)] pb-3">
            <div className="flex items-center gap-2.5">
              <div className="flex size-8 items-center justify-center rounded-lg border border-tertiary/30 bg-tertiary/15 text-tertiary">
                <span className="material-symbols-outlined text-[18px]">hub</span>
              </div>
              <div>
                <h2 className="text-base font-bold tracking-tight text-on-surface">IP Cluster Network</h2>
                <p className="text-[11px] text-on-surface-variant">Scraping subnets & proxy nodes</p>
              </div>
            </div>
            <span className="font-mono text-[10px] text-marketing-amber">ILLUSTRATIVE</span>
          </div>
          <div className="relative my-2 flex h-52 items-center justify-center overflow-hidden rounded-xl border border-[var(--border-hairline)] bg-obsidian-base/70">
            <svg className="h-full w-full" viewBox="0 0 300 200">
              <defs>
                <radialGradient id="hubGlow" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor="#f43f5e" stopOpacity="0.4" />
                  <stop offset="100%" stopColor="#f43f5e" stopOpacity="0" />
                </radialGradient>
              </defs>
              <circle cx="150" cy="100" r="70" fill="none" stroke="rgba(255,255,255,0.08)" strokeDasharray="3,3" />
              <circle cx="150" cy="100" r="40" fill="none" stroke="rgba(255,255,255,0.06)" />
              <line x1="150" y1="100" x2="60" y2="45" stroke="#f43f5e" strokeDasharray="4,2" strokeWidth="1.5" />
              <line x1="150" y1="100" x2="240" y2="55" stroke="#f43f5e" strokeDasharray="4,2" strokeWidth="1.5" />
              <line x1="150" y1="100" x2="230" y2="160" stroke="#f97316" strokeDasharray="3,3" strokeWidth="1.2" />
              <line x1="150" y1="100" x2="70" y2="150" stroke="#4cd7f6" strokeWidth="1.5" />
              <circle cx="150" cy="100" r="28" fill="url(#hubGlow)" />
              <circle cx="150" cy="100" r="14" fill="#1e1f25" stroke="#f97316" strokeWidth="2" />
              <circle cx="150" cy="100" r="16" fill="#f97316" opacity="0.6" className="animate-ping" />
              <text x="150" y="103" textAnchor="middle" fill="#fff" fontSize="8" fontFamily="monospace" fontWeight="bold">
                CAPI
              </text>
              <circle cx="60" cy="45" r="8" fill="#f43f5e" />
              <text x="60" y="32" textAnchor="middle" fill="#f43f5e" fontSize="7" fontFamily="monospace" fontWeight="bold">
                AS16509 (Ashburn)
              </text>
              <circle cx="240" cy="55" r="7" fill="#f43f5e" />
              <text x="240" y="44" textAnchor="middle" fill="#f43f5e" fontSize="7" fontFamily="monospace" fontWeight="bold">
                AS14061 (FRA)
              </text>
              <circle cx="230" cy="160" r="6" fill="#f97316" />
              <text x="230" y="176" textAnchor="middle" fill="#f97316" fontSize="7" fontFamily="monospace" fontWeight="bold">
                Tor Relay #42
              </text>
              <circle cx="70" cy="150" r="6" fill="#10b981" />
              <text x="70" y="166" textAnchor="middle" fill="#10b981" fontSize="7" fontFamily="monospace" fontWeight="bold">
                Verified Office IP
              </text>
            </svg>
          </div>
          <div className="flex flex-col gap-2 border-t border-[var(--border-hairline)] pt-2 font-mono text-xs">
            <div className="flex justify-between">
              <span className="text-on-surface-variant">Quarantined Subnets</span>
              <span className="font-bold text-on-surface">14 CIDRs</span>
            </div>
            <div className="flex justify-between">
              <span className="text-on-surface-variant">Cloudflare WAF</span>
              <span className="flex items-center gap-1 font-bold text-success-emerald">
                <span className="size-1.5 rounded-full bg-success-emerald" /> In Sync
              </span>
            </div>
            <button
              type="button"
              onClick={pushBannedCidr}
              className="mt-1 flex w-full items-center justify-center gap-1.5 rounded-lg border border-[var(--border-hairline)] bg-surface-container py-1.5 font-sans text-xs font-semibold text-primary hover:bg-surface-container-high"
            >
              <span className="material-symbols-outlined text-[15px]">security_update_warning</span>
              Push Banned CIDR to Edge WAF
            </button>
          </div>
        </div>
      </div>

      {/* Defense switches */}
      <div className="flex flex-col gap-4 rounded-2xl border border-[var(--border-hairline)] bg-surface-container-low p-5 shadow-sm">
        <div className="flex flex-col justify-between gap-3 border-b border-[var(--border-hairline)] pb-3 sm:flex-row sm:items-center">
          <div className="flex items-center gap-3">
            <div className="flex size-8 items-center justify-center rounded-lg border border-primary-container/30 bg-primary-container/15 text-primary">
              <span className="material-symbols-outlined text-[18px]">tune</span>
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-base font-bold tracking-tight text-on-surface">
                  Autonomous Defense Switches & Safeguard Ledger
                </h2>
                <span className="flex items-center gap-1 rounded border border-success-emerald/30 bg-success-emerald/10 px-2 py-0.5 font-mono text-[10px] font-bold text-success-emerald">
                  <span className="size-1.5 animate-pulse rounded-full bg-success-emerald" />
                  HEURISTIC CIRCUIT ARMED
                </span>
              </div>
              <p className="text-xs text-on-surface-variant">
                Programmatic response &lt;50ms of webhook arrival
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          {[
            {
              key: "pause" as const,
              title: "Instant Auto-Pause on Bot Spike",
              desc: "Pauses adset if waste exceeds 35% in a rolling 15-min bucket",
              meta: "Threshold: 35% / 15m",
              status: "Preference only — never auto-pauses",
            },
            {
              key: "capi" as const,
              title: "CAPI Conversion Discard",
              desc: "Do not transmit conversion if Score ≤ 35",
              meta: "Threshold: Score ≤ 35",
              status: "Drop Active",
            },
            {
              key: "slack" as const,
              title: "Slack #growth-security Hook",
              desc: "Real-time webhook with forensic payload",
              meta: "Channel: #growth-sec",
              status: "Preference only",
              statusTone: "text-on-surface-variant",
            },
          ].map((s) => (
            <div
              key={s.key}
              className="flex flex-col justify-between gap-3 rounded-xl border border-[var(--border-hairline)] bg-surface-container p-4 transition-all hover:border-primary-container/40"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <span className="text-xs font-bold text-on-surface">{s.title}</span>
                  <p className="mt-0.5 text-[11px] text-on-surface-variant">{s.desc}</p>
                </div>
                <label className="relative inline-flex shrink-0 cursor-pointer items-center">
                  <input
                    type="checkbox"
                    className="peer sr-only"
                    checked={switches[s.key]}
                    onChange={(e) => onSwitchChange(s.key, e.target.checked)}
                  />
                  <div className="relative h-5 w-9 rounded-full bg-surface-container-highest shadow-inner after:absolute after:top-[2px] after:left-[2px] after:h-4 after:w-4 after:rounded-full after:bg-white after:transition-all peer-checked:bg-primary-container peer-checked:after:translate-x-full" />
                </label>
              </div>
              <div className="flex items-center justify-between border-t border-[var(--border-hairline)] pt-2 font-mono text-[10px] text-on-surface-variant">
                <span>{s.meta}</span>
                <span className={cn("font-bold", s.statusTone ?? "text-success-emerald")}>
                  {s.status}
                </span>
              </div>
            </div>
          ))}
        </div>

        <div className="flex flex-col justify-between gap-3 rounded-xl border border-[var(--border-hairline)] bg-surface-container-highest/60 p-3.5 sm:flex-row sm:items-center">
          <div className="flex items-center gap-3">
            <div className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-tertiary/20 text-tertiary">
              <span className="material-symbols-outlined text-[17px]">history</span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs font-bold text-on-surface">
                  120m Two-Way Rollback State Machine Armed
                </span>
                <span className="rounded bg-success-emerald/10 px-1.5 font-mono text-[10px] text-success-emerald">
                  Zero Data Loss
                </span>
              </div>
              <span className="text-[11px] text-on-surface-variant">
                Instant restitution on kill-switches and bid adjustments.
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={auditStateMachine}
            className="flex items-center gap-1.5 rounded-lg border border-[var(--border-hairline)] bg-surface-container px-3 py-1.5 font-mono text-xs text-on-surface hover:bg-surface-container-high"
          >
            <span className="material-symbols-outlined text-[14px] text-tertiary">restart_alt</span>
            Audit State Machine
          </button>
        </div>
      </div>

      <div
        className={cn(
          "fixed right-6 bottom-6 z-50 flex max-w-md items-center gap-2 rounded-lg border border-[var(--border-hairline)] bg-surface-container-high px-4 py-2.5 text-xs text-on-surface shadow-2xl transition-all duration-200",
          toast ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-3 opacity-0"
        )}
      >
        {toast?.err ? (
          <span className="material-symbols-outlined shrink-0 text-[18px] text-alert-rose">error</span>
        ) : (
          <span className="material-symbols-outlined shrink-0 text-[18px] text-success-emerald">check_circle</span>
        )}
        <span>{toast?.msg ?? "Ready"}</span>
      </div>
    </div>
  );
}

function KpiCard({
  title,
  value,
  badge,
  badgeTone,
  icon,
  iconTone,
  footerL,
  footerR,
  children,
  right,
  valueClass,
}: {
  title: string;
  value: string;
  badge: string;
  badgeTone: "good" | "bad" | "cyan" | "muted";
  icon: string | null;
  iconTone: "orange" | "rose" | "cyan" | "good";
  footerL: string;
  footerR: string;
  children?: ReactNode;
  right?: ReactNode;
  valueClass?: string;
}) {
  const badgeMap = {
    good: "text-success-emerald bg-success-emerald/10 border-success-emerald/30",
    bad: "text-alert-rose bg-alert-rose/10 border-alert-rose/30",
    cyan: "text-tertiary bg-tertiary/10 border-tertiary/30",
    muted: "text-on-surface-variant bg-surface-container border-transparent",
  };
  const iconMap = {
    orange: "bg-primary-container/15 border-primary-container/30 text-primary shadow-[0_0_12px_rgba(249,115,22,0.2)]",
    rose: "bg-alert-rose/15 border-alert-rose/30 text-alert-rose shadow-[0_0_12px_rgba(244,63,94,0.2)]",
    cyan: "bg-tertiary/15 border-tertiary/30 text-tertiary shadow-[0_0_12px_rgba(76,215,246,0.2)]",
    good: "bg-success-emerald/15 border-success-emerald/30 text-success-emerald",
  };
  return (
    <div className="group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-[var(--border-hairline)] bg-surface-container-low p-4 shadow-sm transition-all hover:border-primary-container/40">
      <div className="flex items-start justify-between">
        <div>
          <span className="font-mono text-[11px] font-semibold tracking-wider text-on-surface-variant uppercase">
            {title}
          </span>
          <div className="mt-1 flex items-baseline gap-2">
            <span className={cn("text-2xl font-bold tracking-tight text-on-surface", valueClass)}>
              {value}
            </span>
            <span className={cn("rounded border px-1.5 py-0.5 font-mono text-[10px] font-bold", badgeMap[badgeTone])}>
              {badge}
            </span>
          </div>
        </div>
        {right ??
          (icon ? (
            <div className={cn("flex size-9 items-center justify-center rounded-xl border", iconMap[iconTone])}>
              <span className="material-symbols-outlined text-[20px]">{icon}</span>
            </div>
          ) : null)}
      </div>
      {children}
      <div className="mt-2 flex items-center justify-between border-t border-[var(--border-hairline)] pt-2 font-mono text-[11px] text-on-surface-variant">
        <span>{footerL}</span>
        <span
          className={cn(
            "font-bold",
            badgeTone === "good" && "text-success-emerald",
            badgeTone === "bad" && "text-alert-rose",
            badgeTone === "cyan" && "text-tertiary",
            badgeTone === "muted" && "text-primary"
          )}
        >
          {footerR}
        </span>
      </div>
    </div>
  );
}
