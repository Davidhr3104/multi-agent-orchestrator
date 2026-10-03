"use client";

import { useEffect, useMemo, useState } from "react";
import { Route as RouteIcon } from "lucide-react";
import { Avatar, ChartCard, DemoChip, Donut, HBarList } from "@helix/ui";
import type { InboxMessage } from "@/lib/types";
import { RoutingRules } from "@/components/routing-rules";
import { GhostButton, Grid, IllustratedEmpty, PageFrame, SOURCE_DESK, VIOLET, useDeskMode } from "@/components/desk-kit";
import { statusLabel } from "@/lib/desk-metrics";

const PAGE = 12;

export default function RoutedPage() {
  const [threads, setThreads] = useState<InboxMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [shown, setShown] = useState(PAGE);
  const demo = useDeskMode() === "demo";

  useEffect(() => {
    void fetch("/api/threads?status=routed")
      .then((r) => r.json())
      .then((d: { threads?: InboxMessage[] }) => setThreads(d.threads ?? []))
      .catch(() => undefined)
      .finally(() => setLoading(false));
  }, []);

  const view = useMemo(() => {
    const sent = threads.filter((t) => t.status === "sent").length;
    const byDest = new Map<string, number>();
    for (const t of threads) byDest.set(t.routeTo || "Unrouted", (byDest.get(t.routeTo || "Unrouted") ?? 0) + 1);
    return {
      sent,
      routed: threads.length - sent,
      dest: [...byDest.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6).map(([label, value]) => ({ label, value })),
    };
  }, [threads]);

  if (loading) return <div className="p-8 text-muted-foreground">Loading routed…</div>;

  return (
    <PageFrame title="Routed" chips={demo ? <DemoChip /> : null} subtitle="Emails Helix has finished with, either by sending a reply or by handing them to the right person.">
      <RoutingRules />

      {threads.length === 0 ? (
        <IllustratedEmpty
          title="Nothing routed yet"
          body="When you approve a reply or route a thread, it lands here with who received it and when. The charts fill in as it happens."
          icon={<RouteIcon className="size-7" aria-hidden />}
          colors={["#1e1b4b", "#6d28d9"]}
          exampleLabel="What a row looks like"
          example={
            <div className="flex min-w-0 items-center gap-3">
              <Avatar name="Dana Ruiz" size={32} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-foreground">Invoice #4471 — payment reminder</p>
                <p className="truncate text-xs text-muted-foreground">Dana Ruiz · routed to Finance · Ops</p>
              </div>
              <span className="text-xs text-violet-300">Routed</span>
            </div>
          }
        />
      ) : (
        <>
          <Grid cols={2}>
            <ChartCard title="Sent or routed" subtitle="How these threads were closed" demo={demo} source={SOURCE_DESK}>
              <Donut
                centerValue={threads.length}
                centerLabel="threads"
                ariaLabel="Threads by sent versus routed"
                slices={[
                  { label: "Reply sent", value: view.sent, color: "#34d399" },
                  { label: "Routed, no reply", value: view.routed, color: VIOLET },
                ].filter((s) => s.value > 0)}
              />
            </ChartCard>
            <ChartCard title="Who received them" subtitle="Top destinations" demo={demo} source={SOURCE_DESK}>
              <HBarList items={view.dest} colorAll={VIOLET} />
            </ChartCard>
          </Grid>
          <div className="glass-panel min-w-0 rounded-xl">
            <div className="divide-y divide-border">
              {threads.slice(0, shown).map((thread) => (
                <div key={thread.id} className="flex min-w-0 items-center justify-between gap-3 px-3 py-3.5 hover:bg-surface-muted sm:px-4">
                  <div className="flex min-w-0 items-center gap-3">
                    <Avatar name={thread.fromName} size={32} />
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium text-foreground">{thread.subject}</div>
                      <div className="truncate text-xs text-muted-foreground">
                        {thread.fromName} · {thread.routeTo} · {new Date(thread.updatedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                      </div>
                    </div>
                  </div>
                  <div className={`shrink-0 text-xs ${thread.status === "sent" ? "text-emerald-400" : "text-violet-300"}`}>
                    {thread.status === "sent" ? "✓ " : ""}
                    {statusLabel(thread.status)}
                  </div>
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
