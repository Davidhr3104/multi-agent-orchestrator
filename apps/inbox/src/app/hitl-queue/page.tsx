"use client";

import { useCallback, useEffect, useState } from "react";
import { QueueTable } from "@/components/queue-table";
import { ActiveInspector } from "@/components/active-inspector";
import { EducationalEmpty } from "@/components/educational-empty";
import type { InboxMessage } from "@/lib/types";
import { rememberFocus } from "@/lib/desk-ui";
import { EMPTY_INBOX } from "@helix/help";

export default function HITLQueuePage() {
  const [threads, setThreads] = useState<InboxMessage[]>([]);
  const [selected, setSelected] = useState<InboxMessage | null>(null);
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

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

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-foreground">HITL Queue</h1>
        <p className="text-sm text-muted-foreground">Human-in-the-Loop review for low-confidence AI decisions</p>
      </div>
      {notice ? <p className="mb-4 text-xs text-muted-foreground">{notice}</p> : null}
      {checked.size > 0 ? (
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted-foreground">{checked.size} selected</span>
          <button type="button" disabled={busy != null} className="btn-tactile h-8 rounded-md bg-accent px-3 text-[11px] font-semibold text-white disabled:opacity-50" onClick={() => void bulk("approve")}>
            {busy === "approve" ? "…" : "Approve drafts"}
          </button>
          <button type="button" disabled={busy != null} className="btn-tactile h-8 rounded-md border border-border px-3 text-[11px] disabled:opacity-50" onClick={() => void bulk("route")}>
            {busy === "route" ? "…" : "Mark routed"}
          </button>
          <button type="button" disabled={busy != null} className="btn-tactile h-8 rounded-md border border-red-500/30 px-3 text-[11px] text-red-600 disabled:opacity-50" onClick={() => void bulk("block")}>
            {busy === "block" ? "…" : "Block spam"}
          </button>
        </div>
      ) : null}

      {threads.length === 0 ? (
        <div className="glass-panel rounded-xl">
          <EducationalEmpty copy={EMPTY_INBOX.hitl} />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <QueueTable
              threads={threads}
              selectedId={selected?.id ?? null}
              onSelect={setSelected}
              checkedIds={checked}
              onToggle={toggle}
            />
          </div>
          <div>{selected ? <ActiveInspector thread={selected} onUpdate={() => void fetchThreads()} /> : null}</div>
        </div>
      )}
    </div>
  );
}
