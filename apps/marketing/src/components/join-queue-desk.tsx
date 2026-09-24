"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { AttributedLead, CampaignRemap, SpendEvent, StoredCampaign } from "@helix/core";
import { loadJson, saveJson } from "@/lib/desk-prefs";
import { money } from "@/lib/format";
import { cn } from "@/lib/utils";

type Tab = "pending" | "matched" | "regex" | "dead";
type ChannelFilter = "all" | "meta" | "google" | "other" | null;
type WarehouseName = "Snowflake" | "BigQuery" | "ClickHouse";

const PARSER_PATTERN = "(?P<network>meta|google|tiktok)_(?P<funnel>tofu|mofu|bofu)_(?P<geo>[A-Z]{2})";
const WAREHOUSES: { name: WarehouseName; icon: string; ic: string }[] = [
  { name: "Snowflake", icon: "ac_unit", ic: "text-tertiary" },
  { name: "BigQuery", icon: "database", ic: "text-primary-container" },
  { name: "ClickHouse", icon: "bolt", ic: "text-marketing-amber" },
];

const WEIGHTS = [
  { id: "click", label: "Click Timestamp Proximity", pct: 40, color: "#f97316" },
  { id: "cookie", label: "Deterministic Cookie ID", pct: 45, color: "#fb923c" },
  { id: "ip", label: "IP / Subnet Fallback", pct: 15, color: "#4cd7f6" },
] as const;

/** Donut + stacked arc for heuristic reallocation weights */
function HeuristicWeightsVisual() {
  const [hover, setHover] = useState<string | null>(null);
  const R = 54;
  const CX = 70;
  const CY = 70;
  const C = 2 * Math.PI * R;

  const arcs = useMemo(() => {
    let offset = 0;
    return WEIGHTS.map((w) => {
      const len = (w.pct / 100) * C;
      const item = { ...w, dash: len, gap: C - len, offset };
      offset += len;
      return item;
    });
  }, []);

  return (
    <div className="space-y-3 rounded-xl bg-surface-container p-4">
      <div className="flex items-center justify-between">
        <span className="text-[16px] font-medium text-on-surface">Heuristic Weights</span>
        <span className="font-mono text-[10px] text-marketing-amber">Linear Decay · Reallocation</span>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative shrink-0">
          <svg viewBox="0 0 140 140" className="size-36 -rotate-90">
            <circle cx={CX} cy={CY} r={R} fill="none" stroke="#0d0e13" strokeWidth="18" />
            {arcs.map((a) => {
              const dim = hover && hover !== a.id;
              return (
                <circle
                  key={a.id}
                  cx={CX}
                  cy={CY}
                  r={R}
                  fill="none"
                  stroke={a.color}
                  strokeWidth={hover === a.id ? 22 : 16}
                  strokeDasharray={`${a.dash} ${a.gap}`}
                  strokeDashoffset={-a.offset}
                  strokeLinecap="butt"
                  opacity={dim ? 0.25 : 1}
                  className="cursor-pointer transition-all duration-200"
                  onMouseEnter={() => setHover(a.id)}
                  onMouseLeave={() => setHover(null)}
                />
              );
            })}
          </svg>
          <div className="absolute inset-0 flex rotate-0 flex-col items-center justify-center">
            <span className="font-mono text-[11px] text-outline">Σ weights</span>
            <span className="text-lg font-bold text-on-surface">100%</span>
          </div>
        </div>

        <div className="min-w-0 flex-1 space-y-2">
          {WEIGHTS.map((w) => {
            const on = !hover || hover === w.id;
            return (
              <button
                key={w.id}
                type="button"
                className={cn(
                  "w-full rounded-lg border border-[var(--border-hairline)] bg-obsidian-base p-2 text-left transition-opacity",
                  on ? "opacity-100" : "opacity-35"
                )}
                onMouseEnter={() => setHover(w.id)}
                onMouseLeave={() => setHover(null)}
              >
                <div className="mb-1 flex items-center justify-between font-mono text-[10px]">
                  <span className="flex items-center gap-1.5 text-on-surface-variant">
                    <span className="size-2 rounded-full" style={{ background: w.color }} />
                    {w.label}
                  </span>
                  <span className="font-bold text-on-surface">{w.pct}%</span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-surface-container-lowest">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{ width: `${w.pct}%`, background: w.color }}
                  />
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Stacked allocation strip */}
      <div className="space-y-1">
        <div className="font-mono text-[9px] tracking-wider text-outline uppercase">
          Touchpoint reallocation mix
        </div>
        <div className="flex h-3 overflow-hidden rounded-full border border-[var(--border-hairline)]">
          {WEIGHTS.map((w) => (
            <div
              key={w.id}
              className="h-full transition-all"
              style={{
                width: `${w.pct}%`,
                background: w.color,
                opacity: hover && hover !== w.id ? 0.3 : 1,
              }}
              onMouseEnter={() => setHover(w.id)}
              onMouseLeave={() => setHover(null)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function looksLikeTikTok(row: Pick<SpendEvent, "platform" | "campaignId" | "name">): boolean {
  const hay = `${row.campaignId} ${row.name}`.toLowerCase();
  return hay.includes("tiktok") || hay.includes("tt_") || hay.includes("spark");
}

function channelLabel(row: Pick<SpendEvent, "platform" | "campaignId" | "name">): {
  label: string;
  dot: string;
} {
  if (row.platform === "meta") return { label: "Meta Ads", dot: "#1877F2" };
  if (row.platform === "google") return { label: "Google Ads", dot: "#f97316" };
  if (looksLikeTikTok(row)) return { label: "TikTok Ads", dot: "#e3e1e9" };
  return { label: "Other", dot: "#e3e1e9" };
}

function matchesChannelFilter(
  row: SpendEvent,
  channelFilter: ChannelFilter
): boolean {
  if (!channelFilter || channelFilter === "all") return true;
  if (channelFilter === "meta") return row.platform === "meta";
  if (channelFilter === "google") return row.platform === "google";
  // TikTok chip → "other": label includes TikTok OR platform other with tiktok in raw
  const ch = channelLabel(row);
  return (
    ch.label.toLowerCase().includes("tiktok") ||
    (row.platform === "other" && looksLikeTikTok(row))
  );
}

function scoreFromSpend(spend: number): { score: number; conf: string; confTone: "ok" | "warn" | "bad" } {
  if (spend <= 0) return { score: 0, conf: "unjoined", confTone: "bad" };
  const score = Math.min(99, Math.max(20, Math.round(40 + Math.log10(spend + 1) * 18)));
  if (score >= 75) return { score, conf: `${(score / 100 * 98).toFixed(1)}% Confirmed`, confTone: "ok" };
  if (score >= 55) return { score, conf: `${(score / 100 * 90).toFixed(1)}% Ambiguous`, confTone: "warn" };
  return { score, conf: "unjoined", confTone: "bad" };
}

function formatTs(iso: string): string {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso.slice(0, 8) || "—";
    return d.toLocaleTimeString(undefined, { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" });
  } catch {
    return "—";
  }
}

function looseMatch(a: string, b: string): boolean {
  const x = a.trim().toLowerCase();
  const y = b.trim().toLowerCase();
  if (!x || !y) return false;
  return x.includes(y) || y.includes(x);
}

export function JoinQueueDesk() {
  const [tab, setTab] = useState<Tab>("pending");
  const [unmatched, setUnmatched] = useState<SpendEvent[]>([]);
  const [leads, setLeads] = useState<AttributedLead[]>([]);
  const [campaigns, setCampaigns] = useState<StoredCampaign[]>([]);
  const [remaps, setRemaps] = useState<CampaignRemap[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [filterQ, setFilterQ] = useState("");
  const [channelFilter, setChannelFilter] = useState<ChannelFilter>(null);
  const [warehouse, setWarehouse] = useState<WarehouseName>(() =>
    loadJson<WarehouseName>("join.warehouse", "Snowflake")
  );
  const [parserPattern] = useState(PARSER_PATTERN);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<{ msg: string; err?: boolean } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function showToast(msg: string, err = false) {
    setToast({ msg, err });
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 4200);
  }

  const refresh = useCallback(async () => {
    const [deskRes, remapRes] = await Promise.all([
      fetch("/api/campaigns?window=90d"),
      fetch("/api/leads/remap"),
    ]);
    const desk = (await deskRes.json()) as {
      unmatched?: SpendEvent[];
      leads?: AttributedLead[];
      campaigns?: StoredCampaign[];
    };
    const remapData = (await remapRes.json()) as { remaps?: CampaignRemap[] };
    setUnmatched(desk.unmatched ?? []);
    setLeads(desk.leads ?? []);
    setCampaigns(desk.campaigns ?? []);
    setRemaps(remapData.remaps ?? []);
    setSelectedIds(new Set());
  }, []);

  useEffect(() => {
    void refresh().catch(() => undefined);
  }, [refresh]);

  useEffect(() => {
    setWarehouse(loadJson<WarehouseName>("join.warehouse", "Snowflake"));
  }, []);

  const orphanSpend = unmatched.reduce((s, u) => s + (u.spend ?? 0), 0);
  const orphanIds = useMemo(() => new Set(unmatched.map((u) => u.campaignId)).size, [unmatched]);

  const filtered = useMemo(() => {
    const q = filterQ.trim().toLowerCase();
    return unmatched.filter((u) => {
      if (!matchesChannelFilter(u, channelFilter)) return false;
      if (!q) return true;
      const ch = channelLabel(u).label.toLowerCase();
      const hay = `${u.campaignId} ${u.name} ${ch} ${u.occurredAt}`.toLowerCase();
      return hay.includes(q);
    });
  }, [unmatched, filterQ, channelFilter]);

  function selectWarehouse(name: WarehouseName) {
    setWarehouse(name);
    saveJson("join.warehouse", name);
    showToast(`${name} is the active ingestion warehouse`);
  }

  function testRegexSandbox() {
    let re: RegExp;
    try {
      // Convert named-group PCRE-ish pattern to a JS-friendly test regex
      const jsPattern = parserPattern
        .replace(/\(\?P<[^>]+>/g, "(")
        .replace(/\{(\d+)\}/g, "{$1}");
      re = new RegExp(jsPattern, "i");
    } catch {
      showToast("Invalid parser pattern", true);
      return;
    }
    const hits = unmatched.filter((u) => re.test(u.campaignId) || re.test(u.name || ""));
    const samples = hits
      .slice(0, 3)
      .map((h) => h.campaignId || h.name)
      .filter(Boolean);
    showToast(
      hits.length === 0
        ? `Regex sandbox: 0 matches of ${unmatched.length} unmatched`
        : `Regex sandbox: ${hits.length} match(es)` +
            (samples.length ? ` — ${samples.join(", ")}` : "")
    );
  }

  function commitSchemaRule() {
    const payload = {
      pattern: parserPattern,
      warehouse,
      at: new Date().toISOString(),
    };
    saveJson("join.schemaRule", payload);
    showToast(`Committed schema rule → ${warehouse}`);
  }

  const allFilteredSelected =
    filtered.length > 0 && filtered.every((r) => selectedIds.has(r.id));

  async function remapOne(spendCampaignId: string, leadCampaignId: string): Promise<boolean> {
    const res = await fetch("/api/leads/remap", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ spendCampaignId, leadCampaignId }),
    });
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      showToast(data.error || `Remap failed (${res.status})`, true);
      return false;
    }
    return true;
  }

  async function resolveMatch(row: SpendEvent, manual: boolean) {
    const hint = manual ? "Manual override — enter lead campaign id" : "Resolve match — enter lead campaign id";
    const leadCampaignId = window.prompt(hint, row.campaignId)?.trim();
    if (!leadCampaignId) return;
    setBusy(true);
    try {
      const ok = await remapOne(row.campaignId, leadCampaignId);
      if (ok) {
        await refresh();
        showToast(`Mapped ${row.campaignId} → ${leadCampaignId}`);
      }
    } finally {
      setBusy(false);
    }
  }

  async function autoRegexMatcher() {
    if (unmatched.length === 0) {
      showToast("No unmatched spend to match");
      return;
    }
    setBusy(true);
    let count = 0;
    try {
      const names = [
        ...leads.map((l) => ({ id: l.campaignId, name: l.name || l.campaignId })),
        ...campaigns.map((c) => ({ id: c.campaignId, name: c.name || c.campaignId })),
      ];
      const seen = new Set<string>();
      for (const row of unmatched) {
        if (seen.has(row.campaignId)) continue;
        const needle = `${row.name} ${row.campaignId}`;
        const hit = names.find(
          (n) => n.id !== row.campaignId && (looseMatch(n.name, needle) || looseMatch(n.id, row.campaignId))
        );
        if (!hit) continue;
        const ok = await remapOne(row.campaignId, hit.id);
        if (ok) {
          seen.add(row.campaignId);
          count += 1;
        }
      }
      await refresh();
      showToast(count > 0 ? `Auto-regex remapped ${count} campaign(s)` : "No loose name matches found");
    } finally {
      setBusy(false);
    }
  }

  async function onUploadCsv(file: File) {
    setBusy(true);
    try {
      const csv = await file.text();
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
          ? `Ingested ${file.name}. ${data.unmatchedCount} unmatched campaign id(s).`
          : `Ingested ${file.name}.`
      );
    } catch (err) {
      showToast(err instanceof Error ? err.message : String(err), true);
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function runBatchJoiner() {
    setBusy(true);
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
        `Synced ${data.imported ?? 0} leads` +
          (data.skipped ? ` · ${data.skipped} skipped` : "") +
          (data.unmatched != null ? ` · ${data.unmatched} unmatched` : "")
      );
    } catch (err) {
      showToast(err instanceof Error ? err.message : String(err), true);
    } finally {
      setBusy(false);
    }
  }

  async function batchResolve() {
    const ids = [...selectedIds];
    if (ids.length === 0) {
      showToast("Select rows first", true);
      return;
    }
    const leadCampaignId = window.prompt("Lead campaign id for selected rows")?.trim();
    if (!leadCampaignId) return;
    setBusy(true);
    try {
      const rows = unmatched.filter((u) => selectedIds.has(u.id));
      const spendIds = [...new Set(rows.map((r) => r.campaignId))];
      let ok = 0;
      for (const spendCampaignId of spendIds) {
        if (await remapOne(spendCampaignId, leadCampaignId)) ok += 1;
      }
      await refresh();
      showToast(`Batch resolved ${ok}/${spendIds.length} → ${leadCampaignId}`);
    } finally {
      setBusy(false);
    }
  }

  function exportCsv() {
    const rows = filtered.length ? filtered : unmatched;
    if (rows.length === 0) {
      showToast("Nothing to export");
      return;
    }
    const header = ["id", "occurredAt", "platform", "campaignId", "name", "spend"];
    const lines = [
      header.join(","),
      ...rows.map((r) =>
        [r.id, r.occurredAt, r.platform, r.campaignId, JSON.stringify(r.name ?? ""), r.spend ?? 0].join(",")
      ),
    ];
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "unmatched_spend.csv";
    a.click();
    URL.revokeObjectURL(url);
    showToast(`Exported ${rows.length} row(s)`);
  }

  function toggleRow(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAllFiltered() {
    if (allFilteredSelected) {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        for (const r of filtered) next.delete(r.id);
        return next;
      });
    } else {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        for (const r of filtered) next.add(r.id);
        return next;
      });
    }
  }

  const tabCounts = {
    pending: orphanIds,
    matched: remaps.length,
    regex: remaps.length,
    dead: Math.max(0, orphanIds > 0 ? Math.min(orphanIds, remaps.length) : 0),
  };

  return (
    <div className="relative flex w-full flex-col pb-16">
      <div className="pointer-events-none absolute -top-12 left-1/4 -z-10 h-48 w-96 rounded-full bg-primary-container/10 blur-[100px]" />
      <div className="pointer-events-none absolute top-24 right-10 -z-10 h-44 w-72 rounded-full bg-[#1877F2]/15 blur-[90px]" />

      <input
        ref={fileRef}
        type="file"
        accept=".csv,text/csv"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void onUploadCsv(f);
        }}
      />

      {/* Header */}
      <section className="mb-6 flex flex-col justify-between gap-4 xl:flex-row xl:items-end">
        <div className="max-w-3xl space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded bg-primary-container/15 px-2 py-0.5 font-mono text-[10px] font-semibold tracking-wider text-marketing-amber uppercase">
              v4.2 Heuristic Ingestion
            </span>
            <span className="flex items-center gap-1.5 rounded bg-surface-container px-2 py-0.5 font-mono text-[10px] text-tertiary">
              <span className="size-1.5 animate-ping rounded-full bg-tertiary" />
              Live Stream #108
            </span>
            <span className="font-mono text-[10px] text-outline">HASH: e82f_reconcile</span>
          </div>
          <h1 className="text-[32px] leading-10 font-semibold tracking-tight text-on-surface">
            Join Queue & UTM Mapper
          </h1>
          <p className="text-[13px] leading-5 text-on-surface-variant">
            Deterministic UTM normalization, unjoined ad impressions queue, and synthetic touchpoint
            reconciliation
            {orphanIds > 0 ? (
              <>
                {" "}
                · <span className="text-marketing-amber">{orphanIds} live orphans</span> (
                {money(orphanSpend)})
              </>
            ) : null}
            .
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-1.5 self-start xl:self-end">
          <button
            type="button"
            disabled={busy}
            onClick={() => void autoRegexMatcher()}
            className="flex h-9 items-center gap-1.5 rounded-lg bg-surface-container-high px-3 text-xs font-medium text-on-surface shadow-sm hover:bg-surface-container-highest disabled:opacity-50"
          >
            <span className="material-symbols-outlined text-[17px] text-marketing-amber">code_blocks</span>
            Auto-Regex Matcher
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => fileRef.current?.click()}
            className="flex h-9 items-center gap-1.5 rounded-lg bg-surface-container-high px-3 text-xs font-medium text-on-surface shadow-sm hover:bg-surface-container-highest disabled:opacity-50"
          >
            <span className="material-symbols-outlined text-[17px] text-tertiary">upload_file</span>
            Upload Ad Spend CSV
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => void runBatchJoiner()}
            className="flex h-9 items-center gap-1.5 rounded-lg bg-primary-container px-3 text-xs font-semibold text-on-primary-container shadow-md hover:bg-marketing-amber disabled:opacity-50"
          >
            <span className="material-symbols-outlined text-[17px]">play_arrow</span>
            Run Batch Joiner
          </button>
        </div>
      </section>

      {/* KPIs */}
      <section className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="flex flex-col justify-between rounded-xl bg-obsidian-raised p-3 shadow-sm transition-colors hover:bg-[#161824]">
          <div className="mb-2 flex items-center justify-between text-on-surface-variant">
            <span className="text-[11px] font-medium">Unjoined Lead Queue</span>
            <span className="material-symbols-outlined text-[18px] text-marketing-amber">hourglass_top</span>
          </div>
          <div className="text-[32px] leading-10 font-semibold tracking-tight text-on-surface">
            {orphanIds.toLocaleString()}
          </div>
          <div className="flex justify-between font-mono text-[10px]">
            <span className="text-marketing-amber">{unmatched.length} spend events</span>
            <span className="text-outline">{remaps.length} remaps</span>
          </div>
          <div className="mt-3 flex h-7 items-end gap-1 pt-1">
            {[30, 45, 35, 60, 80, 100, 75, 50, 90, 65].map((h, i) => (
              <div
                key={i}
                className={cn(
                  "w-full rounded-t-sm",
                  i >= 4 && i !== 7 ? "bg-primary-container" : "bg-surface-container-highest"
                )}
                style={{ height: `${h}%`, opacity: i === 5 ? 1 : 0.6 + (i % 3) * 0.1 }}
              />
            ))}
          </div>
        </div>

        <div className="flex flex-col justify-between rounded-xl bg-obsidian-raised p-3 shadow-sm">
          <div className="mb-2 flex items-center justify-between text-on-surface-variant">
            <span className="text-[11px] font-medium">Deterministic Match Rate</span>
            <span className="material-symbols-outlined text-[18px] text-success-emerald">verified</span>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-[32px] leading-10 font-semibold tracking-tight text-on-surface">
                {remaps.length > 0 ? remaps.length : "—"}
              </div>
              <div className="flex items-center gap-1 font-mono text-[10px] text-success-emerald">
                <span className="material-symbols-outlined text-[14px]">link</span>
                remaps stored
              </div>
            </div>
            <div className="relative flex size-12 shrink-0 items-center justify-center">
              <svg className="size-full -rotate-90" viewBox="0 0 36 36">
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
                  strokeDasharray={`${Math.min(100, remaps.length * 8)}, 100`}
                  className="text-success-emerald"
                />
              </svg>
              <span className="absolute font-mono text-[10px] text-on-surface">{remaps.length || "—"}</span>
            </div>
          </div>
          <div className="mt-3 font-mono text-[10px] text-outline">From GET /api/leads/remap</div>
        </div>

        <div className="flex flex-col justify-between rounded-xl bg-obsidian-raised p-3 shadow-sm">
          <div className="mb-2 flex items-center justify-between text-on-surface-variant">
            <span className="text-[11px] font-medium">Orphaned Ad Spend</span>
            <span className="material-symbols-outlined text-[18px] text-alert-rose">money_off</span>
          </div>
          <div className="text-[32px] leading-10 font-semibold tracking-tight text-alert-rose">
            {money(orphanSpend)}
          </div>
          <div className="font-mono text-[10px] text-on-surface-variant">
            {orphanIds} unmapped campaigns
          </div>
          <div className="mt-3 flex h-7 items-center">
            <svg className="h-full w-full overflow-visible" viewBox="0 0 100 24" preserveAspectRatio="none">
              <polyline
                fill="none"
                points="0,20 20,20 20,15 45,15 45,8 70,8 70,12 100,4"
                stroke="#f43f5e"
                strokeWidth="2"
              />
              <circle cx="100" cy="4" r="3" fill="#f43f5e" />
            </svg>
          </div>
        </div>

        <div className="flex flex-col justify-between rounded-xl bg-obsidian-raised p-3 shadow-sm">
          <div className="mb-2 flex items-center justify-between text-on-surface-variant">
            <span className="text-[11px] font-medium">Mean Join Latency</span>
            <span className="material-symbols-outlined text-[18px] text-tertiary">speed</span>
          </div>
          <div className="flex items-baseline gap-1.5 text-[32px] leading-10 font-semibold tracking-tight text-on-surface">
            —
          </div>
          <div className="flex items-center gap-2">
            <span className="rounded bg-surface-container px-1.5 py-0.5 font-mono text-[10px] text-outline">
              No telemetry
            </span>
          </div>
          <div className="mt-3 flex justify-between font-mono text-[10px] text-outline">
            <span>p99: —</span>
            <span>{busy ? "Working…" : "Idle"}</span>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-12">
        <section className="flex flex-col gap-3 lg:col-span-8">
          <div className="flex flex-col overflow-hidden rounded-xl bg-obsidian-raised shadow-md">
            <div className="flex flex-wrap items-center justify-between gap-2 bg-obsidian-base px-3 pt-2">
              <div className="flex items-center gap-1 overflow-x-auto">
                {(
                  [
                    { id: "pending" as const, label: "Pending Joins", count: String(tabCounts.pending), hot: true },
                    { id: "matched" as const, label: "Matched & Synced", count: String(tabCounts.matched) },
                    { id: "regex" as const, label: "Regex Rules", count: String(tabCounts.regex) },
                    { id: "dead" as const, label: "Dead-Letter", count: String(tabCounts.dead), dead: true },
                  ] as const
                ).map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setTab(t.id)}
                    className={cn(
                      "flex items-center gap-1.5 rounded-t px-3 py-2 text-xs transition-colors",
                      tab === t.id
                        ? "bg-surface-container font-semibold text-on-surface shadow-sm"
                        : "text-on-surface-variant hover:text-on-surface"
                    )}
                  >
                    {t.label}
                    <span
                      className={cn(
                        "rounded-full px-1.5 font-mono text-[10px]",
                        "hot" in t && t.hot && tab === t.id
                          ? "bg-primary-container text-on-primary-container"
                          : "dead" in t && t.dead
                            ? "bg-alert-rose/20 text-alert-rose"
                            : "text-outline"
                      )}
                    >
                      {t.count}
                    </span>
                  </button>
                ))}
              </div>
              <span className="pb-2 font-mono text-[10px] text-outline">Auto-sync: 5s</span>
            </div>

            <div className="flex flex-col justify-between gap-2 p-3 md:flex-row md:items-center">
              <div className="relative max-w-md flex-1">
                <span className="material-symbols-outlined absolute top-2 left-2.5 text-[18px] text-outline">
                  search
                </span>
                <input
                  className="h-8 w-full rounded-lg bg-obsidian-base pr-3 pl-8 text-[12px] text-on-surface placeholder:text-outline focus:ring-1 focus:ring-primary-container focus:outline-none"
                  placeholder="Filter UTM, campaigns, CID…"
                  type="search"
                  value={filterQ}
                  onChange={(e) => setFilterQ(e.target.value)}
                />
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                {(
                  [
                    { label: "Meta Ads", c: "#1877F2", filter: "meta" as const },
                    { label: "Google Ads", c: "#f97316", filter: "google" as const },
                    { label: "TikTok Ads", c: "#e3e1e9", filter: "other" as const },
                  ] as const
                ).map((f) => {
                  const on = channelFilter === f.filter;
                  return (
                    <button
                      key={f.label}
                      type="button"
                      onClick={() =>
                        setChannelFilter((prev) => (prev === f.filter ? null : f.filter))
                      }
                      className={cn(
                        "flex items-center gap-1.5 rounded-full px-2.5 py-1 font-mono text-[10px]",
                        on
                          ? "bg-primary-container/25 font-semibold text-on-surface ring-1 ring-primary-container/50"
                          : "bg-surface-container text-on-surface hover:bg-surface-container-high"
                      )}
                    >
                      <span className="size-2 rounded-full" style={{ background: f.c }} />
                      {f.label}
                    </button>
                  );
                })}
                <button
                  type="button"
                  onClick={() => {
                    setFilterQ("");
                    setChannelFilter(null);
                  }}
                  className="flex items-center gap-1 rounded-full bg-surface-container-low px-2.5 py-1 font-mono text-[10px] text-tertiary hover:bg-surface-container"
                >
                  <span className="material-symbols-outlined text-[12px]">filter_alt_off</span>
                  Clear
                </button>
              </div>
            </div>

            <div className="w-full overflow-x-auto">
              <table className="w-full border-collapse text-left text-[12px]">
                <thead>
                  <tr className="h-9 bg-obsidian-base font-mono text-[10px] tracking-wider text-outline uppercase">
                    <th className="w-8 px-3 py-2">
                      <input
                        type="checkbox"
                        className="accent-primary-container"
                        checked={allFilteredSelected}
                        onChange={toggleAllFiltered}
                        disabled={tab !== "pending" || filtered.length === 0}
                      />
                    </th>
                    <th className="px-2 py-2">Timestamp</th>
                    <th className="px-2 py-2">Channel</th>
                    <th className="px-2 py-2">Raw UTM</th>
                    <th className="px-2 py-2">Normalized</th>
                    <th className="px-2 py-2 text-right">Score</th>
                    <th className="px-2 py-2">Confidence</th>
                    <th className="px-3 py-2 text-right">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {tab === "matched" && remaps.length > 0
                    ? remaps.map((r, i) => (
                        <tr
                          key={`${r.spendCampaignId}-${r.leadCampaignId}`}
                          className={cn(
                            "h-11 transition-colors hover:bg-[#161824]",
                            i % 2 === 0 ? "bg-obsidian-raised" : "bg-obsidian-base"
                          )}
                        >
                          <td className="px-3 py-2">
                            <input type="checkbox" className="accent-primary-container" disabled />
                          </td>
                          <td className="px-2 py-2 font-mono whitespace-nowrap text-outline">—</td>
                          <td className="px-2 py-2 whitespace-nowrap">
                            <span className="inline-flex items-center gap-1.5 rounded bg-surface-container-low px-2 py-0.5">
                              <span className="size-1.5 rounded-full bg-success-emerald" />
                              <span className="font-medium text-on-surface">Remap</span>
                            </span>
                          </td>
                          <td className="max-w-[200px] truncate px-2 py-2 font-mono text-on-surface-variant">
                            {r.spendCampaignId}
                          </td>
                          <td className="px-2 py-2 whitespace-nowrap">
                            <span className="rounded bg-surface-container px-2 py-0.5 font-mono text-[10px] text-marketing-amber">
                              {r.leadCampaignId}
                            </span>
                          </td>
                          <td className="px-2 py-2 text-right font-mono font-medium text-on-surface">—</td>
                          <td className="px-2 py-2 whitespace-nowrap">
                            <span className="flex items-center gap-1 font-mono text-[10px] text-success-emerald">
                              <span className="material-symbols-outlined text-[13px]">check_circle</span>
                              Joined
                            </span>
                          </td>
                          <td className="px-3 py-2 text-right whitespace-nowrap">
                            <span className="rounded bg-success-emerald/15 px-2 py-1 font-mono text-[10px] text-success-emerald">
                              Auto-Joined
                            </span>
                          </td>
                        </tr>
                      ))
                    : null}

                  {tab === "pending" && filtered.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-3 py-8 text-center font-mono text-[11px] text-outline">
                        No unmatched spend in this window.
                      </td>
                    </tr>
                  ) : null}

                  {tab !== "pending" && tab !== "matched" ? (
                    <tr>
                      <td colSpan={8} className="px-3 py-8 text-center font-mono text-[11px] text-outline">
                        {tab === "regex"
                          ? `${remaps.length} remap rule(s) active — use Auto-Regex Matcher to add more.`
                          : `${orphanIds} orphan campaign id(s) still pending join.`}
                      </td>
                    </tr>
                  ) : null}

                  {tab === "matched" && remaps.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-3 py-8 text-center font-mono text-[11px] text-outline">
                        No remaps yet. Resolve a match to populate this tab.
                      </td>
                    </tr>
                  ) : null}

                  {tab === "pending"
                    ? filtered.map((row, i) => {
                        const ch = channelLabel(row);
                        const { score, conf, confTone } = scoreFromSpend(row.spend ?? 0);
                        const raw = `${row.campaignId} ${row.name}`.trim();
                        const action = confTone === "bad" ? "manual" : "resolve";
                        return (
                          <tr
                            key={row.id}
                            className={cn(
                              "h-11 transition-colors hover:bg-[#161824]",
                              i % 2 === 0 ? "bg-obsidian-raised" : "bg-obsidian-base"
                            )}
                          >
                            <td className="px-3 py-2">
                              <input
                                type="checkbox"
                                className="accent-primary-container"
                                checked={selectedIds.has(row.id)}
                                onChange={() => toggleRow(row.id)}
                              />
                            </td>
                            <td className="px-2 py-2 font-mono whitespace-nowrap text-outline">
                              {formatTs(row.occurredAt)}
                            </td>
                            <td className="px-2 py-2 whitespace-nowrap">
                              <span className="inline-flex items-center gap-1.5 rounded bg-surface-container-low px-2 py-0.5">
                                <span className="size-1.5 rounded-full" style={{ background: ch.dot }} />
                                <span className="font-medium text-on-surface">{ch.label}</span>
                              </span>
                            </td>
                            <td
                              className="max-w-[200px] truncate px-2 py-2 font-mono text-on-surface-variant"
                              title={raw}
                            >
                              {raw}
                            </td>
                            <td className="px-2 py-2 whitespace-nowrap">
                              <span className="rounded bg-surface-container px-2 py-0.5 font-mono text-[10px] text-marketing-amber">
                                {row.campaignId}
                              </span>
                            </td>
                            <td
                              className={cn(
                                "px-2 py-2 text-right font-mono font-medium",
                                score < 50
                                  ? "text-alert-rose"
                                  : score < 70
                                    ? "text-marketing-amber"
                                    : "text-on-surface"
                              )}
                            >
                              {score}
                              <span className="font-light text-outline">/100</span>
                            </td>
                            <td className="px-2 py-2 whitespace-nowrap">
                              <span
                                className={cn(
                                  "flex items-center gap-1 font-mono text-[10px]",
                                  confTone === "ok" && "text-success-emerald",
                                  confTone === "warn" && "text-marketing-amber",
                                  confTone === "bad" && "text-outline"
                                )}
                              >
                                <span className="material-symbols-outlined text-[13px]">
                                  {confTone === "ok"
                                    ? "check_circle"
                                    : confTone === "warn"
                                      ? "help_center"
                                      : "warning"}
                                </span>
                                {conf}
                              </span>
                            </td>
                            <td className="px-3 py-2 text-right whitespace-nowrap">
                              {action === "resolve" ? (
                                <button
                                  type="button"
                                  disabled={busy}
                                  onClick={() => void resolveMatch(row, false)}
                                  className="rounded bg-primary-container px-2.5 py-1 font-mono text-[10px] font-bold text-on-primary-container hover:bg-marketing-amber disabled:opacity-50"
                                >
                                  Resolve Match
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  disabled={busy}
                                  onClick={() => void resolveMatch(row, true)}
                                  className="rounded bg-surface-container-high px-2.5 py-1 font-mono text-[10px] font-medium text-on-surface hover:bg-surface-container-highest disabled:opacity-50"
                                >
                                  Manual Override
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })
                    : null}
                </tbody>
              </table>
            </div>

            <div className="flex flex-col items-center justify-between gap-3 bg-obsidian-base p-3 sm:flex-row">
              <div className="flex items-center gap-2">
                <span className="rounded bg-primary-container/20 px-2 py-0.5 font-mono text-[10px] font-semibold text-marketing-amber">
                  {selectedIds.size} items selected
                </span>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void batchResolve()}
                  className="rounded bg-surface-container px-3 py-1 font-mono text-[10px] text-on-surface hover:bg-surface-container-high disabled:opacity-50"
                >
                  Batch Resolve
                </button>
                <button
                  type="button"
                  onClick={exportCsv}
                  className="flex items-center gap-1 rounded bg-surface-container px-3 py-1 font-mono text-[10px] text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface"
                >
                  <span className="material-symbols-outlined text-[14px]">download</span>
                  Export CSV
                </button>
              </div>
              <div className="flex items-center gap-1 font-mono text-[10px] text-on-surface-variant">
                <span className="text-on-surface">
                  {filtered.length === 0 ? "0" : `1–${filtered.length}`}
                </span>{" "}
                of <span className="text-on-surface">{tab === "pending" ? unmatched.length : remaps.length}</span>
              </div>
            </div>
          </div>

          <div className="flex flex-col items-center justify-between gap-3 rounded-xl bg-obsidian-raised p-3 shadow-sm md:flex-row">
            <div className="flex items-center gap-3">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-tertiary/10 text-tertiary">
                <span className="material-symbols-outlined text-[20px]">account_tree</span>
              </div>
              <div>
                <div className="text-[16px] font-medium text-on-surface">Join Engine Telemetry Loop</div>
                <div className="text-[11px] text-on-surface-variant">
                  Hash ring repartitioning across 8 shards
                </div>
              </div>
            </div>
            <div className="flex w-full items-center justify-end gap-3 md:w-auto">
              <div className="text-right">
                <span className="block font-mono text-[10px] text-outline">BUFFER UTILIZATION</span>
                <span className="font-mono text-[16px] text-on-surface">1.2 GB / 8 GB</span>
              </div>
              <div className="h-2 w-24 overflow-hidden rounded-full bg-surface-container-high">
                <div className="h-full w-[15%] rounded-full bg-tertiary" />
              </div>
            </div>
          </div>
        </section>

        {/* Right rail */}
        <section className="flex flex-col gap-3 lg:col-span-4">
          <div className="space-y-4 rounded-xl bg-obsidian-raised p-5 shadow-md">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[20px] text-marketing-amber">psychology</span>
                <h2 className="text-[16px] font-semibold text-on-surface">UTM Heuristic Parser</h2>
              </div>
              <span className="rounded bg-surface-container px-2 py-0.5 font-mono text-[10px] text-tertiary">
                v4.2-spec
              </span>
            </div>
            <p className="text-[11px] text-on-surface-variant">
              Test and commit PCRE patterns for deterministic parameter parsing before lake writeback.
            </p>

            <div className="space-y-1.5">
              <div className="flex justify-between font-mono text-[10px]">
                <span className="font-semibold tracking-wider text-outline uppercase">Parser Pattern</span>
                <span className="text-marketing-amber">Strict Mode</span>
              </div>
              <div className="rounded-lg bg-obsidian-base p-2.5 font-mono text-[11px] text-on-surface">
                <span className="text-marketing-amber">(?P&lt;network&gt;</span>
                <span className="text-tertiary">meta|google|tiktok</span>
                <span className="text-marketing-amber">)</span>_
                <span className="text-marketing-amber">(?P&lt;funnel&gt;</span>
                <span className="text-tertiary">tofu|mofu|bofu</span>
                <span className="text-marketing-amber">)</span>_
                <span className="text-marketing-amber">(?P&lt;geo&gt;</span>
                <span className="text-tertiary">[A-Z]{"{2}"}</span>
                <span className="text-marketing-amber">)</span>
              </div>
            </div>

            <div className="space-y-2 rounded-lg bg-obsidian-base p-3">
              <div className="flex justify-between font-mono text-[10px] text-outline">
                <span>CAPTURED SLUGS</span>
                <span className="text-success-emerald">3/3 Matched</span>
              </div>
              {[
                ["network", "meta", "text-marketing-amber"],
                ["funnel", "tofu", "text-tertiary"],
                ["geo", "US", "text-on-surface"],
              ].map(([k, v, c]) => (
                <div
                  key={k}
                  className="flex items-center justify-between rounded bg-surface-container px-2 py-1 font-mono text-[10px]"
                >
                  <span className="text-outline">{k}</span>
                  <span className={cn("font-semibold", c)}>{v}</span>
                </div>
              ))}
            </div>

            <div className="space-y-1.5">
              <div className="flex justify-between font-mono text-[10px]">
                <span className="font-semibold tracking-wider text-outline uppercase">
                  Ingestion Warehouse
                </span>
                <span className="text-success-emerald">Synced 1m ago</span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {WAREHOUSES.map((w) => {
                  const on = warehouse === w.name;
                  return (
                    <button
                      key={w.name}
                      type="button"
                      onClick={() => selectWarehouse(w.name)}
                      className={cn(
                        "flex flex-col items-center justify-center gap-1 rounded-lg px-2 py-2 font-mono text-[10px]",
                        on
                          ? "bg-surface-container-high font-semibold text-on-surface shadow-sm ring-1 ring-primary-container/40"
                          : "bg-surface-container text-on-surface-variant hover:text-on-surface"
                      )}
                    >
                      <span className={cn("material-symbols-outlined text-[16px]", w.ic)}>{w.icon}</span>
                      {w.name}
                    </button>
                  );
                })}
              </div>
            </div>

            <HeuristicWeightsVisual />

            <div className="flex flex-col gap-2 pt-1">
              <button
                type="button"
                onClick={testRegexSandbox}
                className="flex h-9 w-full items-center justify-center gap-1.5 rounded-lg bg-surface-container-high text-xs font-medium text-on-surface hover:bg-surface-container-highest"
              >
                <span className="material-symbols-outlined text-[16px]">science</span>
                Test Regex Sandbox
              </button>
              <button
                type="button"
                onClick={commitSchemaRule}
                className="flex h-9 w-full items-center justify-center gap-1.5 rounded-lg bg-primary-container text-xs font-bold text-on-primary-container shadow-md hover:bg-marketing-amber"
              >
                <span className="material-symbols-outlined text-[16px]">save</span>
                Commit Schema Rule
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between rounded-xl bg-obsidian-raised p-3 shadow-sm">
            <div className="flex items-center gap-2">
              <span className="size-2.5 animate-pulse rounded-full bg-success-emerald" />
              <div>
                <div className="text-[11px] font-medium text-on-surface">Ingestion Daemon #12</div>
                <div className="font-mono text-[10px] text-outline">
                  Throughput: {unmatched.length} unmatched · {remaps.length} remaps
                </div>
              </div>
            </div>
            <span className="material-symbols-outlined text-[18px] text-outline">dns</span>
          </div>
        </section>
      </div>

      <div
        className={cn(
          "fixed right-6 bottom-6 z-50 flex items-center gap-2 rounded-lg border border-[var(--border-hairline)] bg-surface-container-high px-4 py-2.5 text-xs text-on-surface shadow-2xl transition-all duration-200",
          toast ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-3 opacity-0"
        )}
      >
        {toast?.err ? (
          <span className="material-symbols-outlined text-[18px] text-alert-rose">error</span>
        ) : (
          <span className="material-symbols-outlined text-[18px] text-success-emerald">check_circle</span>
        )}
        <span>{toast?.msg ?? "Ready"}</span>
      </div>
    </div>
  );
}
