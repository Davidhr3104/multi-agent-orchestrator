"use client";

import { useCallback, useEffect, useState } from "react";
import type { InboxMessage } from "@/lib/types";
import { EducationalEmpty } from "@/components/educational-empty";
import { EMPTY_INBOX } from "@helix/help";

function initials(name: string) {
  return name
    .split(/\s+/)
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export default function BlockedPage() {
  const [threads, setThreads] = useState<InboxMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const fetchThreads = useCallback(async () => {
    const res = await fetch("/api/threads?status=blocked");
    const data = (await res.json()) as { threads?: InboxMessage[] };
    setThreads(data.threads ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    void fetchThreads();
  }, [fetchThreads]);

  async function handleUnblock(threadId: string) {
    setBusyId(threadId);
    try {
      await fetch(`/api/threads/${threadId}/unblock`, { method: "POST" });
      await fetchThreads();
    } finally {
      setBusyId(null);
    }
  }

  if (loading) {
    return <div className="p-8 text-muted-foreground">Loading blocked…</div>;
  }

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-foreground">Blocked</h1>
        <p className="text-sm text-muted-foreground">Spam and filtered emails</p>
      </div>

      <div className="glass-panel rounded-xl">
        <div className="divide-y divide-border">
          {threads.map((thread) => (
            <div
              key={thread.id}
              className="flex items-center justify-between px-4 py-3.5 opacity-70 hover:bg-surface-muted hover:opacity-100"
            >
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-surface-muted text-[10px] font-semibold text-muted-foreground">
                  {initials(thread.fromName)}
                </div>
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium text-foreground/80">{thread.subject}</div>
                  <div className="truncate text-xs text-muted-foreground">
                    {thread.fromName} · {new Date(thread.receivedAt).toLocaleString()}
                  </div>
                </div>
              </div>
              <button
                type="button"
                disabled={busyId === thread.id}
                onClick={() => void handleUnblock(thread.id)}
                className="btn-tactile shrink-0 rounded-md border border-border bg-surface-muted px-3 py-1 text-xs text-foreground/80 transition-colors hover:bg-surface-muted disabled:opacity-50"
              >
                {busyId === thread.id ? "…" : "Unblock"}
              </button>
            </div>
          ))}
        </div>

        {threads.length === 0 ? (
          <EducationalEmpty copy={EMPTY_INBOX.blocked} />
        ) : null}
      </div>
    </div>
  );
}
