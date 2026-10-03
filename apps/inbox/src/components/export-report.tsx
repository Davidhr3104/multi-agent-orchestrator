"use client";

import { downloadCsv, printReport } from "@/lib/download";

export function ExportWeekly() {
  async function csv() {
    const res = await fetch("/api/weekly-report");
    const data = (await res.json()) as { report?: Record<string, unknown> };
    const report = data.report ?? {};
    downloadCsv(
      "helix-inbox-weekly.csv",
      Object.entries(report)
        .filter(([, value]) => value == null || typeof value !== "object")
        .map(([metric, value]) => ({ metric, value: String(value ?? "") }))
    );
  }

  async function pdf() {
    const res = await fetch("/api/weekly-report");
    const data = (await res.json()) as { report?: Record<string, unknown> };
    const lines = Object.entries(data.report ?? {})
      .filter(([, value]) => value == null || typeof value !== "object")
      .map(([metric, value]) => `${metric}: ${String(value ?? "")}`);
    printReport("Helix for Inbox weekly report", lines);
  }

  return (
    <div className="flex flex-wrap gap-2">
      <button type="button" className="min-h-10 rounded-md border border-border px-3 py-1.5 text-xs md:min-h-8" onClick={() => void csv()}>
        Export CSV
      </button>
      <button type="button" className="min-h-10 rounded-md border border-border px-3 py-1.5 text-xs md:min-h-8" onClick={() => void pdf()}>
        Print PDF
      </button>
    </div>
  );
}
