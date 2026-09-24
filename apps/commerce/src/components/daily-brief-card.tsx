"use client";

import { useEffect, useState } from "react";
import type { DailyOpsBrief } from "@/lib/daily-brief";
import { formatCurrency } from "@/lib/format";

export function DailyBriefCard() {
  const [brief, setBrief] = useState<DailyOpsBrief | null>(null);

  useEffect(() => {
    void fetch("/api/daily-brief")
      .then((r) => r.json())
      .then((d: { brief: DailyOpsBrief }) => setBrief(d.brief));
  }, []);

  if (!brief || brief.ordersToday === 0) return null;

  return (
    <div className="glass-panel rounded-xl border border-amber-500/20 p-4 text-xs">
      <p className="font-medium text-foreground">
        Today: {brief.highRiskCount} high-risk order{brief.highRiskCount === 1 ? "" : "s"}, {formatCurrency(brief.highRiskUsd)} on hold
      </p>
      {brief.topOrders.length > 0 ? (
        <ul className="mt-1.5 space-y-0.5 text-muted-foreground">
          {brief.topOrders.map((o) => (
            <li key={o.id}>
              • {o.label} — {formatCurrency(o.usd)} (score {o.fraudScore})
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
