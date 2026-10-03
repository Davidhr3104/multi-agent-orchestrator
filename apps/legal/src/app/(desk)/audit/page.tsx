"use client";

import { useEffect, useMemo, useState } from "react";
import { ChartCard, StackedBar } from "@helix/ui";
import { Ink } from "@/components/desk-charts";
import { countBy } from "@/lib/desk-metrics";
import type { AuditEvent } from "@/lib/audit-types";
import { splitAuditDetail } from "@/lib/audit-trace";
import { cn } from "@/lib/utils";

const STAGE_COLOR: Record<string, string> = {
  seed: "#64748b",
  ingest: "#3b82f6",
  coi: "#f59e0b",
  quote: "#fbbf24",
  review: "#f87171",
  compliance: "#a78bfa",
  proposal: "#34d399",
  partner: "#93c5fd",
  settings: "#94a3b8",
  comms: "#22d3ee",
  outcome: "#34d399",
};

const STAGE: Record<string, { label: string; className: string; order: number }> = {
  seed: { label: "System", className: "bg-[#1b2a45] text-[#9CA3AF]", order: 0 },
  ingest: { label: "Ingest", className: "bg-[#1E3A8A] text-[#93C5FD]", order: 1 },
  coi: { label: "COI", className: "border border-[#F59E0B] text-[#F59E0B]", order: 2 },
  quote: { label: "Bid", className: "bg-[#422006] text-[#FCD34D]", order: 3 },
  review: { label: "Review", className: "bg-[#7F1D1D] text-[#FCA5A5]", order: 4 },
  compliance: { label: "Compliance", className: "bg-[#4C1D95] text-[#C4B5FD]", order: 5 },
  proposal: { label: "Proposal", className: "bg-[#064E3B] text-[#6EE7B7]", order: 5.5 },
  partner: { label: "Partner", className: "bg-[#1E3A8A] text-[#93C5FD]", order: 4.5 },
  settings: { label: "Settings", className: "bg-[#1b2a45] text-[#9CA3AF]", order: 6 },
  outcome: { label: "Outcome", className: "bg-[#064E3B] text-[#6EE7B7]", order: 5.8 },
  comms: { label: "Comms", className: "bg-[#164E63] text-[#67E8F9]", order: 7 },
};

function stageOf(action: string) {
  return STAGE[action] ?? { label: action, className: "bg-[#1b2a45] text-[#9CA3AF]", order: 9 };
}

export default function AuditPage() {
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [filter, setFilter] = useState<string>("all");

  useEffect(() => {
    void fetch("/api/audit")
      .then((r) => r.json())
      .then((d: { events?: AuditEvent[] }) => setEvents(d.events ?? []))
      .catch(() => setEvents([]));
  }, []);

  const filters = useMemo(() => {
    const keys = new Set(events.map((e) => e.action));
    return ["all", ...[...keys].sort((a, b) => (STAGE[a]?.order ?? 9) - (STAGE[b]?.order ?? 9))];
  }, [events]);

  const segments = useMemo(
    () =>
      countBy(events, (e) => e.action)
        .sort((a, b) => (STAGE[a.key]?.order ?? 9) - (STAGE[b.key]?.order ?? 9))
        .map((c) => ({ label: stageOf(c.key).label, value: c.count, color: STAGE_COLOR[c.key] ?? "#94a3b8" })),
    [events]
  );
  // The seed ids are stable: a desk whose log is all seed events is the demo desk.
  const demo = events.length > 0 && events.every((e) => e.id.startsWith("seed-a-"));

  const visible = filter === "all" ? events : events.filter((e) => e.action === filter);

  async function exportJson() {
    const body = { exportedAt: new Date().toISOString(), events: visible };
    const canonical = JSON.stringify(body);
    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(canonical));
    const sha256 = [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
    const blob = new Blob([JSON.stringify({ ...body, sha256 }, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "helix-legal-audit.json";
    a.click();
    URL.revokeObjectURL(a.href);
  }

  return (
    <main className="mx-auto w-full max-w-[1720px] flex-1 space-y-4 p-4 sm:p-5">
      <div className="animate-entrance stagger-1 flex flex-wrap items-end justify-between gap-3 print:block">
        <div>
          <h1 className="text-[18px] font-semibold text-[#F3F4F6]">Audit Log</h1>
          <p className="mt-1 max-w-2xl text-[12px] text-[#6B7280]">
            Who decided, which model and prompt, and whether a partner signed. JSON export includes a SHA-256 of the event list. That digest is not a qualified electronic signature. Events without a trace line were recorded before this desk stored the model and prompt.
          </p>
        </div>
        <div className="flex gap-2 print:hidden">
          <button
            type="button"
            className="min-h-10 rounded-[4px] border border-[#374151] px-3 py-1.5 text-[11px] text-[#F3F4F6]"
            onClick={() => void exportJson()}
          >
            Export JSON
          </button>
          <button
            type="button"
            className="min-h-10 rounded-[4px] border border-[#374151] px-3 py-1.5 text-[11px] text-[#F3F4F6]"
            onClick={() => window.print()}
          >
            Export PDF
          </button>
        </div>
      </div>

      <Ink className="animate-entrance stagger-2 print:hidden">
        <ChartCard
          title="Events by type"
          subtitle={`${events.length} recorded event${events.length === 1 ? "" : "s"}`}
          demo={demo}
          source="Source: this desk's audit log. Every event carries an actor and a timestamp."
        >
          <StackedBar segments={segments} ariaLabel={`Audit events by type: ${segments.map((s) => `${s.value} ${s.label}`).join(", ")}`} />
        </ChartCard>
      </Ink>

      <div className="animate-entrance stagger-2 flex flex-wrap gap-2">
        {filters.map((f) => (
          <button
            key={f}
            type="button"
            className={cn(
              "btn-tactile min-h-9 rounded-[4px] px-3 py-1 text-[11px]",
              filter === f
                ? "bg-[#F59E0B] font-semibold text-[#0a1322]"
                : "border border-[#374151] text-[#9CA3AF] hover:border-[#6B7280] hover:text-[#F3F4F6]"
            )}
            onClick={() => setFilter(f)}
          >
            {f === "all" ? "All" : stageOf(f).label}
          </button>
        ))}
      </div>

      <section className="animate-entrance stagger-3 rounded-[6px] border border-[#1b2a45] bg-[#0f1b30] p-4 shadow-subtle">
        {visible.length === 0 ? (
          <p className="py-8 text-center text-[12px] text-[#9CA3AF]">No audit events yet.</p>
        ) : (
          <ol className="relative ml-2 space-y-0 border-l border-[#1b2a45] pl-5">
            {visible.map((ev, i) => {
              const stage = stageOf(ev.action);
              const parsed = splitAuditDetail(ev.detail);
              return (
                <li key={ev.id} className="relative pb-5 last:pb-0">
                  <span
                    className={cn(
                      "absolute top-1.5 -left-[23px] size-2.5 rounded-full border-2 border-[#0f1b30]",
                      i === 0 ? "bg-[#F59E0B]" : "bg-[#374151]"
                    )}
                  />
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={cn("rounded-[3px] px-1.5 py-0.5 text-[9px] font-semibold uppercase", stage.className)}>
                      {stage.label}
                    </span>
                    <span className="font-mono-numbers text-[10px] text-[#6B7280]">
                      {new Date(ev.at).toISOString().replace("T", " ").slice(0, 19)}Z
                    </span>
                    <span className="text-[11px] text-[#F59E0B]">{ev.actor}</span>
                  </div>
                  <p className="mt-1 text-[12px] text-[#F3F4F6]">{parsed.summary}</p>
                  {parsed.trace ? (
                    <p className="mt-1 font-mono-numbers text-[10px] text-[#93C5FD]">{parsed.trace}</p>
                  ) : (
                    <p className="mt-1 text-[10px] text-[#4B5563]">Model, prompt, and approval were not stored on this event.</p>
                  )}
                </li>
              );
            })}
          </ol>
        )}
      </section>
    </main>
  );
}
