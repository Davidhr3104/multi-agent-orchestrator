"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ChartCard } from "@helix/ui";
import type { StoredRfp } from "@helix/core";
import { Ink, INK } from "@/components/desk-charts";
import { deadlineSummary, deskStage, isDemoDesk, rfpDeadline, STAGE_LABEL, timelineScale, type DeadlineKind } from "@/lib/desk-metrics";
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

type Row = DeadlineHit & { rfp: StoredRfp; kind: DeadlineKind };
type Bucket = "all" | "today" | "week" | "within14" | "past";
type StageId = "analysis" | "coi" | "approved" | "submitted" | "closed";

const STAGES: { id: StageId; label: string }[] = [
  { id: "analysis", label: "In analysis" },
  { id: "coi", label: "COI review" },
  { id: "approved", label: "Approved" },
  { id: "submitted", label: "Submitted" },
  { id: "closed", label: "Closed" },
];

const STAGE_KEY = "helix-legal-pursuit-stage-v2";

function loadStages(): Record<string, StageId> {
  try {
    const raw = window.localStorage.getItem(STAGE_KEY);
    return raw ? (JSON.parse(raw) as Record<string, StageId>) : {};
  } catch {
    return {};
  }
}

/** Where a pursuit sits, from the recorded decision and outcome (same story as Outcomes). */
function inferStage(rfp: StoredRfp): StageId {
  const s = deskStage(rfp);
  if (s === "won" || s === "lost") return "submitted";
  if (s === "no_bid" || s === "withdrawn") return "closed";
  if (s === "pending") return "approved";
  if (rfp.needsReview) return "coi";
  return "analysis";
}

function dayLabel(days: number): string {
  if (days === 0) return "today";
  const d = Math.abs(days);
  return days < 0 ? `${d}d ago` : `in ${d}d`;
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
      .then((d: { rfps?: StoredRfp[] }) => setRfps(d.rfps ?? []))
      .catch(() => setRfps([]));
  }, []);

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(id);
  }, []);

  const demo = isDemoDesk(rfps);
  const summary = useMemo(() => deadlineSummary(rfps, now), [rfps, now]);

  const rows = useMemo<Row[]>(() => {
    return rfps
      .flatMap((rfp) => {
        const kind = rfpDeadline(rfp, now).kind;
        return extractDeadlines(rfp, now).map((hit) => ({ ...hit, rfp, kind }));
      })
      .sort((a, b) => (a.days ?? 999) - (b.days ?? 999));
  }, [rfps, now]);

  const visibleRows = rows.filter((r) => {
    if (bucket === "all") return true;
    if (bucket === "past") return r.kind === "past_due";
    if (r.kind === "closed" || r.days == null || r.days < 0) return false;
    if (bucket === "today") return r.days === 0;
    if (bucket === "week") return r.days >= 1 && r.days <= 7;
    return r.days <= 14;
  });

  const timelineRows = useMemo(() => {
    const byRfp = new Map<string, Row[]>();
    for (const r of rows) byRfp.set(r.rfp.id, [...(byRfp.get(r.rfp.id) ?? []), r]);
    return [...byRfp.values()];
  }, [rows]);
  const scale = useMemo(() => timelineScale(rows.flatMap((r) => (r.days == null ? [] : [r.days]))), [rows]);

  function stageOf(rfp: StoredRfp): StageId {
    return stages[rfp.id] ?? inferStage(rfp);
  }

  function moveStage(id: string, stage: StageId) {
    setStages((prev) => {
      const next = { ...prev, [id]: stage };
      try {
        window.localStorage.setItem(STAGE_KEY, JSON.stringify(next));
      } catch {
        /* storage unavailable: the move still shows for this visit */
      }
      return next;
    });
  }

  function askPartner(rfp: StoredRfp, stage: string) {
    const url = `${window.location.origin}/deadlines`;
    const body = `Please approve or reject "${rfp.title}" at the ${stage} step.\n\n${url}\n\nSlack is not connected on this desk. This opens your mail app; Helix does not send the message.`;
    window.location.href = `mailto:?subject=${encodeURIComponent(`Helix deadline — ${rfp.title}`)}&body=${encodeURIComponent(body)}`;
  }

  const kpis: { label: string; value: number; color: string; id: Bucket; hint: string }[] = [
    { label: "Due today", value: summary.dueToday, color: "text-[#FCA5A5]", id: "today", hint: "open RFPs" },
    { label: "Next 7 days", value: summary.thisWeek, color: "text-[#FCD34D]", id: "week", hint: "open RFPs" },
    { label: "Due in 14 days", value: summary.within14, color: "text-[#e2e8f0]", id: "within14", hint: "open RFPs, incl. today" },
    { label: "Past due", value: summary.pastDue, color: "text-[#9CA3AF]", id: "past", hint: "open RFPs, all dates passed" },
  ];

  return (
    <main className="mx-auto w-full max-w-[1720px] flex-1 space-y-4 p-4 sm:p-5">
      <div className="animate-entrance stagger-1 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[18px] font-semibold text-[#F3F4F6]">Deadlines</h1>
          <p className="mt-1 text-[12px] text-[#6B7280]">
            Parsed submission, Q&A, and site-visit dates. Closed RFPs (won, lost, no bid) never count as due. Alerts at 7 / 3 / 1 day.
          </p>
        </div>
        <button
          type="button"
          className="btn-tactile min-h-10 rounded-[4px] border border-[#374151] bg-[#1b2a45] px-3 py-1.5 text-[11px] font-medium text-[#9CA3AF] hover:border-[#4B5563] hover:text-[#F3F4F6] disabled:opacity-40"
          onClick={() => downloadDeskCalendar(rfps, now)}
          disabled={rows.length === 0}
        >
          Download all .ics
        </button>
      </div>

      <section className="animate-entrance stagger-2 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map(({ label, value, color, id, hint }) => (
          <button
            key={id}
            type="button"
            aria-pressed={bucket === id}
            className={cn(
              "min-h-[88px] rounded-[6px] border border-[#1b2a45] bg-[#0f1b30] p-4 text-left shadow-subtle",
              bucket === id && "ring-1 ring-[#E5E7EB]"
            )}
            onClick={() => setBucket((current) => (current === id ? "all" : id))}
          >
            <p className="text-[10px] font-semibold tracking-wide text-[#9CA3AF] uppercase">{label}</p>
            <p className={cn("font-mono-numbers mt-2 text-[28px] leading-none font-bold", color)}>{value}</p>
            <p className="mt-1.5 text-[10px] text-[#6B7280]">{hint}</p>
          </button>
        ))}
      </section>

      <Ink className="animate-entrance stagger-3">
        <ChartCard
          title="Deadline timeline"
          subtitle="Every parsed date per RFP, with today marked"
          demo={demo}
          source={`Source: dates parsed from each RFP. ${summary.closed} closed RFP${summary.closed === 1 ? "" : "s"} shown muted; ${summary.undated} without a parsed date.`}
        >
          {timelineRows.length === 0 ? (
            <p className="py-6 text-center text-xs text-slate-400">No dated deadlines to plot.</p>
          ) : (
            <div className="overflow-x-auto">
              <div className="min-w-[480px] sm:min-w-[640px]">
                {timelineRows.map((group) => {
                  const rfp = group[0].rfp;
                  const closed = group[0].kind === "closed";
                  return (
                    <div key={rfp.id} className="grid grid-cols-[110px_1fr] sm:grid-cols-[170px_1fr] items-center gap-3 border-b border-white/5 py-2 last:border-0">
                      <div className="min-w-0">
                        <p className="truncate text-[11px] text-slate-100" title={rfp.title}>
                          {rfp.title}
                        </p>
                        <p className="text-[10px] text-slate-500">{STAGE_LABEL[deskStage(rfp)]}</p>
                      </div>
                      <div className="relative h-8">
                        <div className="absolute inset-x-0 top-1/2 h-px bg-white/10" />
                        <div
                          className="absolute top-0 bottom-0 w-px bg-[#f59e0b]"
                          style={{ left: `${scale.pos(0)}%` }}
                          aria-hidden
                        />
                        {group.map((hit) => {
                          const past = hit.days != null && hit.days < 0;
                          const color = closed ? INK.cold : past ? INK.noGo : (hit.days ?? 99) <= 7 ? INK.hot : INK.silver;
                          return (
                            <span
                              key={`${hit.label}-${hit.date}`}
                              title={`${hit.label} · ${hit.date}${hit.days != null ? ` (${dayLabel(hit.days)})` : ""}${closed ? " · closed" : ""}`}
                              className="absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-[#0f1b30]"
                              style={{ left: `${scale.pos(hit.days ?? 0)}%`, background: color }}
                            />
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
                <div className="grid grid-cols-[110px_1fr] sm:grid-cols-[170px_1fr] gap-3 pt-2 text-[10px] text-slate-400">
                  <span />
                  <div className="relative h-4">
                    <span className="absolute -translate-x-1/2 font-semibold text-[#f59e0b]" style={{ left: `${scale.pos(0)}%` }}>
                      Today
                    </span>
                  </div>
                </div>
                <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[10px] text-slate-400">
                  {[
                    ["Within 7 days", INK.hot],
                    ["Later", INK.silver],
                    ["Past, open", INK.noGo],
                    ["Closed RFP", INK.cold],
                  ].map(([l, c]) => (
                    <li key={l} className="flex items-center gap-1.5">
                      <span className="size-2 rounded-full" style={{ background: c }} aria-hidden />
                      {l}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </ChartCard>
      </Ink>

      <section className="animate-entrance stagger-3 rounded-[6px] border border-[#1b2a45] bg-[#0f1b30] p-4 shadow-subtle">
        <h2 className="text-[13px] font-semibold text-[#F3F4F6]">Pursuit stages</h2>
        <p className="mt-1 text-[11px] text-[#6B7280]">
          Stages follow the recorded decision and outcome. Drag a pursuit to move it. Ask partner opens your mail app; Slack is not connected.
        </p>
        <div className="mt-3 grid gap-2 md:grid-cols-5">
          {STAGES.map((stage) => (
            <div
              key={stage.id}
              className="min-h-28 rounded-[4px] border border-dashed border-[#374151] bg-[#0a1322] p-2"
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                const id = e.dataTransfer.getData("text/plain") || dragId;
                if (id) moveStage(id, stage.id);
                setDragId(null);
              }}
            >
              <p className="text-[10px] font-semibold tracking-wide text-[#9CA3AF] uppercase">
                {stage.label}{" "}
                <span className="font-mono-numbers text-[#64748b]">{rfps.filter((r) => stageOf(r) === stage.id).length}</span>
              </p>
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
                      className="cursor-grab rounded-[4px] border border-[#1b2a45] bg-[#0f1b30] p-2"
                    >
                      <p className="truncate text-[11px] text-[#F3F4F6]" title={rfp.title}>
                        {rfp.title}
                      </p>
                      <p className="mt-0.5 text-[10px] text-[#64748b]">{STAGE_LABEL[deskStage(rfp)]}</p>
                      <button
                        type="button"
                        className="mt-1 min-h-10 text-[10px] text-[#93C5FD] underline sm:min-h-8"
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

      <section className="animate-entrance stagger-3 overflow-x-auto rounded-[6px] border border-[#1b2a45] bg-[#0f1b30] shadow-subtle">
        <table className="w-full min-w-[720px] border-collapse text-left">
          <thead>
            <tr className="border-b border-[#1b2a45] bg-[#0a1322] text-[9px] font-semibold tracking-wider text-[#6B7280] uppercase">
              <th className="px-4 py-2">When</th>
              <th className="px-2 py-2">Type</th>
              <th className="px-2 py-2">RFP</th>
              <th className="px-2 py-2">Issuer</th>
              <th className="px-2 py-2">Alert</th>
              <th className="sticky right-0 bg-[#0a1322] px-4 py-2 text-right">Calendar</th>
            </tr>
          </thead>
          <tbody className="text-[12px]">
            {visibleRows.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center">
                  <p className="text-[12px] text-[#9CA3AF]">{bucket === "all" ? "No dated deadlines parsed on this desk." : "Nothing in this view."}</p>
                  <p className="mt-1 text-[11px] text-[#6B7280]">
                    {bucket === "all" ? "Ingest an RFP with ISO or “Due …” dates." : "Select the card again to clear the filter."}
                  </p>
                  {bucket === "all" ? (
                    <Link
                      href="/#legal-documents"
                      className="btn-tactile mt-3 inline-flex min-h-10 items-center rounded-[4px] border border-[#F59E0B] px-3 py-1.5 text-[11px] font-semibold text-[#F59E0B] hover:bg-[#F59E0B] hover:text-[#0a1322]"
                    >
                      Go to ingest →
                    </Link>
                  ) : null}
                </td>
              </tr>
            ) : (
              visibleRows.map((row) => {
                const closed = row.kind === "closed";
                const urgent = !closed && row.days != null && row.days === 0;
                const overdue = !closed && row.days != null && row.days < 0;
                return (
                  <tr key={`${row.rfp.id}-${row.label}-${row.date}`} className={cn("table-row-interactive border-b border-[#1b2a45]", closed && "opacity-70")}>
                    <td className="px-4 py-2.5">
                      <p className="font-mono-numbers font-semibold text-[#F3F4F6]">{row.date}</p>
                      <span
                        className={cn(
                          "font-mono-numbers mt-1 inline-block rounded-[3px] px-1.5 py-0.5 text-[9px] font-medium",
                          closed
                            ? "bg-[#1b2a45] text-[#94a3b8]"
                            : overdue
                              ? "bg-[#7F1D1D]/50 text-[#FCA5A5]"
                              : urgent
                                ? "animate-pulse bg-[#7F1D1D] text-[#FCA5A5]"
                                : "bg-[#422006] text-[#FCD34D]"
                        )}
                      >
                        {closed ? `Closed · ${STAGE_LABEL[deskStage(row.rfp)]}` : countdownLabel(row.days)}
                      </span>
                    </td>
                    <td className="px-2 py-2.5 text-[#F59E0B]">{row.label}</td>
                    <td className="max-w-[220px] truncate px-2 py-2.5 text-[#F3F4F6]" title={row.rfp.title}>
                      {row.rfp.title}
                    </td>
                    <td className="px-2 py-2.5 text-[11px] text-[#9CA3AF]">{row.rfp.issuer}</td>
                    <td className="px-2 py-2.5 text-[10px] text-[#6B7280]">{closed ? "—" : alertCadence(row.days)}</td>
                    <td className="sticky right-0 bg-[#0f1b30] px-4 py-2.5 text-right">
                      <div className="flex justify-end gap-1.5">
                        <button
                          type="button"
                          className="btn-tactile min-h-9 rounded-[3px] border border-[#374151] px-2.5 py-[3px] text-[10px] text-[#9CA3AF] hover:text-[#F3F4F6]"
                          onClick={() => downloadIcs(row.rfp, now)}
                        >
                          .ics
                        </button>
                        <a
                          className="btn-tactile inline-flex min-h-9 items-center rounded-[3px] border border-[#F59E0B] px-2.5 py-[3px] text-[10px] font-semibold text-[#F59E0B] hover:bg-[#F59E0B] hover:text-[#0a1322]"
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
