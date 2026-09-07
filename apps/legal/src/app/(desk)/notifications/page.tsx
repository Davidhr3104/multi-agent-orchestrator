"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { StoredRfp } from "@helix/core";
import type { ConflictReport } from "@/lib/conflict-types";
import { countdownLabel, extractDeadlines } from "@/lib/rfp-intel";
import { cn } from "@/lib/utils";

type Note = {
  id: string;
  kind: "review" | "deadline" | "conflict";
  priority: number;
  title: string;
  detail: string;
  href: string;
};

export default function NotificationsPage() {
  const [rfps, setRfps] = useState<StoredRfp[]>([]);
  const [conflicts, setConflicts] = useState<Record<string, ConflictReport>>({});
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    void fetch("/api/rfps")
      .then((r) => r.json())
      .then((d: { rfps?: StoredRfp[]; conflicts?: Record<string, ConflictReport> }) => {
        setRfps(d.rfps ?? []);
        setConflicts(d.conflicts ?? {});
      });
  }, []);

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(id);
  }, []);

  const notes = useMemo<Note[]>(() => {
    const list: Note[] = [];
    for (const rfp of rfps) {
      if (rfp.needsReview) {
        list.push({
          id: `review-${rfp.id}`,
          kind: "review",
          priority: 1,
          title: "HITL review",
          detail: `${rfp.title} awaiting partner sign-off.`,
          href: `/?open=${encodeURIComponent(rfp.id)}&tab=overview`,
        });
      }
      const due = extractDeadlines(rfp, now)[0];
      if (due && due.days != null && due.days >= 0 && due.days <= 7) {
        list.push({
          id: `due-${rfp.id}-${due.label}`,
          kind: "deadline",
          priority: due.days < 1 ? 0 : 2,
          title: `${due.label} · ${countdownLabel(due.days)}`,
          detail: `${rfp.title} (${rfp.issuer}) — ${due.date}`,
          href: `/?open=${encodeURIComponent(rfp.id)}&tab=deadlines`,
        });
      }
      const coi = conflicts[rfp.id];
      if (coi && coi.verdict !== "GO") {
        list.push({
          id: `coi-${rfp.id}`,
          kind: "conflict",
          priority: coi.verdict === "NO-GO" ? 0 : 2,
          title: `COI ${coi.verdict}`,
          detail: `${rfp.issuer}: ${coi.why}`,
          href: `/?open=${encodeURIComponent(rfp.id)}&tab=conflicts`,
        });
      }
    }
    return list.sort((a, b) => a.priority - b.priority);
  }, [rfps, conflicts, now]);

  const counts = {
    review: notes.filter((n) => n.kind === "review").length,
    deadline: notes.filter((n) => n.kind === "deadline").length,
    conflict: notes.filter((n) => n.kind === "conflict").length,
  };

  return (
    <main className="mx-auto w-full max-w-[1720px] flex-1 space-y-4 p-5">
      <div className="animate-entrance stagger-1">
        <h1 className="text-[18px] font-semibold text-[#F3F4F6]">Notifications</h1>
        <p className="mt-1 text-[12px] text-[#6B7280]">
          Review queue, 7-day deadlines, and COI hits — open jumps straight into the RFP sheet.
        </p>
      </div>

      <section className="animate-entrance stagger-2 grid gap-4 sm:grid-cols-3">
        {(
          [
            ["REVIEW", counts.review, "text-[#FCD34D]"],
            ["DEADLINES", counts.deadline, "text-[#FCA5A5]"],
            ["COI", counts.conflict, "text-[#F59E0B]"],
          ] as const
        ).map(([label, n, color]) => (
          <div key={label} className="rounded-[6px] border border-[#1F2937] bg-[#111827] p-4 shadow-subtle">
            <p className="text-[10px] font-semibold tracking-wide text-[#9CA3AF] uppercase">{label}</p>
            <p className={cn("font-mono-numbers mt-2 text-[28px] leading-none font-bold", color)}>{n}</p>
          </div>
        ))}
      </section>

      <section className="animate-entrance stagger-3 overflow-hidden rounded-[6px] border border-[#1F2937] bg-[#111827] shadow-subtle">
        {notes.length === 0 ? (
          <div className="px-4 py-10 text-center">
            <p className="text-[12px] text-[#9CA3AF]">No open alerts.</p>
            <p className="mt-1 text-[11px] text-[#6B7280]">Review, deadline, and COI items appear here.</p>
          </div>
        ) : (
          <ul className="divide-y divide-[#1F2937]">
            {notes.map((note) => (
              <li key={note.id} className="table-row-interactive flex items-start justify-between gap-4 px-4 py-3">
                <div className="min-w-0">
                  <div className="mb-1 flex flex-wrap items-center gap-2">
                    <span
                      className={cn(
                        "rounded-[3px] px-1.5 py-0.5 text-[9px] font-semibold uppercase",
                        note.kind === "deadline"
                          ? "bg-[#7F1D1D] text-[#FCA5A5]"
                          : note.kind === "conflict"
                            ? "border border-[#F59E0B] text-[#F59E0B]"
                            : "bg-[#422006] text-[#FCD34D]"
                      )}
                    >
                      {note.kind}
                    </span>
                    <p className="text-[12px] font-semibold text-[#F3F4F6]">{note.title}</p>
                  </div>
                  <p className="text-[11px] text-[#9CA3AF]">{note.detail}</p>
                </div>
                <Link
                  href={note.href}
                  className="btn-tactile shrink-0 rounded-[3px] border border-[#F59E0B] px-2.5 py-1 text-[10px] font-semibold text-[#F59E0B] hover:bg-[#F59E0B] hover:text-[#0B0F19]"
                >
                  Open →
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
