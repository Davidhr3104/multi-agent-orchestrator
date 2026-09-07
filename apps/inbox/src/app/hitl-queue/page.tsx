"use client";

import { useCallback, useEffect, useState } from "react";
import { QueueTable } from "@/components/queue-table";
import { ActiveInspector } from "@/components/active-inspector";
import { EducationalEmpty } from "@/components/educational-empty";
import type { InboxMessage } from "@/lib/types";
import { EMPTY_INBOX } from "@helix/help";

export default function HITLQueuePage() {
  const [threads, setThreads] = useState<InboxMessage[]>([]);
  const [selected, setSelected] = useState<InboxMessage | null>(null);
  const [loading, setLoading] = useState(true);

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

  if (loading) {
    return <div className="p-8 text-muted-foreground">Loading HITL queue…</div>;
  }

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-foreground">HITL Queue</h1>
        <p className="text-sm text-muted-foreground">Human-in-the-Loop review for low-confidence AI decisions</p>
      </div>

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
            />
          </div>
          <div>{selected ? <ActiveInspector thread={selected} onUpdate={() => void fetchThreads()} /> : null}</div>
        </div>
      )}
    </div>
  );
}
