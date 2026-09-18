"use client";

import { useCallback, useState } from "react";
import { QueueTable } from "@/components/queue-table";
import { ActiveInspector } from "@/components/active-inspector";
import { EducationalEmpty } from "@/components/educational-empty";
import type { InboxMessage } from "@/lib/types";
import { EMPTY_INBOX } from "@helix/help";

export function HitlQueueView({ initialThreads }: { initialThreads: InboxMessage[] }) {
  const [threads, setThreads] = useState(initialThreads);
  const [selected, setSelected] = useState<InboxMessage | null>(initialThreads[0] ?? null);

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
  }, []);

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
            <QueueTable threads={threads} selectedId={selected?.id ?? null} onSelect={setSelected} />
          </div>
          <div>{selected ? <ActiveInspector thread={selected} onUpdate={() => void fetchThreads()} /> : null}</div>
        </div>
      )}
    </div>
  );
}
