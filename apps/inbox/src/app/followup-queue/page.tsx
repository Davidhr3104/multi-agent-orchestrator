"use client";

import { useCallback, useEffect, useState } from "react";
import { QueueTable } from "@/components/queue-table";
import { ActiveInspector } from "@/components/active-inspector";
import type { InboxMessage } from "@/lib/types";
import { Avatar } from "@helix/ui";
import { Clock } from "lucide-react";
import { IllustratedEmpty, PageFrame } from "@/components/desk-kit";
import { ErrorText } from "@/components/operator-notice";

export default function FollowupQueuePage() {
  const [threads, setThreads] = useState<InboxMessage[]>([]);
  const [selected, setSelected] = useState<InboxMessage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
    <PageFrame
      title="Followups overdue"
      subtitle="No reply after the wait you set in Agent Studio (default 48 hours). Opening this page drafts the nudge. Nothing sends until you approve it."
    >
      {threads.length === 0 ? (
        <IllustratedEmpty
          title="No overdue followups"
          body="When a sent thread passes the wait set in Agent Studio without an answer, Helix leaves a follow-up draft here for you to approve."
          icon={<Clock className="size-7" aria-hidden />}
          colors={["#172554", "#6d28d9"]}
          exampleLabel="What a followup looks like"
          example={
            <div className="min-w-0 space-y-2">
              <div className="flex min-w-0 items-center gap-3">
                <Avatar name="Tom Okafor" size={32} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground">Contract redline for review</p>
                  <p className="truncate text-xs text-muted-foreground">Tom Okafor · reply sent 3 days ago · no answer</p>
                </div>
                <span className="shrink-0 rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold text-amber-500">72h</span>
              </div>
              <p className="rounded-md bg-surface-muted p-2 text-xs text-muted-foreground">Draft: &ldquo;Hi Tom, circling back on the redline. Happy to jump on a quick call if that is easier.&rdquo;</p>
            </div>
          }
        />
      ) : (
        <div className="grid min-w-0 grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="min-w-0 lg:col-span-2">
            <QueueTable
              threads={threads}
              selectedId={selected?.id ?? null}
              onSelect={setSelected}
            />
            {selected ? (
              <button
                type="button"
                className="mt-3 min-h-10 rounded-md bg-accent px-3 py-1.5 text-xs font-semibold text-white md:min-h-8"
                onClick={() => {
                  setError(null);
                  void fetch(`/api/messages/${selected.id}`, {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ action: "smart_reply" }),
                  }).then(async (res) => {
                    if (!res.ok) {
                      const data = (await res.json().catch(() => null)) as { error?: string } | null;
                      setError(data?.error || `Draft failed (${res.status})`);
                      return;
                    }
                    await fetchThreads();
                  });
                }}
              >
                Draft follow-up
              </button>
            ) : null}
            {error ? <p className="mt-2 text-xs text-red-500"><ErrorText message={error} /></p> : null}
          </div>
          <div className="min-w-0">{selected ? <ActiveInspector thread={selected} onUpdate={() => void fetchThreads()} /> : null}</div>
        </div>
      )}
    </PageFrame>
  );
}
