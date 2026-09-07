"use client";

import { useEffect, useMemo, useState } from "react";
import type { StoredRfp } from "@helix/core";
import { goNoGo, winAnalytics, winProbability } from "@/lib/rfp-intel";
import { cn } from "@/lib/utils";

export default function AnalyticsPage() {
  const [rfps, setRfps] = useState<StoredRfp[]>([]);

  useEffect(() => {
    void fetch("/api/rfps")
      .then((r) => r.json())
      .then((d: { rfps?: StoredRfp[] }) => setRfps(d.rfps ?? []));
  }, []);

  const analytics = useMemo(() => winAnalytics(rfps), [rfps]);
  const hot = rfps.filter((r) => r.tier === "hot").length;
  const modeled = rfps.length ? Math.round((hot / rfps.length) * 100) : 0;

  return (
    <main className="mx-auto w-full max-w-[1780px] flex-1 space-y-6 px-6 py-7 lg:px-8">
      <div>
        <h1 className="font-heading text-2xl font-bold tracking-tight text-white">Analytics</h1>
        <p className="mt-1 text-sm text-slate-400">
          Modeled win/loss on this desk. Hot = modeled win — not a closed-file archive.
        </p>
      </div>
      <section className="grid gap-4 sm:grid-cols-3">
        <div className="glass-card rounded-2xl p-5">
          <p className="text-xs font-semibold tracking-wider text-slate-400 uppercase">Desk win alignment</p>
          <p className="mt-2 text-3xl font-extrabold text-white">{modeled}%</p>
        </div>
        <div className="glass-card rounded-2xl p-5">
          <p className="text-xs font-semibold tracking-wider text-slate-400 uppercase">Opportunities</p>
          <p className="mt-2 text-3xl font-extrabold text-white">{rfps.length}</p>
        </div>
        <div className="glass-card rounded-2xl p-5">
          <p className="text-xs font-semibold tracking-wider text-slate-400 uppercase">Hot (modeled wins)</p>
          <p className="mt-2 text-3xl font-extrabold text-emerald-400">{hot}</p>
        </div>
      </section>
      <section className="glass-card rounded-2xl p-6">
        <h2 className="font-heading text-lg font-semibold text-white">Win rate by method</h2>
        <p className="mt-1 text-xs text-slate-400">{analytics.insight}</p>
        <div className="mt-4 space-y-3">
          {analytics.slices.map((row) => (
            <div key={row.key}>
              <div className="mb-1 flex justify-between text-xs text-slate-400">
                <span className="font-mono">{row.key}</span>
                <span>
                  {row.rate}% · {row.n} RFP{row.n === 1 ? "" : "s"}
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-navy-950">
                <div className="h-full bg-gold-500" style={{ width: `${row.rate}%` }} />
              </div>
            </div>
          ))}
        </div>
      </section>
      <section className="glass-card overflow-hidden rounded-2xl">
        <div className="border-b border-white/5 px-6 py-4">
          <h2 className="font-heading text-lg font-semibold text-white">Predictive score by RFP</h2>
        </div>
        <table className="w-full text-left text-sm">
          <thead className="text-[11px] font-bold tracking-wide text-slate-400 uppercase">
            <tr className="border-b border-white/10">
              <th className="px-6 py-3">Title</th>
              <th className="px-3 py-3">Method</th>
              <th className="px-3 py-3">Go/No-Go</th>
              <th className="px-3 py-3">Win probability</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {rfps.map((rfp) => {
              const go = goNoGo(rfp);
              const prob = winProbability(rfp, rfps);
              return (
                <tr key={rfp.id}>
                  <td className="px-6 py-3 text-slate-100">{rfp.title}</td>
                  <td className="px-3 py-3 font-mono text-xs text-slate-400">{rfp.method}</td>
                  <td className="px-3 py-3">
                    <span
                      className={cn(
                        "rounded-md border px-2 py-0.5 text-[11px] font-semibold",
                        go.verdict === "NO-GO"
                          ? "border-rose-500/30 text-rose-300"
                          : go.verdict === "CONDITIONAL"
                            ? "border-amber-500/30 text-amber-200"
                            : "border-emerald-500/30 text-emerald-300"
                      )}
                    >
                      {go.verdict} {go.score}
                    </span>
                  </td>
                  <td className="px-3 py-3 font-mono text-gold-400">{prob}%</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>
    </main>
  );
}
