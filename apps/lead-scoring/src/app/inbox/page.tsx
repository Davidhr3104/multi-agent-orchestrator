"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { StoredLead } from "@helix/core";
import { HelixPage } from "@/components/helix-page";

export default function InboxPage() {
  const [leads, setLeads] = useState<StoredLead[]>([]);

  useEffect(() => {
    void fetch("/api/leads")
      .then((r) => r.json())
      .then((data: { leads?: StoredLead[] }) => {
        setLeads((data.leads ?? []).filter((l) => l.needsReview));
      });
  }, []);

  return (
    <HelixPage title="Inbox" hint="HITL review queue.">
      <div className="card-bg rounded-xl p-5">
        <ul className="divide-y divide-sky-900/20 text-sm">
          {leads.map((lead) => (
            <li key={lead.id} className="flex items-center justify-between py-3">
              <div>
                <p className="font-medium text-white">{lead.name}</p>
                <p className="text-slate-400">{lead.email}</p>
              </div>
              <span className="text-[10px] font-bold text-amber-500">HITL</span>
            </li>
          ))}
        </ul>
        {leads.length === 0 ? <p className="text-sm text-slate-500">Review queue is clear.</p> : null}
        <Link href="/" className="mt-4 inline-block text-xs text-sky-400 hover:text-sky-300">
          Open dashboard →
        </Link>
      </div>
    </HelixPage>
  );
}
