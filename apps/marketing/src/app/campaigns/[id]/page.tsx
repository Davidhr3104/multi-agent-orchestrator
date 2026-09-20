"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import type { AttributedLead, StoredCampaign } from "@helix/core";
import { EngineShell } from "@/components/engine-shell";
import { money, recLabel, recTone } from "@/lib/format";
import { cn } from "@/lib/utils";

export default function CampaignDetailPage() {
  const params = useParams<{ id: string }>();
  const [campaign, setCampaign] = useState<StoredCampaign | null>(null);
  const [leads, setLeads] = useState<AttributedLead[]>([]);
  const [unmatched, setUnmatched] = useState(false);
  const [range, setRange] = useState<{ from: string; to: string } | null>(null);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    if (!params.id) return;
    void fetch(`/api/campaigns/${params.id}?window=90d`)
      .then(async (r) => {
        const data = (await r.json()) as {
          campaign?: StoredCampaign;
          leads?: AttributedLead[];
          unmatched?: unknown[];
          from?: string;
          to?: string;
          error?: string;
        };
        if (!r.ok) {
          setMissing(true);
          return;
        }
        if (data.campaign) {
          setCampaign(data.campaign);
          setLeads(data.leads ?? []);
        } else {
          setUnmatched(true);
        }
        if (data.from && data.to) setRange({ from: data.from, to: data.to });
      });
  }, [params.id]);

  return (
    <EngineShell active="engine">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-6 py-8 lg:px-8">
        <a className="text-xs text-[#9CA3AF] hover:text-white" href="/">
          ← Performance Engine
        </a>
        {missing ? (
          <p className="text-sm text-[#9CA3AF]">Campaign not found in the 90d window.</p>
        ) : unmatched ? (
          <div>
            <h1 className="text-2xl font-medium text-white">{params.id}</h1>
            <p className="mt-2 text-sm text-[#9CA3AF]">
              This <span className="font-mono">campaign_id</span> is in the join queue — spend without scored
              leads.{" "}
              <a className="text-[#F97316]" href="/unmatched">
                Open join queue
              </a>
            </p>
          </div>
        ) : campaign ? (
          <>
            <div>
              <h1 className="text-2xl font-medium text-white">{campaign.name}</h1>
              <p className="mt-1 font-mono text-xs text-[#6B7280]">
                {campaign.campaignId}
                {range ? ` · ${range.from} → ${range.to}` : ""}
              </p>
              <p className={cn("mt-3 text-sm font-medium", recTone(campaign.action).text)}>
                REC {recLabel(campaign)} · {Math.round(campaign.confidence * 100)}% confidence
              </p>
            </div>
            <section className="rounded-xl border border-white/[0.08] bg-[#10131a]/85 p-5">
              <dl className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
                <Stat label="Spend" value={money(campaign.spend)} />
                <Stat label="Avg score" value={String(campaign.metrics.avgScore)} />
                <Stat label="Hot leads" value={String(campaign.metrics.nHot)} />
                <Stat
                  label="$ / hot"
                  value={campaign.metrics.costPerHot == null ? "—" : money(campaign.metrics.costPerHot)}
                />
              </dl>
              <p className="mt-4 text-sm text-[#9CA3AF]">{campaign.reasoning}</p>
              {campaign.hitlNote ? (
                <p className="mt-3 text-xs text-[#FBBF24]">HITL note: {campaign.hitlNote}</p>
              ) : null}
            </section>
            <section>
              <h2 className="text-sm font-semibold text-white">Scored leads in window</h2>
              {leads.length === 0 ? (
                <p className="mt-2 text-sm text-[#6B7280]">No leads in this window.</p>
              ) : (
                <ul className="mt-3 divide-y divide-white/[0.06] rounded-xl border border-white/[0.08] bg-[#10131a]/85">
                  {leads.map((l) => (
                    <li key={l.id} className="flex items-center justify-between gap-3 px-4 py-3 text-xs">
                      <div>
                        <p className="font-medium text-white">{l.name}</p>
                        <p className="font-mono text-[#6B7280]">{l.email}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-white">{l.score}</p>
                        <p className="text-[#6B7280]">
                          {l.tier} · {l.classification}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>
            <a className="text-xs text-[#F97316]" href="/review">
              Confirm pause / scale / keep on HITL →
            </a>
          </>
        ) : (
          <p className="text-sm text-[#6B7280]">Loading…</p>
        )}
      </div>
    </EngineShell>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[11px] tracking-wide text-[#6B7280] uppercase">{label}</dt>
      <dd className="mt-1 font-mono text-white">{value}</dd>
    </div>
  );
}
