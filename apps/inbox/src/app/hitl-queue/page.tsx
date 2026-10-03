"use client";

import { useCallback, useEffect, useState } from "react";
import { QueueTable } from "@/components/queue-table";
import { ActiveInspector } from "@/components/active-inspector";
import { EducationalEmpty } from "@/components/educational-empty";
import type { InboxMessage } from "@/lib/types";
import { rememberFocus } from "@/lib/desk-ui";
import { EMPTY_INBOX } from "@helix/help";
import { ChartCard, DemoChip, HBarList } from "@helix/ui";
import { ColumnChart, Grid, PageFrame, SOURCE_DESK, VIOLET, useDeskMode } from "@/components/desk-kit";
import { urgencyHistogram } from "@/lib/desk-metrics";

export default function HITLQueuePage() {
  const [threads, setThreads] = useState<InboxMessage[]>([]);
  const [selected, setSelected] = useState<InboxMessage | null>(null);
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const demo = useDeskMode() === "demo";

  const fetchThreads = useCallback(async () => {
    const res = await fetch("/api/threads?status=review");
    const data = (await res.json()) as { threads?: InboxMessage[] };
    const rows = data.threads ?? [];
    setThreads(rows);
    setSelected((cur) => {
      if (cur && rows.some((t) => t.id === cur.id)) {
        return rows.find((t) => t.id === cur.id) ?? null;
      }
      return rows[0] ?? null;
    });
    setLoading(false);
  }, []);

  useEffect(() => {
    void fetchThreads();
  }, [fetchThreads]);

  useEffect(() => {
    rememberFocus(selected?.id ?? null);
  }, [selected]);

  function toggle(id: string) {
    setChecked((cur) => {
      const next = new Set(cur);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function bulk(action: "approve" | "route" | "block") {
    const ids = [...checked];
    if (!ids.length) return;
    setBusy(action);
    setNotice(null);
    const res = await fetch("/api/messages/bulk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids, action }),
    });
    setBusy(null);
    if (!res.ok) {
      setNotice("Batch action failed.");
      return;
    }
    setChecked(new Set());
    setNotice(`${ids.length} updated.`);
    await fetchThreads();
  }

  if (loading) {
    return <div className="p-8 text-muted-foreground">Loading HITL queue…</div>;
  }

  const urgency = urgencyHistogram(threads.map((t) => t.urgencyScore));
  const lowest = [...threads].sort((a, b) => a.aiConfidence - b.aiConfidence).slice(0, 5);

  return (
    <PageFrame
      title="HITL queue"
      chips={demo ? <DemoChip /> : null}
      subtitle="Human-in-the-loop review for the decisions the AI was least sure about."
    >
      {notice ? <p className="text-xs text-muted-foreground">{notice}</p> : null}
      {threads.length > 0 ? (
        <Grid cols={2}>
          <ChartCard title="How urgent the queue is" subtitle={`${threads.length} thread${threads.length === 1 ? "" : "s"} waiting for a person`} demo={demo} source={SOURCE_DESK}>
            <ColumnChart
              height={140}
              ariaLabel="Histogram of urgency scores for threads waiting on review"
              items={urgency.map((b, i) => ({ label: b.label, parts: [{ name: "Threads", value: b.value, color: i >= 4 ? "#f87171" : i === 3 ? "#fbbf24" : VIOLET }] }))}
            />
          </ChartCard>
          <ChartCard title="Least certain first" subtitle="AI confidence of the threads most worth a second look" demo={demo} source={SOURCE_DESK}>
            <HBarList
              items={lowest.map((t) => ({ label: t.subject, value: Math.round(t.aiConfidence), color: t.aiConfidence >= 85 ? "#34d399" : t.aiConfidence >= 70 ? VIOLET : "#fbbf24" }))}
              format={(n) => `${n}%`}
            />
          </ChartCard>
        </Grid>
      ) : null}
      {checked.size > 0 ? (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted-foreground">{checked.size} selected</span>
          <button type="button" disabled={busy != null} className="btn-tactile min-h-10 rounded-md bg-accent px-3 text-[11px] font-semibold text-white disabled:opacity-50 md:min-h-8" onClick={() => void bulk("approve")}>
            {busy === "approve" ? "…" : "Approve drafts"}
          </button>
          <button type="button" disabled={busy != null} className="btn-tactile min-h-10 rounded-md border border-border px-3 text-[11px] disabled:opacity-50 md:min-h-8" onClick={() => void bulk("route")}>
            {busy === "route" ? "…" : "Mark routed"}
          </button>
          <button type="button" disabled={busy != null} className="btn-tactile min-h-10 rounded-md border border-red-500/30 px-3 text-[11px] text-red-600 disabled:opacity-50 md:min-h-8" onClick={() => void bulk("block")}>
            {busy === "block" ? "…" : "Block spam"}
          </button>
        </div>
      ) : null}

      {threads.length === 0 ? (
        <div className="glass-panel rounded-xl">
          <EducationalEmpty copy={EMPTY_INBOX.hitl} />
        </div>
      ) : (
        <div className="grid min-w-0 grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="min-w-0 lg:col-span-2">
            <QueueTable
              threads={threads}
              selectedId={selected?.id ?? null}
              onSelect={setSelected}
              checkedIds={checked}
              onToggle={toggle}
            />
          </div>
          <div className="min-w-0">{selected ? <ActiveInspector thread={selected} onUpdate={() => void fetchThreads()} /> : null}</div>
        </div>
      )}
    </PageFrame>
  );
}
