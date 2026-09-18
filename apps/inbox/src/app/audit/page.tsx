"use client";

import { useEffect, useState } from "react";
import type { AiActionLog } from "@/lib/types";

export default function InboxAuditPage() {
  const [logs, setLogs] = useState<AiActionLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void fetch("/api/audit")
      .then((r) => r.json())
      .then((d: { logs?: AiActionLog[] }) => {
        setLogs(d.logs ?? []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className="p-8 text-muted-foreground">Loading audit log…</div>;
  }

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-foreground">Audit log</h1>
        <p className="text-sm text-muted-foreground">AI decisions and human overrides for this workspace.</p>
      </div>

      <div className="glass-panel rounded-xl">
        {logs.length === 0 ? (
          <p className="px-6 py-12 text-center text-sm text-muted-foreground">No audited actions yet.</p>
        ) : (
          <ol className="divide-y divide-border">
            {logs.map((log) => (
              <li key={log.id} className="flex flex-wrap items-start justify-between gap-3 px-4 py-3.5">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded border border-accent/30 bg-accent/10 px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-accent uppercase">
                      {log.actionType}
                    </span>
                    {log.humanOverride ? (
                      <span className="rounded border border-amber-500/30 bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700 dark:text-amber-300">
                        HITL
                      </span>
                    ) : (
                      <span className="text-[10px] text-muted-foreground">AI</span>
                    )}
                    <span className="font-mono text-[11px] text-muted-foreground">
                      {new Date(log.createdAt).toISOString().replace("T", " ").slice(0, 19)}Z
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-foreground">{log.aiDecision}</p>
                  {log.threadId ? (
                    <p className="mt-0.5 font-mono text-[11px] text-muted-foreground">{log.threadId}</p>
                  ) : null}
                </div>
                <div className="shrink-0 font-mono text-xs text-muted-foreground">
                  {Math.round(log.confidenceScore)}%
                </div>
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  );
}
