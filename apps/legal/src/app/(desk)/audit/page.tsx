"use client";

import { useEffect, useMemo, useState } from "react";
import type { AuditEvent } from "@/lib/audit-types";
import { cn } from "@/lib/utils";

const STAGE: Record<string, { label: string; className: string; order: number }> = {
  seed: { label: "System", className: "bg-[#1F2937] text-[#9CA3AF]", order: 0 },
  ingest: { label: "Ingest", className: "bg-[#1E3A8A] text-[#93C5FD]", order: 1 },
  coi: { label: "COI", className: "border border-[#F59E0B] text-[#F59E0B]", order: 2 },
  quote: { label: "Bid", className: "bg-[#422006] text-[#FCD34D]", order: 3 },
  review: { label: "Review", className: "bg-[#7F1D1D] text-[#FCA5A5]", order: 4 },
  compliance: { label: "Compliance", className: "bg-[#4C1D95] text-[#C4B5FD]", order: 5 },
  proposal: { label: "Proposal", className: "bg-[#064E3B] text-[#6EE7B7]", order: 5.5 },
  settings: { label: "Settings", className: "bg-[#1F2937] text-[#9CA3AF]", order: 6 },
  comms: { label: "Comms", className: "bg-[#164E63] text-[#67E8F9]", order: 7 },
};

function stageOf(action: string) {
  return STAGE[action] ?? { label: action, className: "bg-[#1F2937] text-[#9CA3AF]", order: 9 };
}

export default function AuditPage() {
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [filter, setFilter] = useState<string>("all");

  useEffect(() => {
    void fetch("/api/audit")
      .then((r) => r.json())
      .then((d: { events?: AuditEvent[] }) => setEvents(d.events ?? []));
  }, []);

  const filters = useMemo(() => {
    const keys = new Set(events.map((e) => e.action));
    return ["all", ...[...keys].sort((a, b) => (STAGE[a]?.order ?? 9) - (STAGE[b]?.order ?? 9))];
  }, [events]);

  const visible = filter === "all" ? events : events.filter((e) => e.action === filter);

  return (
    <main className="mx-auto w-full max-w-[1720px] flex-1 space-y-4 p-5">
      <div className="animate-entrance stagger-1">
        <h1 className="text-[18px] font-semibold text-[#F3F4F6]">Audit Log</h1>
        <p className="mt-1 text-[12px] text-[#6B7280]">
          Timeline: ingest → COI → bid → review / compliance. Vault encrypted in transit (TLS 1.3).
        </p>
      </div>

      <div className="animate-entrance stagger-2 flex flex-wrap gap-2">
        {filters.map((f) => (
          <button
            key={f}
            type="button"
            className={cn(
              "btn-tactile rounded-[4px] px-2.5 py-1 text-[11px]",
              filter === f
                ? "bg-[#F59E0B] font-semibold text-[#0B0F19]"
                : "border border-[#374151] text-[#9CA3AF] hover:border-[#6B7280] hover:text-[#F3F4F6]"
            )}
            onClick={() => setFilter(f)}
          >
            {f === "all" ? "All" : stageOf(f).label}
          </button>
        ))}
      </div>

      <section className="animate-entrance stagger-3 rounded-[6px] border border-[#1F2937] bg-[#111827] p-4 shadow-subtle">
        {visible.length === 0 ? (
          <p className="py-8 text-center text-[12px] text-[#9CA3AF]">No audit events yet.</p>
        ) : (
          <ol className="relative ml-2 space-y-0 border-l border-[#1F2937] pl-5">
            {visible.map((ev, i) => {
              const stage = stageOf(ev.action);
              return (
                <li key={ev.id} className="relative pb-5 last:pb-0">
                  <span
                    className={cn(
                      "absolute top-1.5 -left-[23px] size-2.5 rounded-full border-2 border-[#111827]",
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
                  <p className="mt-1 text-[12px] text-[#F3F4F6]">{ev.detail}</p>
                </li>
              );
            })}
          </ol>
        )}
      </section>
    </main>
  );
}
