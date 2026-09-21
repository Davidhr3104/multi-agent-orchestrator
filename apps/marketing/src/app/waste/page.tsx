"use client";

import { useEffect, useMemo, useState } from "react";
import type { DeskWasteSummary, StoredCampaign } from "@helix/core";
import { EngineShell } from "@/components/engine-shell";
import { money, platformLabel, recLabel, recTone } from "@/lib/format";
import { cn } from "@/lib/utils";

type Range = "7d" | "30d" | "90d";

export default function WastePage() {
  const [range, setRange] = useState<Range>("7d");
  const [campaigns, setCampaigns] = useState<StoredCampaign[]>([]);
  const [waste, setWaste] = useState<DeskWasteSummary | null>(null);
  const [bounds, setBounds] = useState<{ from: string; to: string } | null>(null);
  const [metaOk, setMetaOk] = useState(false);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  async function load(next: Range = range) {
    const res = await fetch(`/api/campaigns?window=${next}`);
    const data = (await res.json()) as {
      campaigns: StoredCampaign[];
      waste: DeskWasteSummary;
      from: string;
      to: string;
    };
    setCampaigns(data.campaigns ?? []);
    setWaste(data.waste ?? null);
    if (data.from && data.to) setBounds({ from: data.from, to: data.to });
  }

  async function loadMetaStatus() {
    const res = await fetch("/api/ads/sync");
    const data = (await res.json()) as { metaConfigured?: boolean };
    setMetaOk(Boolean(data.metaConfigured));
  }

  useEffect(() => {
    void load(range);
    void loadMetaStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range]);

  const ranked = useMemo(
    () =>
      [...campaigns]
        .filter((c) => c.metrics.spendOnSpam > 0)
        .sort((a, b) => b.metrics.spendOnSpam - a.metrics.spendOnSpam),
    [campaigns]
  );

  async function syncMeta() {
    setBusy(true);
    setNote(null);
    const res = await fetch("/api/ads/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ window: range }),
    });
    const data = (await res.json()) as {
      error?: string;
      imported?: number;
      unmatchedCount?: number;
      message?: string;
    };
    setBusy(false);
    if (!res.ok) {
      setNote(data.error || `Sync failed (${res.status})`);
      return;
    }
    setNote(
      data.message ||
        `Imported ${data.imported ?? 0} Meta insight row(s). Read-only — Ads Manager not written.` +
          (data.unmatchedCount ? ` ${data.unmatchedCount} unmatched campaign_id(s).` : "")
    );
    await load(range);
  }

  return (
    <EngineShell active="waste">
      <main className="mx-auto max-w-[1400px] px-6 py-6 lg:px-8">
        <div className="mb-6 flex flex-col gap-3 border-b border-white/[0.08] pb-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-lg font-semibold tracking-tight text-white">$ on spam</h1>
            <p className="mt-1 max-w-2xl text-xs leading-relaxed text-[#9CA3AF]">
              Spend attributed to spam-classified leads (proportional to spam rate per campaign). This is
              the story Helix sells — not CPL alone. Pause/scale still needs HITL and does not write Ads
              Manager.
            </p>
            {bounds ? (
              <p className="mt-2 font-mono text-[11px] text-[#6B7280]">
                Window {range} · {bounds.from} → {bounds.to}
              </p>
            ) : null}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {(["7d", "30d", "90d"] as Range[]).map((w) => (
              <button
                key={w}
                type="button"
                onClick={() => setRange(w)}
                className={cn(
                  "rounded-md border px-2.5 py-1 text-[11px] font-medium",
                  range === w
                    ? "border-[#F97316]/50 bg-[#F97316]/15 text-[#FDBA74]"
                    : "border-white/[0.1] text-[#9CA3AF] hover:text-white"
                )}
              >
                {w}
              </button>
            ))}
            <button
              type="button"
              disabled={busy}
              onClick={() => void syncMeta()}
              className="rounded-md border border-white/[0.12] bg-[#12151e] px-3 py-1.5 text-[11px] font-medium text-white hover:bg-[#1a1f2b] disabled:opacity-50"
            >
              {busy ? "Syncing…" : metaOk ? "Sync Meta (read)" : "Sync Meta (needs keys)"}
            </button>
          </div>
        </div>

        {note ? (
          <div
            className={cn(
              "mb-4 rounded-lg border px-3 py-2 text-xs",
              note.toLowerCase().includes("fail") || note.toLowerCase().includes("need")
                ? "border-[#D9605F]/40 bg-[#D9605F]/10 text-[#FB7185]"
                : "border-white/[0.1] bg-white/[0.04] text-[#D1D5DB]"
            )}
          >
            {note}
          </div>
        ) : null}

        <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Stat
            label="Spend on spam"
            value={money(waste?.spendOnSpam)}
            hint={`${Math.round((waste?.wastePct ?? 0) * 100)}% of window spend`}
            hot
          />
          <Stat label="Total spend" value={money(waste?.totalSpend)} hint="Joined campaigns only" />
          <Stat
            label="Cost per hot"
            value={money(waste?.costPerHot)}
            hint={`${waste?.nHot ?? 0} hot · ${waste?.nSpam ?? 0} spam`}
          />
          <Stat
            label="Worst burner"
            value={waste?.worstCampaignName ?? "—"}
            hint={waste?.worstSpendOnSpam ? money(waste.worstSpendOnSpam) + " on spam" : "No spam spend yet"}
          />
        </div>

        <div className="overflow-hidden rounded-xl border border-white/[0.08] bg-[#0c0e14]/80">
          <div className="border-b border-white/[0.08] px-4 py-3 text-xs font-medium text-[#9CA3AF]">
            Campaigns ranked by $ on spam
          </div>
          {ranked.length === 0 ? (
            <p className="px-4 py-8 text-sm text-[#6B7280]">
              No spam-attributed spend in this window. Sync Meta or ingest CSV, then sync scored leads from
              Helix Leads.
            </p>
          ) : (
            <table className="w-full text-left text-xs">
              <thead className="border-b border-white/[0.06] text-[10px] uppercase tracking-wide text-[#6B7280]">
                <tr>
                  <th className="px-4 py-2 font-medium">Campaign</th>
                  <th className="px-3 py-2 font-medium">Platform</th>
                  <th className="px-3 py-2 font-medium">Spend</th>
                  <th className="px-3 py-2 font-medium">$ on spam</th>
                  <th className="px-3 py-2 font-medium">Spam rate</th>
                  <th className="px-3 py-2 font-medium">$/hot</th>
                  <th className="px-3 py-2 font-medium">REC</th>
                </tr>
              </thead>
              <tbody>
                {ranked.map((c) => {
                  const tone = recTone(c.action);
                  return (
                    <tr key={c.id} className="border-b border-white/[0.04] hover:bg-white/[0.02]">
                      <td className="px-4 py-2.5">
                        <a href={`/campaigns/${c.campaignId}`} className="font-medium text-white hover:text-[#FDBA74]">
                          {c.name}
                        </a>
                        <div className="font-mono text-[10px] text-[#6B7280]">{c.campaignId}</div>
                      </td>
                      <td className="px-3 py-2.5 text-[#9CA3AF]">{platformLabel(c.platform)}</td>
                      <td className="px-3 py-2.5 text-[#D1D5DB]">{money(c.spend)}</td>
                      <td className="px-3 py-2.5 font-medium text-[#FB7185]">{money(c.metrics.spendOnSpam)}</td>
                      <td className="px-3 py-2.5 text-[#9CA3AF]">
                        {Math.round(c.metrics.spamRate * 100)}%
                        <span className="text-[#6B7280]"> · {c.metrics.nSpam}/{c.metrics.nLeads}</span>
                      </td>
                      <td className="px-3 py-2.5 text-[#D1D5DB]">{money(c.metrics.costPerHot)}</td>
                      <td className="px-3 py-2.5">
                        <span className={cn("rounded px-1.5 py-0.5 text-[10px] font-medium", tone.bg, tone.text)}>
                          {recLabel(c)}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        <p className="mt-4 text-[11px] leading-relaxed text-[#6B7280]">
          Attribution: for each campaign, spendOnSpam = spend × (spam leads / scored leads). Sync Meta is
          Insights read-only. Confirm pause/scale in{" "}
          <a href="/review" className="text-[#F97316] hover:underline">
            HITL
          </a>{" "}
          — writes to Ads Manager when campaign_id is numeric and Meta keys are set.
        </p>
      </main>
    </EngineShell>
  );
}

function Stat({
  label,
  value,
  hint,
  hot,
}: {
  label: string;
  value: string;
  hint: string;
  hot?: boolean;
}) {
  return (
    <div className="rounded-xl border border-white/[0.08] bg-[#0c0e14]/80 px-4 py-3">
      <p className="text-[10px] font-medium uppercase tracking-wide text-[#6B7280]">{label}</p>
      <p className={cn("mt-1 truncate text-xl font-semibold tracking-tight", hot ? "text-[#FB7185]" : "text-white")}>
        {value}
      </p>
      <p className="mt-1 text-[11px] text-[#9CA3AF]">{hint}</p>
    </div>
  );
}
