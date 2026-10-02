"use client";

import { useEffect, useState } from "react";
import type { AiActionLog } from "@/lib/types";
import { downloadCsv, printReport } from "@/lib/download";

export default function AuditPage() {
  const [logs, setLogs] = useState<AiActionLog[]>([]);
  const [onlyHuman, setOnlyHuman] = useState(false);

  useEffect(() => {
    void fetch("/api/audit")
      .then((r) => r.json())
      .then((d: { logs?: AiActionLog[] }) => setLogs(d.logs ?? []))
      .catch(() => setLogs([]));
  }, []);

  const rows = onlyHuman ? logs.filter((log) => log.humanOverride) : logs;

  return (
    <div className="p-8">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Audit & learning log</h1>
          <p className="mt-1 text-sm text-muted-foreground">Automatic actions sit next to the ones a person approved or corrected.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="rounded-md border border-border px-3 py-1.5 text-xs"
            onClick={() => setOnlyHuman((v) => !v)}
          >
            {onlyHuman ? "Show all" : "Human corrections only"}
          </button>
          <button
            type="button"
            className="rounded-md border border-border px-3 py-1.5 text-xs"
            onClick={() =>
              downloadCsv(
                "helix-audit.csv",
                rows.map((log) => ({
                  when: log.createdAt,
                  action: log.actionType,
                  decision: log.aiDecision,
                  source: log.humanOverride ? "Human" : "Automatic",
                }))
              )
            }
          >
            Export CSV
          </button>
          <button
            type="button"
            className="rounded-md border border-border px-3 py-1.5 text-xs"
            onClick={() =>
              printReport(
                "Audit trail",
                rows.map(
                  (log) =>
                    `${new Date(log.createdAt).toLocaleString()} · ${log.actionType} · ${log.humanOverride ? "Human" : "Automatic"} · ${log.aiDecision}`
                )
              )
            }
          >
            Print PDF
          </button>
        </div>
      </div>
      <div className="glass-panel overflow-hidden rounded-xl">
        <table className="w-full text-left text-xs">
          <thead className="border-b border-border text-muted-foreground">
            <tr>
              <th className="px-3 py-2 font-medium">When</th>
              <th className="px-3 py-2 font-medium">Action</th>
              <th className="px-3 py-2 font-medium">Decision</th>
              <th className="px-3 py-2 font-medium">Source</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((log) => (
              <tr key={log.id} className="border-b border-border/70">
                <td className="px-3 py-2 text-muted-foreground">{new Date(log.createdAt).toLocaleString()}</td>
                <td className="px-3 py-2">{log.actionType}</td>
                <td className="px-3 py-2">{log.aiDecision}</td>
                <td className={log.humanOverride ? "px-3 py-2 text-amber-600" : "px-3 py-2 text-emerald-600"}>
                  {log.humanOverride ? "Human" : "Automatic"}
                </td>
              </tr>
            ))}
            {rows.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-3 py-6 text-muted-foreground">
                  No log rows yet.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
