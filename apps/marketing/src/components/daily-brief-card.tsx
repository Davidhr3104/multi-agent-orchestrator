"use client";

import { useEffect, useState } from "react";
import type { DailyMarketingBrief } from "@/lib/daily-brief";
import { money } from "@/lib/format";

export function DailyBriefCard() {
  const [brief, setBrief] = useState<DailyMarketingBrief | null>(null);

  useEffect(() => {
    void fetch("/api/daily-brief")
      .then((r) => r.json())
      .then((d: { brief: DailyMarketingBrief }) => setBrief(d.brief));
  }, []);

  if (!brief) return null;

  return (
    <div className="glass-panel rounded-xl border border-amber-500/20 p-4 text-xs">
      <p className="font-medium text-foreground">
        Today: {money(brief.todaySpend, 2)} spent · {(brief.wastePct * 100).toFixed(0)}% of 7d spend on spam (
        {money(brief.spendOnSpam, 2)})
      </p>
      <ul className="mt-1.5 space-y-0.5 text-muted-foreground">
        {brief.topWasteCampaign ? (
          <li>
            • Worst offender: {brief.topWasteCampaign.name} — {money(brief.topWasteCampaign.spendOnSpam, 2)} on spam
          </li>
        ) : null}
        {brief.costPerHot !== null ? <li>• Cost per hot lead: {money(brief.costPerHot, 2)}</li> : null}
        {brief.campaignsNeedingReview > 0 ? (
          <li>
            • {brief.campaignsNeedingReview} campaign{brief.campaignsNeedingReview === 1 ? "" : "s"} awaiting HITL
            review
          </li>
        ) : null}
      </ul>
    </div>
  );
}
