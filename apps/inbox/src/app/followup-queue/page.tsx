"use client";

import { useCallback, useEffect, useState } from "react";
import { QueueTable } from "@/components/queue-table";
import { ActiveInspector } from "@/components/active-inspector";
import { EducationalEmpty } from "@/components/educational-empty";
import type { InboxMessage } from "@/lib/types";

const EMPTY_FOLLOWUP = {
  title: "No overdue followups",
  body: "When a sent thread passes the wait in Agent Studio, Helix leaves a follow-up draft here for approval.",
};

export default function FollowupQueuePage() {
  const [threads, setThreads] = useState<InboxMessage[]>([]);
  const [selected, setSelected] = useState<InboxMessage | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchThreads = useCallback(async () => {
    const res = await fetch("/api/threads?overdue=true");
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
    void fetch("/api/followups/prepare", { method: "POST" }).finally(() => {
      void fetchThreads();
    });
  }, [fetchThreads]);

  if (loading) {
    return <div className="p-8 text-muted-foreground">Loading followup queue…</div>;
  }

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-foreground">Followups overdue</h1>
        <p className="text-sm text-muted-foreground">
          No reply after the wait you set in Agent Studio (default 48 hours). Opening this page drafts the nudge. Nothing sends until you approve it.
        </p>
      </div>

      {threads.length === 0 ? (
        <div className="glass-panel rounded-xl">
          <EducationalEmpty copy={EMPTY_FOLLOWUP} />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <QueueTable
              threads={threads}
              selectedId={selected?.id ?? null}
              onSelect={setSelected}
            />
            {selected ? (
              <button
                type="button"
                className="mt-3 rounded-md bg-accent px-3 py-1.5 text-xs font-semibold text-white"
                onClick={() => {
                  void fetch(`/api/messages/${selected.id}`, {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ action: "smart_reply" }),
                  }).then(() => fetchThreads());
                }}
              >
                Draft follow-up
              </button>
            ) : null}
          </div>
          <div>{selected ? <ActiveInspector thread={selected} onUpdate={() => void fetchThreads()} /> : null}</div>
        </div>
      )}
    </div>
  );
}
