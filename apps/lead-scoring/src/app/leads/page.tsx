"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { StoredLead } from "@helix/core";
import { HelixPage } from "@/components/helix-page";
import { cn } from "@/lib/utils";

type Filter = "all" | "hot" | "warm" | "cold" | "review" | "lead" | "spam" | "info";

function tierText(tier: StoredLead["tier"]) {
  if (tier === "hot") return "text-emerald-400";
  if (tier === "warm") return "text-amber-400";
  return "text-rose-400";
}

function tierBar(tier: StoredLead["tier"]) {
  if (tier === "hot") return "bg-emerald-500";
  if (tier === "warm") return "bg-amber-500";
  return "bg-rose-500";
}

function rowBar(lead: StoredLead) {
  if (lead.classification === "spam") return "bg-rose-500";
  if (lead.tier === "hot") return "bg-emerald-500";
  if (lead.tier === "warm") return "bg-amber-500";
  return "bg-rose-500";
}

function stageOf(lead: StoredLead) {
  return lead.pipelineStage ?? "new";
}

export default function LeadsPage() {
  const [leads, setLeads] = useState<StoredLead[]>([]);
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void fetch("/api/leads")
      .then((r) => r.json())
      .then((data: { leads?: StoredLead[] }) => {
        setLeads(data.leads ?? []);
      })
      .finally(() => setLoading(false));
  }, []);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return leads.filter((lead) => {
      if (filter === "review" && !lead.needsReview) return false;
      if (filter === "hot" || filter === "warm" || filter === "cold") {
        if (lead.tier !== filter) return false;
      }
      if (filter === "spam" || filter === "lead" || filter === "info") {
        if (lead.classification !== filter) return false;
      }
      if (!q) return true;
      return (
        lead.name.toLowerCase().includes(q) ||
        lead.email.toLowerCase().includes(q) ||
        lead.source.toLowerCase().includes(q) ||
        lead.id.toLowerCase().includes(q)
      );
    });
  }, [leads, filter, query]);

  const filters: { id: Filter; label: string }[] = [
    { id: "all", label: "All" },
    { id: "hot", label: "Hot" },
    { id: "warm", label: "Warm" },
    { id: "cold", label: "Cold" },
    { id: "review", label: "HITL" },
    { id: "lead", label: "Lead" },
    { id: "info", label: "Info" },
    { id: "spam", label: "Spam" },
  ];

  return (
    <HelixPage title="Leads" hint="Full scored roster from seeded and ingested contacts.">
      <div className="card-bg rounded-xl">
        <div className="flex flex-col gap-3 border-b border-sky-900/30 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap gap-2">
            {filters.map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setFilter(f.id)}
                className={cn(
                  "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                  filter === f.id
                    ? "bg-sky-500/20 text-sky-300"
                    : "text-slate-400 hover:bg-white/5 hover:text-slate-200"
                )}
              >
                {f.label}
              </button>
            ))}
          </div>
          <input
            className="h-8 w-full rounded-md border border-sky-900/50 bg-[#0a1e30] px-3 text-sm text-slate-200 placeholder-slate-500 outline-none focus:border-sky-500 sm:max-w-xs"
            placeholder="Filter name, email, source…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Filter leads"
          />
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-sky-900/30 text-slate-500">
                <th className="px-5 py-3 font-medium">Name</th>
                <th className="px-5 py-3 font-medium">Email</th>
                <th className="px-5 py-3 font-medium">Source</th>
                <th className="px-5 py-3 font-medium">Class</th>
                <th className="px-5 py-3 font-medium">Stage</th>
                <th className="px-5 py-3 font-medium">Score</th>
                <th className="px-5 py-3 font-medium">Conf.</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-sky-900/20">
              {visible.map((lead) => (
                <tr key={lead.id} className="relative transition-colors hover:bg-white/5">
                  <td className={cn("absolute top-0 bottom-0 left-0 w-1", rowBar(lead))} />
                  <td className="px-5 py-3 pl-6 font-medium text-white">{lead.name}</td>
                  <td className="px-5 py-3 text-slate-400">{lead.email}</td>
                  <td className="px-5 py-3 text-slate-400">{lead.source}</td>
                  <td className="px-5 py-3 text-slate-400">{lead.classification}</td>
                  <td className="px-5 py-3 capitalize text-slate-400">{stageOf(lead)}</td>
                  <td className="px-5 py-3">
                    <div className="flex w-16 flex-col gap-1">
                      <span className={cn("font-medium", tierText(lead.tier))}>
                        {lead.score} · {lead.tier}
                      </span>
                      <div className="h-1 w-full overflow-hidden rounded-full bg-slate-800">
                        <div
                          className={cn("h-full", tierBar(lead.tier))}
                          style={{ width: `${lead.score}%` }}
                        />
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-3 text-slate-400">
                    {Math.round(lead.confidence * 100)}%
                    {lead.needsReview ? (
                      <span className="ml-1 text-[10px] font-bold text-amber-500">HITL</span>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {loading ? (
            <p className="px-5 py-10 text-center text-sm text-slate-500">Loading leads…</p>
          ) : null}
          {!loading && visible.length === 0 ? (
            <div className="px-5 py-10 text-center">
              <p className="text-sm font-semibold text-white">No leads in this filter</p>
              <p className="mx-auto mt-2 max-w-md text-sm text-slate-400">
                Seeded mock leads load from the API. Adjust filters or ingest from the Dashboard.
              </p>
              <Link href="/" className="mt-3 inline-block text-xs text-sky-400 hover:text-sky-300">
                Open dashboard →
              </Link>
            </div>
          ) : null}
        </div>

        {!loading && visible.length > 0 ? (
          <p className="border-t border-sky-900/30 px-5 py-3 text-xs text-slate-500">
            Showing {visible.length} of {leads.length} leads
          </p>
        ) : null}
      </div>
    </HelixPage>
  );
}
