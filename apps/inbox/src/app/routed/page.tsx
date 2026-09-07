"use client";

import { useEffect, useState } from "react";
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

export default function RoutedPage() {
  const [threads, setThreads] = useState<InboxMessage[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void fetch("/api/threads?status=routed")
      .then((r) => r.json())
      .then((d: { threads?: InboxMessage[] }) => {
        setThreads(d.threads ?? []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className="p-8 text-muted-foreground">Loading routed…</div>;
  }

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-foreground">Routed</h1>
        <p className="text-sm text-muted-foreground">Emails that have been processed and sent</p>
      </div>

      <div className="glass-panel rounded-xl">
        <div className="divide-y divide-border">
          {threads.map((thread) => (
            <div key={thread.id} className="flex items-center justify-between px-4 py-3.5 hover:bg-surface-muted">
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-emerald-500/20 text-[10px] font-semibold text-emerald-400">
                  {initials(thread.fromName)}
                </div>
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium text-foreground">{thread.subject}</div>
                  <div className="truncate text-xs text-muted-foreground">
                    {thread.fromName} · {new Date(thread.updatedAt).toLocaleString()}
                  </div>
                </div>
              </div>
              <div className="shrink-0 text-xs text-emerald-400">✓ Sent</div>
            </div>
          ))}
        </div>

        {threads.length === 0 ? (
          <EducationalEmpty copy={EMPTY_INBOX.routed} />
        ) : null}
      </div>
    </div>
  );
}
