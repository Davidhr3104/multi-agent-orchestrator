"use client";

import { useEffect, useState } from "react";
import { HelixPage } from "@/components/helix-page";

type Usage = {
  ingestCount: number;
  heuristicCalls: number;
  claudeCalls: number;
  ghlCalls: number;
  estimatedTokens: number;
  claudeKey: boolean;
  ghlKey: boolean;
};

export default function UsagePage() {
  const [u, setU] = useState<Usage | null>(null);

  useEffect(() => {
    void fetch("/api/usage")
      .then((r) => r.json())
      .then(setU);
  }, []);

  const cards = u
    ? [
        { label: "Ingests", value: String(u.ingestCount) },
        { label: "Heuristic calls", value: String(u.heuristicCalls) },
        { label: "Claude calls", value: String(u.claudeCalls) },
        { label: "Est. tokens", value: String(u.estimatedTokens) },
        { label: "GHL calls", value: String(u.ghlCalls) },
        { label: "Keys", value: `Claude ${u.claudeKey ? "on" : "off"} · GHL ${u.ghlKey ? "on" : "off"}` },
      ]
    : [];

  return (
    <HelixPage title="Usage & API" hint="This session’s AI and CRM consumption. Restarts reset in-memory counters.">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((c) => (
          <div key={c.label} className="card-bg rounded-xl p-4">
            <p className="text-xs font-medium text-slate-400">{c.label}</p>
            <p className="mt-1 text-2xl font-semibold text-white">{c.value}</p>
          </div>
        ))}
      </div>
    </HelixPage>
  );
}
