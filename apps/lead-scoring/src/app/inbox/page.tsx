"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { StoredLead } from "@helix/core";
import { HelixPage } from "@/components/helix-page";

const REPS = [
  { id: "rep-enterprise", name: "Sam Patel" },
  { id: "rep-ana", name: "Ana Ruiz" },
  { id: "rep-luis", name: "Luis Ortega" },
];

export default function InboxPage() {
  const [leads, setLeads] = useState<StoredLead[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    const res = await fetch("/api/leads");
    const data = (await res.json()) as { leads?: StoredLead[] };
    setLeads((data.leads ?? []).filter((l) => l.needsReview));
  }

  useEffect(() => {
    void refresh();
  }, []);

  async function act(id: string, path: "review" | "archive" | "crm") {
    setBusy(`${path}:${id}`);
    setError(null);
    const res = await fetch(`/api/leads/${id}/${path}`, { method: "POST" });
    const data = (await res.json()) as { lead?: StoredLead; error?: string };
    setBusy(null);
    if (!res.ok) {
      setError(data.error || `Failed (${res.status})`);
      return;
    }
    await refresh();
  }

  async function assign(id: string, repId: string) {
    setBusy(`assign:${id}`);
    setError(null);
    const res = await fetch(`/api/leads/${id}/assign`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ repId }),
    });
    const data = (await res.json()) as { error?: string };
    setBusy(null);
    if (!res.ok) {
      setError(data.error || `Assign failed (${res.status})`);
      return;
    }
    await refresh();
  }

  return (
    <HelixPage title="Inbox" hint="HITL queue. Approve, archive, send to CRM, or assign from here.">
      <div className="card-bg rounded-xl p-5">
        {error ? <p className="mb-3 text-sm text-rose-400">{error}</p> : null}
        <ul className="divide-y divide-sky-900/20 text-sm">
          {leads.map((lead) => (
            <li key={lead.id} className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-medium text-white">{lead.name}</p>
                <p className="text-slate-400">{lead.email}</p>
                <p className="mt-1 font-mono text-[11px] text-slate-500">
                  {lead.score} · {lead.tier}
                  {lead.campaignId ? ` · ${lead.campaignId}` : ""}
                  {lead.assignee ? ` · ${lead.assignee}` : ""}
                  {lead.reviewedBy ? ` · last: ${lead.reviewedBy}` : ""}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  disabled={busy != null}
                  className="rounded-md border border-sky-800/60 px-2 py-1 text-[11px] text-sky-200"
                  onClick={() => void act(lead.id, "review")}
                >
                  Approve
                </button>
                <button
                  type="button"
                  disabled={busy != null}
                  className="rounded-md border border-sky-800/60 px-2 py-1 text-[11px] text-sky-200"
                  onClick={() => void act(lead.id, "crm")}
                >
                  Send to CRM
                </button>
                <button
                  type="button"
                  disabled={busy != null}
                  className="rounded-md border border-rose-500/30 px-2 py-1 text-[11px] text-rose-300"
                  onClick={() => void act(lead.id, "archive")}
                >
                  Archive
                </button>
                <select
                  className="rounded-md border border-sky-900/40 bg-slate-950 px-2 py-1 text-[11px] text-slate-200"
                  defaultValue=""
                  disabled={busy != null}
                  onChange={(e) => {
                    if (e.target.value) void assign(lead.id, e.target.value);
                    e.target.value = "";
                  }}
                >
                  <option value="">Assign…</option>
                  {REPS.map((rep) => (
                    <option key={rep.id} value={rep.id}>
                      {rep.name}
                    </option>
                  ))}
                </select>
              </div>
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
