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

export default function DeadlinesPage() {
  const [rfps, setRfps] = useState<StoredRfp[]>([]);
  const [now, setNow] = useState(() => Date.now());

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

  const critical = rows.filter((r) => r.days != null && r.days >= 0 && r.days < 1).length;
  const week = rows.filter((r) => r.days != null && r.days >= 0 && r.days <= 7).length;
  const past = rows.filter((r) => r.days != null && r.days < 0).length;

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
            ["UNDER 24H", critical, "text-[#FCA5A5]"],
            ["NEXT 7 DAYS", week, "text-[#FCD34D]"],
            ["PAST DUE", past, "text-[#9CA3AF]"],
          ] as const
        ).map(([label, value, color]) => (
          <div key={label} className="rounded-[6px] border border-[#1F2937] bg-[#111827] p-4 shadow-subtle">
            <p className="text-[10px] font-semibold tracking-wide text-[#9CA3AF] uppercase">{label}</p>
            <p className={cn("font-mono-numbers mt-2 text-[28px] leading-none font-bold", color)}>{value}</p>
          </div>
        ))}
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
            {rows.length === 0 ? (
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
              rows.map((row) => {
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
