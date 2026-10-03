"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ShieldOff } from "lucide-react";
import { Avatar, ChartCard, DemoChip, HBarList } from "@helix/ui";
import type { InboxMessage } from "@/lib/types";
import { ColumnChart, GhostButton, Grid, IllustratedEmpty, PageFrame, SOURCE_DESK, useDeskMode, useNow, useTzOffset } from "@/components/desk-kit";
import { dailyVolume } from "@/lib/desk-metrics";
import { inWindow } from "@/lib/sla";
import { ErrorText } from "@/components/operator-notice";

const PAGE = 12;

export default function BlockedPage() {
  const [threads, setThreads] = useState<InboxMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [shown, setShown] = useState(PAGE);
  const [error, setError] = useState<string | null>(null);
  const demo = useDeskMode() === "demo";
  const tz = useTzOffset();
  const mountedAt = useNow();

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
    setError(null);
    try {
      const res = await fetch(`/api/threads/${threadId}/unblock`, { method: "POST" });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        setError(data?.error || `Unblock failed (${res.status})`);
        return;
      }
      await fetchThreads();
    } finally {
      setBusyId(null);
    }
  }

  const view = useMemo(() => {
    const now = mountedAt ?? 0;
    const daily = dailyVolume(threads, 14, now, tz);
    const bySender = new Map<string, number>();
    for (const t of threads.filter((x) => inWindow(x, 14, now))) bySender.set(t.fromEmail, (bySender.get(t.fromEmail) ?? 0) + 1);
    return {
      daily,
      senders: [...bySender.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([label, value]) => ({ label, value })),
    };
  }, [threads, tz, mountedAt]);

  if (loading) return <div className="p-8 text-muted-foreground">Loading blocked…</div>;

  return (
    <PageFrame title="Blocked" chips={demo ? <DemoChip /> : null} subtitle="Spam and filtered emails. They never reach a person, and you can bring any of them back.">
      {error ? <p className="text-xs text-red-500"><ErrorText message={error} /></p> : null}
      {threads.length === 0 ? (
        <IllustratedEmpty
          title="No spam caught yet"
          body="Phishing, promos and junk are filtered before they reach you. They are listed here, so a real email caught by mistake is one click from coming back."
          icon={<ShieldOff className="size-7" aria-hidden />}
          colors={["#3b0764", "#be123c"]}
          exampleLabel="What a blocked row looks like"
          example={
            <div className="flex min-w-0 items-center gap-3">
              <Avatar name="Crypto Blast" size={32} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-foreground/80">FREE NFT DROP CLICK NOW</p>
                <p className="truncate text-xs text-muted-foreground">Crypto Blast · blocked as spam</p>
              </div>
              <span className="text-xs text-muted-foreground">Unblock</span>
            </div>
          }
        />
      ) : (
        <>
          <Grid cols={2}>
            <ChartCard title="Spam blocked per day" subtitle="Last 14 days" demo={demo} source={SOURCE_DESK}>
              <ColumnChart height={150} ariaLabel="Spam blocked per day over the last 14 days" items={view.daily.map((d) => ({ label: d.label, parts: [{ name: "Blocked", value: d.total, color: "#f87171" }] }))} />
            </ChartCard>
            <ChartCard title="Loudest senders" subtitle="Most blocked addresses" demo={demo} source={SOURCE_DESK}>
              <HBarList items={view.senders} colorAll="#f87171" />
            </ChartCard>
          </Grid>
          <div className="glass-panel min-w-0 rounded-xl">
            <div className="divide-y divide-border">
              {threads.slice(0, shown).map((thread) => (
                <div key={thread.id} className="flex min-w-0 items-center justify-between gap-3 px-3 py-3.5 opacity-80 hover:bg-surface-muted hover:opacity-100 sm:px-4">
                  <div className="flex min-w-0 items-center gap-3">
                    <Avatar name={thread.fromName} size={32} />
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium text-foreground/80">{thread.subject}</div>
                      <div className="truncate text-xs text-muted-foreground">
                        {thread.fromName} · {new Date(thread.receivedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    disabled={busyId === thread.id}
                    onClick={() => void handleUnblock(thread.id)}
                    aria-label={`Unblock ${thread.subject}`}
                    className="btn-tactile min-h-10 shrink-0 rounded-md border border-border bg-surface-muted px-3 py-1 text-xs text-foreground/80 transition-colors hover:bg-surface-muted disabled:opacity-50 md:min-h-8"
                  >
                    {busyId === thread.id ? "…" : "Unblock"}
                  </button>
                </div>
              ))}
            </div>
            {threads.length > shown ? (
              <div className="border-t border-border p-3 text-center">
                <GhostButton onClick={() => setShown((n) => n + PAGE)}>Show {Math.min(PAGE, threads.length - shown)} more</GhostButton>
              </div>
            ) : null}
          </div>
        </>
      )}
    </PageFrame>
  );
}
