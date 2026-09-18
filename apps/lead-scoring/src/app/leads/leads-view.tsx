"use client";

import { useMemo, useRef, useState, type DragEvent } from "react";
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

export function LeadsRosterView({ initialLeads }: { initialLeads: StoredLead[] }) {
  const [leads, setLeads] = useState<StoredLead[]>(initialLeads);
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const [importOpen, setImportOpen] = useState(false);
  const [importBusy, setImportBusy] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [importNote, setImportNote] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

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

  async function importFile(file: File) {
    setImportBusy(true);
    setImportError(null);
    setImportNote(null);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/leads/import", { method: "POST", body: form });
      const data = (await res.json()) as {
        imported?: number;
        engine?: string;
        leads?: StoredLead[];
        errors?: { row: number; error: string }[];
        error?: string;
      };
      if (!res.ok || data.error) throw new Error(data.error || `HTTP ${res.status}`);
      const incoming = data.leads ?? [];
      setLeads((prev) => {
        const next = [...incoming, ...prev.filter((l) => !incoming.some((n) => n.id === l.id))];
        return next.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      });
      const skipped = data.errors?.length ? ` · ${data.errors.length} row(s) skipped` : "";
      setImportNote(`Imported ${data.imported ?? incoming.length} · ${data.engine ?? "heuristic"}${skipped}`);
      setImportOpen(false);
    } catch (err) {
      setImportError(err instanceof Error ? err.message : String(err));
    } finally {
      setImportBusy(false);
    }
  }

  function onDrop(e: DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) void importFile(file);
  }

  return (
    <HelixPage
      title="Leads"
      hint="Full scored roster from seeded and ingested contacts."
      actions={
        <button
          type="button"
          onClick={() => {
            setImportOpen(true);
            setImportError(null);
          }}
          className="rounded-md border border-sky-500/40 bg-sky-500/15 px-3 py-1.5 text-xs font-semibold text-sky-200 transition hover:bg-sky-500/25"
        >
          Import leads
        </button>
      }
    >
      {importNote ? <p className="text-xs text-emerald-400">{importNote}</p> : null}

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

          {visible.length === 0 ? (
            <div className="px-5 py-10 text-center">
              <p className="text-sm font-semibold text-white">No leads in this filter</p>
              <p className="mx-auto mt-2 max-w-md text-sm text-slate-400">
                Seeded mock leads load from the API. Import a CSV/JSON or ingest from the Dashboard.
              </p>
              <Link href="/" className="mt-3 inline-block text-xs text-sky-400 hover:text-sky-300">
                Open dashboard →
              </Link>
            </div>
          ) : null}
        </div>

        {visible.length > 0 ? (
          <p className="border-t border-sky-900/30 px-5 py-3 text-xs text-slate-500">
            Showing {visible.length} of {leads.length} leads
          </p>
        ) : null}
      </div>

      {importOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="import-leads-title"
          onClick={() => !importBusy && setImportOpen(false)}
        >
          <div
            className="w-full max-w-lg rounded-xl border border-sky-900/60 bg-[#0a1e30] p-5 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="import-leads-title" className="text-sm font-semibold text-white">
              Import leads
            </h2>
            <p className="mt-1 text-xs text-slate-400">
              Drop a .json (array or {"{ leads: [...] }"}) or .csv. Scored with Claude Sonnet 5 when
              ANTHROPIC_API_KEY is set; otherwise heuristic.
            </p>
            <label
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={onDrop}
              className={cn(
                "mt-4 flex cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed px-4 py-10 text-center transition",
                dragOver ? "border-sky-400 bg-sky-500/10" : "border-sky-900/70 bg-[#071525]"
              )}
            >
              <span className="text-sm text-sky-200">Drop JSON or CSV here</span>
              <span className="mt-1 text-xs text-slate-500">or click to choose a file</span>
              <input
                ref={fileRef}
                type="file"
                accept=".json,.csv,application/json,text/csv"
                className="sr-only"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void importFile(file);
                  e.target.value = "";
                }}
              />
            </label>
            {importError ? <p className="mt-3 text-xs text-rose-400">{importError}</p> : null}
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                disabled={importBusy}
                onClick={() => setImportOpen(false)}
                className="rounded-md px-3 py-1.5 text-xs text-slate-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={importBusy}
                onClick={() => fileRef.current?.click()}
                className="rounded-md border border-sky-500/40 bg-sky-500/15 px-3 py-1.5 text-xs font-semibold text-sky-200"
              >
                {importBusy ? "Scoring…" : "Choose file"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </HelixPage>
  );
}
