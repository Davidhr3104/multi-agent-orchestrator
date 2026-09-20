"use client";

import { useEffect, useMemo, useState } from "react";
import type { SpendEvent } from "@helix/core";
import { EngineShell } from "@/components/engine-shell";
import { money, platformLabel } from "@/lib/format";

type Snap = {
  unmatched: SpendEvent[];
  from: string;
  to: string;
  window: string;
};

export default function UnmatchedPage() {
  const [snap, setSnap] = useState<Snap | null>(null);
  const [remapTo, setRemapTo] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  async function load() {
    const res = await fetch("/api/campaigns?window=90d");
    const data = (await res.json()) as Snap;
    setSnap(data);
  }

  useEffect(() => {
    void load();
  }, []);

  const groups = useMemo(() => {
    const map = new Map<
      string,
      { campaignId: string; name: string; platform: SpendEvent["platform"]; spend: number; rows: number }
    >();
    for (const row of snap?.unmatched ?? []) {
      const cur = map.get(row.campaignId) ?? {
        campaignId: row.campaignId,
        name: row.name,
        platform: row.platform,
        spend: 0,
        rows: 0,
      };
      cur.spend += row.spend;
      cur.rows += 1;
      map.set(row.campaignId, cur);
    }
    return [...map.values()].sort((a, b) => b.spend - a.spend);
  }, [snap]);

  async function syncLeads() {
    setBusy("sync");
    setNote(null);
    const res = await fetch("/api/leads/sync", { method: "POST" });
    const data = (await res.json()) as { imported?: number; skipped?: number; error?: string };
    setBusy(null);
    if (!res.ok) {
      setNote(data.error || `Sync failed (${res.status})`);
      return;
    }
    setNote(`Imported ${data.imported ?? 0} scored leads (${data.skipped ?? 0} without campaign_id skipped).`);
    await load();
  }

  async function remap(spendCampaignId: string) {
    const leadCampaignId = (remapTo[spendCampaignId] ?? "").trim();
    if (!leadCampaignId) return;
    setBusy(spendCampaignId);
    setNote(null);
    const res = await fetch("/api/leads/remap", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ spendCampaignId, leadCampaignId }),
    });
    const data = (await res.json()) as { error?: string };
    setBusy(null);
    if (!res.ok) {
      setNote(data.error || `Remap failed (${res.status})`);
      return;
    }
    await load();
  }

  return (
    <EngineShell active="unmatched">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-6 py-8 lg:px-8">
        <div>
          <h1 className="text-2xl font-medium text-white">Join queue</h1>
          <p className="mt-2 text-sm text-[#9CA3AF]">
            Spend with a <span className="font-mono text-white">campaign_id</span> that has no scored leads
            in this window. Helix does not invent a quality score. FACT: unmatched, not “score 0”.
          </p>
          {snap ? (
            <p className="mt-2 font-mono text-xs text-[#6B7280]">
              90d · {snap.from} → {snap.to} · {groups.length} campaign_ids
            </p>
          ) : null}
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy != null}
              className="rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-xs text-white"
              onClick={() => void syncLeads()}
            >
              {busy === "sync" ? "Syncing…" : "Sync scored leads"}
            </button>
          </div>
          {note ? <p className="mt-2 text-xs text-[#F97316]">{note}</p> : null}
        </div>
        {!snap ? (
          <p className="text-sm text-[#6B7280]">Loading join queue…</p>
        ) : groups.length === 0 ? (
          <p className="rounded-xl border border-white/[0.08] bg-[#10131a]/85 p-5 text-sm text-[#9CA3AF]">
            All spend in this window joined a scored lead.
          </p>
        ) : (
          <ul className="flex flex-col gap-3">
            {groups.map((g) => (
              <li
                key={g.campaignId}
                className="rounded-xl border border-white/[0.08] bg-[#10131a]/85 p-5 shadow-lg backdrop-blur-sm"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold text-white">{g.name}</p>
                    <p className="mt-1 font-mono text-xs text-[#6B7280]">
                      {g.campaignId} · {platformLabel(g.platform)} · {g.rows} spend rows
                    </p>
                  </div>
                  <p className="font-mono text-sm text-[#F97316]">{money(g.spend)}</p>
                </div>
                <p className="mt-3 text-xs text-[#9CA3AF]">
                  Map this spend id to a lead <span className="font-mono text-white">campaign_id</span>, or Sync
                  scored leads from Helix for Leads. Meta/Google stay disconnected.
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <input
                    className="min-w-[12rem] flex-1 rounded-md border border-white/10 bg-black/30 px-2 py-1 font-mono text-xs text-white"
                    placeholder="lead campaign_id"
                    value={remapTo[g.campaignId] ?? ""}
                    onChange={(e) => setRemapTo((prev) => ({ ...prev, [g.campaignId]: e.target.value }))}
                  />
                  <button
                    type="button"
                    disabled={busy != null}
                    className="rounded-md border border-white/15 px-3 py-1 text-xs text-white"
                    onClick={() => void remap(g.campaignId)}
                  >
                    Remap
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </EngineShell>
  );
}
