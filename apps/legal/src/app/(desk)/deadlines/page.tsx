"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { StoredRfp } from "@helix/core";
import {
  alertCadence,
  countdownLabel,
  downloadDeskCalendar,
  downloadIcs,
  extractDeadlines,
  googleCalendarUrl,
  type DeadlineHit,
} from "@/lib/rfp-intel";
import { cn } from "@/lib/utils";

type Row = DeadlineHit & { rfp: StoredRfp };
type Bucket = "all" | "today" | "week" | "past";
type StageId = "analysis" | "coi" | "approved" | "submitted";

const STAGES: { id: StageId; label: string }[] = [
  { id: "analysis", label: "En análisis" },
  { id: "coi", label: "En revisión COI" },
  { id: "approved", label: "Aprobado" },
  { id: "submitted", label: "Enviado" },
];

const STAGE_KEY = "helix-legal-pursuit-stage";

function loadStages(): Record<string, StageId> {
  try {
    const raw = window.localStorage.getItem(STAGE_KEY);
    return raw ? (JSON.parse(raw) as Record<string, StageId>) : {};
  } catch {
    return {};
  }
}

function inferStage(rfp: StoredRfp): StageId {
  if (rfp.partnerDecision?.outcome === "won") return "submitted";
  if (rfp.partnerDecision) return "approved";
  if (rfp.needsReview) return "coi";
  return "analysis";
}

export default function DeadlinesPage() {
  const [rfps, setRfps] = useState<StoredRfp[]>([]);
  const [now, setNow] = useState(() => Date.now());
  const [bucket, setBucket] = useState<Bucket>("all");
  const [stages, setStages] = useState<Record<string, StageId>>({});
  const [dragId, setDragId] = useState<string | null>(null);

  useEffect(() => {
    setStages(loadStages());
  }, []);

  useEffect(() => {
    void fetch("/api/rfps")
      .then((r) => r.json())
      .then((d: { rfps?: StoredRfp[] }) => setRfps(d.rfps ?? []));
  }, []);

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(id);
  }, []);

  const rows = useMemo<Row[]>(() => {
    return rfps
      .flatMap((rfp) => extractDeadlines(rfp, now).map((hit) => ({ ...hit, rfp })))
      .sort((a, b) => (a.days ?? 999) - (b.days ?? 999));
  }, [rfps, now]);

  const critical = rows.filter((r) => r.days === 0).length;
  const week = rows.filter((r) => r.days != null && r.days >= 1 && r.days <= 7).length;
  const past = rows.filter((r) => r.days != null && r.days < 0).length;
  const visibleRows = rows.filter((r) => {
    if (bucket === "today") return r.days === 0;
    if (bucket === "week") return r.days != null && r.days >= 1 && r.days <= 7;
    if (bucket === "past") return r.days != null && r.days < 0;
    return true;
  });

  function stageOf(rfp: StoredRfp): StageId {
    return stages[rfp.id] ?? inferStage(rfp);
  }

  function moveStage(id: string, stage: StageId) {
    setStages((prev) => {
      const next = { ...prev, [id]: stage };
      window.localStorage.setItem(STAGE_KEY, JSON.stringify(next));
      return next;
    });
  }

  function askPartner(rfp: StoredRfp, stage: string) {
    const url = `${window.location.origin}/deadlines`;
    const body = `Please approve or reject "${rfp.title}" at the ${stage} step.\n\n${url}\n\nSlack is not connected on this desk. This opens your mail app; Helix does not send the message.`;
    window.location.href = `mailto:?subject=${encodeURIComponent(`Helix deadline — ${rfp.title}`)}&body=${encodeURIComponent(body)}`;
  }

  return (
    <main className="mx-auto w-full max-w-[1720px] flex-1 space-y-4 p-5">
      <div className="animate-entrance stagger-1 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[18px] font-semibold text-[#F3F4F6]">Deadlines</h1>
          <p className="mt-1 text-[12px] text-[#6B7280]">
            Parsed submission, Q&A, and site-visit dates. Alerts at 7 / 3 / 1 day.
          </p>
        </div>
        <button
          type="button"
          className="btn-tactile rounded-[4px] border border-[#374151] bg-[#1F2937] px-3 py-1.5 text-[11px] font-medium text-[#9CA3AF] hover:border-[#4B5563] hover:text-[#F3F4F6] disabled:opacity-40"
          onClick={() => downloadDeskCalendar(rfps, now)}
          disabled={rows.length === 0}
        >
          Download all .ics
        </button>
      </div>

      <section className="animate-entrance stagger-2 grid gap-4 sm:grid-cols-3">
        {(
          [
            ["UNDER 24H", critical, "text-[#FCA5A5]", "today"],
            ["NEXT 7 DAYS", week, "text-[#FCD34D]", "week"],
            ["PAST DUE", past, "text-[#9CA3AF]", "past"],
          ] as const
        ).map(([label, value, color, id]) => (
          <button
            key={label}
            type="button"
            className={cn(
              "rounded-[6px] border border-[#1F2937] bg-[#111827] p-4 text-left shadow-subtle",
              bucket === id && "ring-1 ring-[#E5E7EB]"
            )}
            onClick={() => setBucket((current) => (current === id ? "all" : id))}
          >
            <p className="text-[10px] font-semibold tracking-wide text-[#9CA3AF] uppercase">{label}</p>
            <p className={cn("font-mono-numbers mt-2 text-[28px] leading-none font-bold", color)}>{value}</p>
          </button>
        ))}
      </section>

      <section className="animate-entrance stagger-3 rounded-[6px] border border-[#1F2937] bg-[#111827] p-4 shadow-subtle">
        <h2 className="text-[13px] font-semibold text-[#F3F4F6]">Pursuit timeline</h2>
        <p className="mt-1 text-[11px] text-[#6B7280]">
          Drag a pursuit between stages. Ask partner opens your mail app. Slack is not connected.
        </p>
        <div className="mt-3 grid gap-2 md:grid-cols-4">
          {STAGES.map((stage) => (
            <div
              key={stage.id}
              className="min-h-28 rounded-[4px] border border-dashed border-[#374151] bg-[#0B0F19] p-2"
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                const id = e.dataTransfer.getData("text/plain") || dragId;
                if (id) moveStage(id, stage.id);
                setDragId(null);
              }}
            >
              <p className="text-[10px] font-semibold tracking-wide text-[#9CA3AF] uppercase">{stage.label}</p>
              <ul className="mt-2 space-y-2">
                {rfps
                  .filter((rfp) => stageOf(rfp) === stage.id)
                  .map((rfp) => (
                    <li
                      key={rfp.id}
                      draggable
                      onDragStart={(e) => {
                        e.dataTransfer.setData("text/plain", rfp.id);
                        setDragId(rfp.id);
                      }}
                      className="cursor-grab rounded-[4px] border border-[#1F2937] bg-[#111827] p-2"
                    >
                      <p className="truncate text-[11px] text-[#F3F4F6]">{rfp.title}</p>
                      <button
                        type="button"
                        className="mt-1 text-[10px] text-[#93C5FD] underline"
                        onClick={() => askPartner(rfp, stage.label)}
                      >
                        Ask partner
                      </button>
                    </li>
                  ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      <section className="animate-entrance stagger-3 overflow-x-auto rounded-[6px] border border-[#1F2937] bg-[#111827] shadow-subtle">
        <table className="w-full min-w-[720px] border-collapse text-left">
          <thead>
            <tr className="border-b border-[#1F2937] bg-[#0B0F19] text-[9px] font-semibold tracking-wider text-[#6B7280] uppercase">
              <th className="px-4 py-2">When</th>
              <th className="px-2 py-2">Type</th>
              <th className="px-2 py-2">RFP</th>
              <th className="px-2 py-2">Issuer</th>
              <th className="px-2 py-2">Alert</th>
              <th className="px-4 py-2 text-right">Calendar</th>
            </tr>
          </thead>
          <tbody className="text-[12px]">
            {visibleRows.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center">
                  <p className="text-[12px] text-[#9CA3AF]">No dated deadlines parsed on this desk.</p>
                  <p className="mt-1 text-[11px] text-[#6B7280]">Ingest an RFP with ISO or “Due …” dates.</p>
                  <Link
                    href="/#legal-documents"
                    className="btn-tactile mt-3 inline-flex rounded-[4px] border border-[#F59E0B] px-3 py-1.5 text-[11px] font-semibold text-[#F59E0B] hover:bg-[#F59E0B] hover:text-[#0B0F19]"
                  >
                    Go to ingest →
                  </Link>
                </td>
              </tr>
            ) : (
              visibleRows.map((row) => {
                const urgent = row.days != null && row.days >= 0 && row.days < 1;
                const overdue = row.days != null && row.days < 0;
                return (
                  <tr
                    key={`${row.rfp.id}-${row.label}-${row.date}`}
                    className="table-row-interactive border-b border-[#1F2937]"
                  >
                    <td className="px-4 py-2.5">
                      <p className="font-mono-numbers font-semibold text-[#F3F4F6]">{row.date}</p>
                      <span
                        className={cn(
                          "mt-1 inline-block rounded-[3px] px-1.5 py-0.5 font-mono-numbers text-[9px] font-medium",
                          overdue
                            ? "bg-[#1F2937] text-[#6B7280]"
                            : urgent
                              ? "animate-pulse bg-[#7F1D1D] text-[#FCA5A5]"
                              : "bg-[#422006] text-[#FCD34D]"
                        )}
                      >
                        {countdownLabel(row.days)}
                      </span>
                    </td>
                    <td className="px-2 py-2.5 text-[#F59E0B]">{row.label}</td>
                    <td className="max-w-[220px] truncate px-2 py-2.5 text-[#F3F4F6]">{row.rfp.title}</td>
                    <td className="px-2 py-2.5 text-[11px] text-[#9CA3AF]">{row.rfp.issuer}</td>
                    <td className="px-2 py-2.5 text-[10px] text-[#6B7280]">{alertCadence(row.days)}</td>
                    <td className="px-4 py-2.5 text-right">
                      <div className="flex justify-end gap-1.5">
                        <button
                          type="button"
                          className="btn-tactile rounded-[3px] border border-[#374151] px-2 py-[3px] text-[10px] text-[#9CA3AF] hover:text-[#F3F4F6]"
                          onClick={() => downloadIcs(row.rfp, now)}
                        >
                          .ics
                        </button>
                        <a
                          className="btn-tactile inline-flex items-center rounded-[3px] border border-[#F59E0B] px-2 py-[3px] text-[10px] font-semibold text-[#F59E0B] hover:bg-[#F59E0B] hover:text-[#0B0F19]"
                          href={googleCalendarUrl(row, row.rfp.title)}
                          target="_blank"
                          rel="noreferrer"
                        >
                          Google
                        </a>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </section>
    </main>
  );
}
