"use client";

import Link from "next/link";
import type { StoredLead } from "@helix/core";
import { initials, relativeTime, tierLabel, tierTone } from "./lead-ui";
import { cn } from "@/lib/utils";

type Props = {
  leads: StoredLead[];
};

export function PriorityTable({ leads }: Props) {
  const rows = [...leads]
    .filter((l) => l.tier === "hot" && l.classification === "lead")
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);

  return (
    <div className="rounded-xl border border-outline-variant/25 bg-surface-container">
      <div className="flex items-center justify-between border-b border-outline-variant/20 px-5 py-4">
        <div>
          <h3 className="text-sm font-bold text-on-surface">High-Priority Queue</h3>
          <p className="text-xs text-on-surface-variant">Hot tier from live roster</p>
        </div>
        <Link href="/leads?filter=hot" className="text-xs font-semibold text-primary hover:underline">
          Open roster
        </Link>
      </div>
      {rows.length === 0 ? (
        <p className="px-5 py-8 text-center text-sm text-outline">No hot leads yet.</p>
      ) : (
        <ul className="divide-y divide-outline-variant/15">
          {rows.map((lead) => {
            const tone = tierTone(lead);
            return (
              <li key={lead.id}>
                <Link
                  href={`/leads?focus=${lead.id}`}
                  className="flex items-center gap-3 px-5 py-3.5 transition hover:bg-surface-container-high/60"
                >
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary-container text-xs font-bold text-on-primary-container">
                    {initials(lead.name)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-on-surface">{lead.name}</p>
                    <p className="truncate text-xs text-on-surface-variant">
                      {lead.company ?? lead.email} · {relativeTime(lead.createdAt)}
                    </p>
                  </div>
                  <span
                    className={cn(
                      "rounded-full px-2.5 py-0.5 font-mono text-[11px] font-bold",
                      tone === "hot" && "bg-tertiary-container/50 text-tertiary",
                      tone === "warm" && "bg-secondary-container/50 text-secondary",
                      tone === "review" && "bg-error-container/40 text-error"
                    )}
                  >
                    {lead.score} · {tierLabel(lead)}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
