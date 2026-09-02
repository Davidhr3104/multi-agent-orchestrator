"use client";

import { useEffect, useState } from "react";
import { sourceAttribution, type StoredLead } from "@helix/core";
import { HelixPage } from "@/components/helix-page";

export default function AnalyticsPage() {
  const [rows, setRows] = useState<{ source: string; total: number; hotPct: number }[]>([]);

  useEffect(() => {
    void fetch("/api/leads")
      .then((r) => r.json())
      .then((data: { leads?: StoredLead[]; attribution?: typeof rows }) => {
        setRows(data.attribution ?? sourceAttribution(data.leads ?? []));
      });
  }, []);

  return (
    <HelixPage title="Analytics" hint="Share of hot leads by inbound source.">
      <div className="card-bg rounded-xl p-5">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {rows.map((row) => (
            <div key={row.source}>
              <div className="mb-1 flex justify-between text-xs text-slate-400">
                <span>
                  {row.source}: {row.hotPct}% hot leads
                </span>
                <span>{row.total}</span>
              </div>
              <div className="h-1 w-full overflow-hidden rounded-full bg-slate-800">
                <div className="h-full bg-emerald-500" style={{ width: `${row.hotPct}%` }} />
              </div>
            </div>
          ))}
          {rows.length === 0 ? <p className="text-sm text-slate-500">No source data yet.</p> : null}
        </div>
      </div>
    </HelixPage>
  );
}
