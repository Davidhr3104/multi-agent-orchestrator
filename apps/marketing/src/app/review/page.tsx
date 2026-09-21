"use client";

import { useEffect, useState } from "react";
import type { CampaignAction, StoredCampaign } from "@helix/core";
import { EngineShell } from "@/components/engine-shell";
import { money, recLabel, recTone } from "@/lib/format";
import { cn } from "@/lib/utils";

type AdsWrite = {
  attempted: boolean;
  ok: boolean;
  detail: string;
};

export default function ReviewPage() {
  const [campaigns, setCampaigns] = useState<StoredCampaign[]>([]);
  const [note, setNote] = useState("");
  const [toast, setToast] = useState<{ msg: string; err?: boolean } | null>(null);
  const [metaReady, setMetaReady] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function refresh() {
    const res = await fetch("/api/campaigns?window=30d");
    const data = (await res.json()) as { campaigns: StoredCampaign[] };
    setCampaigns((data.campaigns ?? []).filter((c) => c.needsReview));
  }

  useEffect(() => {
    void refresh();
    void fetch("/api/ads/sync")
      .then((r) => r.json())
      .then((d: { metaConfigured?: boolean; writesEnabled?: boolean }) => {
        setMetaReady(Boolean(d.metaConfigured));
      })
      .catch(() => setMetaReady(false));
  }, []);

  async function review(id: string, action: CampaignAction) {
    setBusyId(id);
    const res = await fetch(`/api/campaigns/${id}/review`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, note }),
    });
    const data = (await res.json()) as {
      campaign?: StoredCampaign;
      error?: string;
      adsWrite?: AdsWrite;
    };
    setBusyId(null);
    if (!res.ok) {
      setToast({ msg: data.error || "Review failed", err: true });
      return;
    }
    setNote("");
    const write = data.adsWrite;
    if (write?.attempted && write.ok) {
      setToast({ msg: `Local + Ads Manager: ${write.detail}` });
    } else if (write?.attempted && !write.ok) {
      setToast({ msg: `Saved locally, but Ads write failed: ${write.detail}`, err: true });
    } else {
      setToast({ msg: write?.detail || "Confirmed locally." });
    }
    await refresh();
  }

  return (
    <EngineShell active="review">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-6 py-8 lg:px-8">
        <div>
          <h1 className="text-2xl font-medium text-white">HITL</h1>
          <p className="mt-2 text-sm text-[#9CA3AF]">
            Confirm pause / scale / keep. Pause and scale write to Meta Ads Manager when keys are set
            (numeric campaign ids). Keep stays local. Google Ads write is not live.
          </p>
          <p className="mt-2 text-[11px] text-[#6B7280]">
            Meta write: {metaReady ? "configured (ads_management token required)" : "needs keys in Settings"}
          </p>
        </div>
        {toast ? (
          <p className={cn("text-sm", toast.err ? "text-[#FB7185]" : "text-[#FBBF24]")}>{toast.msg}</p>
        ) : null}
        {campaigns.length === 0 ? (
          <p className="rounded-xl border border-white/[0.08] bg-[#10131a]/85 p-5 text-sm text-[#9CA3AF]">
            No campaigns need review in the 30d window.
          </p>
        ) : (
          <ul className="flex flex-col gap-3">
            {campaigns.map((c) => {
              const tone = recTone(c.action);
              return (
                <li
                  key={c.id}
                  className="rounded-xl border border-white/[0.08] bg-[#10131a]/85 p-5 shadow-lg backdrop-blur-sm"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <a
                        className="text-sm font-semibold text-white hover:text-[#F97316]"
                        href={`/campaigns/${c.campaignId}`}
                      >
                        {c.name}
                      </a>
                      <p className="mt-1 text-xs text-[#6B7280]">
                        {money(c.spend)} · avg {c.metrics.avgScore} · {c.metrics.nLeads} scored ·{" "}
                        {c.platform}
                      </p>
                    </div>
                    <span className={cn("text-xs font-medium", tone.text)}>{recLabel(c)}</span>
                  </div>
                  <p className="mt-3 text-xs text-[#9CA3AF]">{c.reasoning}</p>
                  <textarea
                    className="mt-3 w-full rounded-md border border-white/10 bg-[#08090d] px-2 py-1.5 text-xs text-white outline-none"
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="Optional note"
                    rows={2}
                    value={note}
                  />
                  <div className="mt-3 flex flex-wrap gap-2">
                    {(["pause", "scale", "keep"] as const).map((action) => (
                      <button
                        key={action}
                        disabled={busyId === c.id}
                        className="rounded-md border border-white/[0.12] px-3 py-1.5 text-xs font-medium text-white hover:bg-white/10 disabled:opacity-50"
                        onClick={() => void review(c.id, action)}
                        type="button"
                      >
                        Confirm {action}
                        {action !== "keep" && c.platform === "meta" ? " → Meta" : ""}
                      </button>
                    ))}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </EngineShell>
  );
}
