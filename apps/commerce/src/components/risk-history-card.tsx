"use client";

import { useEffect, useState } from "react";
import { formatCurrency } from "@/lib/format";

type Snapshot = {
  date: string;
  ordersCount: number;
  highRiskCount: number;
  highRiskUsd: number;
  savedUsd: number;
};

export function RiskHistoryCard() {
  const [snapshots, setSnapshots] = useState<Snapshot[] | null>(null);

  useEffect(() => {
    void fetch("/api/risk-history")
      .then((r) => r.json())
      .then((d: { snapshots: Snapshot[] }) => setSnapshots(d.snapshots));
  }, []);

  if (snapshots === null) return null;
  if (snapshots.length === 0) {
    return (
      <div className="glass-panel rounded-xl p-5">
        <h3 className="text-sm font-medium text-foreground">$ at risk over time</h3>
        <div className="mt-3 flex h-24 items-center justify-center rounded-lg border border-dashed border-border text-xs text-muted-foreground">
          History starts after the first daily snapshot. The figures above are the desk&apos;s current numbers.
        </div>
        <details className="mt-3 text-[11px] text-muted-foreground">
          <summary className="cursor-pointer hover:text-foreground">Why is this empty?</summary>
          <p className="mt-1.5">
            A snapshot is recorded once a day by the daily-brief job. It needs the scheduled job enabled
            (CRON_SECRET) and Slack configured on the server.
          </p>
        </details>
      </div>
    );
  }

  const totalSaved = snapshots.reduce((s, x) => s + x.savedUsd, 0);
  const max = Math.max(1, ...snapshots.map((s) => s.highRiskUsd));

  return (
    <div className="glass-panel space-y-3 rounded-xl p-5">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-foreground">$ at risk — last {snapshots.length} days</h3>
        <span className="text-xs text-muted-foreground">{formatCurrency(totalSaved)} saved total</span>
      </div>
      <div className="flex h-20 items-end gap-1">
        {[...snapshots].reverse().map((s) => (
          <div
            key={s.date}
            title={`${s.date}: ${formatCurrency(s.highRiskUsd)} at risk, ${formatCurrency(s.savedUsd)} saved`}
            className="flex-1 rounded-t bg-rose-500/40"
            style={{ height: `${Math.max(4, (s.highRiskUsd / max) * 100)}%` }}
          />
        ))}
      </div>
    </div>
  );
}
