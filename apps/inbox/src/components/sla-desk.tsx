"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { EmailThread } from "@/lib/types";
import { categoryLabel, toInboxMessage } from "@/lib/types";
import {
  categoryTargetLabel,
  slaBucketFor,
  threadAgeMin,
  type InboxSlaSummary,
} from "@/lib/sla";
import { cn } from "@/lib/utils";
import { ChartCard, DemoChip, HBarList } from "@helix/ui";
import { BucketGauge, GhostButton, PageFrame, SOURCE_DESK, VIOLET, useDeskMode, useNow } from "@/components/desk-kit";
import { statusLabel } from "@/lib/desk-metrics";

function formatAge(min: number): string {
  if (min < 60) return `${Math.round(min)}m`;
  if (min < 1440) return `${(min / 60).toFixed(1)}h`;
  return `${(min / 1440).toFixed(1)}d`;
}

export function SlaDesk({
  initialThreads,
  initialSla,
  vipSenders,
}: {
  initialThreads: EmailThread[];
  initialSla: InboxSlaSummary;
  vipSenders: string[];
}) {
  const [threads, setThreads] = useState(initialThreads);
  const [sla, setSla] = useState(initialSla);
  const [filter, setFilter] = useState<"breach" | "open" | "all">("breach");
  const demo = useDeskMode() === "demo";
  const mountedAt = useNow();

  async function refresh() {
    const res = await fetch("/api/sla", { cache: "no-store" });
    const data = (await res.json()) as {
      sla?: InboxSlaSummary;
      threads?: EmailThread[];
    };
    // API returns open threads only; merge into full list for ranking
    if (data.sla) setSla(data.sla);
    if (data.threads) {
      const byId = new Map(threads.map((t) => [t.id, t]));
      for (const t of data.threads) byId.set(t.id, t);
      setThreads([...byId.values()]);
    }
  }

  useEffect(() => {
    const now = Date.now();
    let warned = new Set<string>();
    try {
      warned = new Set(JSON.parse(sessionStorage.getItem("helix-sla-warned") ?? "[]") as string[]);
    } catch {
      warned = new Set();
    }
    for (const thread of threads) {
      const bucket = slaBucketFor(thread, vipSenders);
      const financial = /invoice|payment|quote|pricing|contract|legal/i.test(`${thread.subject} ${thread.body}`);
      if (!bucket || (bucket !== "urgent" && bucket !== "vip" && !financial)) continue;
      if (thread.status !== "open" && thread.status !== "review") continue;
      const target = bucket === "vip" ? 30 : 60;
      const remaining = target - threadAgeMin(thread, now);
      if (remaining <= 0 || remaining > 15 || warned.has(thread.id)) continue;
      warned.add(thread.id);
      if (typeof Notification !== "undefined" && Notification.permission === "granted") {
        new Notification("SLA warning", { body: `${thread.subject} is ${Math.round(remaining)} min from breach.` });
      }
      void fetch("/api/sla/alert", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject: thread.subject, remainingMin: remaining }),
      });
    }
    sessionStorage.setItem("helix-sla-warned", JSON.stringify([...warned]));
  }, [threads, vipSenders]);

  const ranked = useMemo(() => {
    const now = Date.now();
    const list = threads.filter((t) => {
      const bucket = slaBucketFor(t, vipSenders);
      if (!bucket) return false;
      const open = t.status === "open" || t.status === "review";
      if (!open && filter !== "all") return false;
      if (filter === "all") return open || t.status === "routed" || t.status === "sent";
      const age = threadAgeMin(t, now);
      const target =
        bucket === "vip"
          ? 30
          : bucket === "urgent" || bucket === "action"
            ? 60
            : bucket === "meeting"
              ? 240
              : 1440;
      if (filter === "breach") return open && age > target;
      return open;
    });
    return [...list].sort((a, b) => threadAgeMin(b) - threadAgeMin(a));
  }, [threads, filter, vipSenders]);

  const ageBars = useMemo(() => {
    if (mountedAt == null) return [];
    const at = mountedAt;
    return threads
      .filter((t) => t.status === "open" || t.status === "review")
      .map((t) => {
        const bucket = slaBucketFor(t, vipSenders);
        const target = sla.buckets.find((b) => b.id === bucket)?.targetMin ?? 0;
        return { t, target, age: threadAgeMin(t, at) };
      })
      .filter((x) => x.target > 0)
      .map((x) => ({ ...x, pct: (x.age / x.target) * 100 }))
      .sort((a, b) => b.pct - a.pct)
      .slice(0, 8)
      .map((x) => ({
        label: x.t.subject,
        value: x.pct,
        hint: `${formatAge(x.age)} of ${formatAge(x.target)}`,
        color: x.pct > 100 ? "#f87171" : x.pct > 75 ? "#fbbf24" : VIOLET,
      }));
  }, [threads, vipSenders, sla.buckets, mountedAt]);

  return (
    <PageFrame
      title="SLA"
      chips={demo ? <DemoChip /> : null}
      subtitle="Time to first human reply, by urgency and VIP. Hours saved is an estimate from auto-triage and spam blocked over the last 14 days."
      actions={
        <>
          <GhostButton
            onClick={() => {
              if (typeof Notification !== "undefined") void Notification.requestPermission();
            }}
          >
            Enable browser SLA alerts
          </GhostButton>
          <GhostButton onClick={() => void refresh()}>Refresh</GhostButton>
          <Link href="/hitl-queue" className="inline-flex min-h-10 items-center text-xs font-medium text-violet-400 hover:underline md:min-h-8">
            Open HITL →
          </Link>
        </>
      }
    >
      <div className="grid min-w-0 grid-cols-1 gap-3 min-[480px]:grid-cols-2 xl:grid-cols-4">
        <Stat
          label="SLA breaches"
          value={String(sla.breachCount)}
          hint={`${sla.atRiskCount} approaching · ${sla.openCount} open`}
          hot={sla.breachCount > 0}
        />
        <Stat
          label="Hours saved"
          value={`${sla.hoursSaved}h`}
          hint={`last 14 days · ${sla.minutesSaved} min · spam ${sla.spamBlocked} · auto ${sla.autoHandled}`}
          good
        />
        <Stat
          label="Median open age"
          value={sla.medianOpenAgeMin == null ? "—" : formatAge(sla.medianOpenAgeMin)}
          hint="Across open / review threads"
        />
        <Stat
          label="Worst open"
          value={sla.worstSubject ?? "—"}
          hint={
            sla.worstThreadId
              ? `${formatAge(sla.worstAgeMin)} vs ${formatAge(sla.worstTargetMin)} target`
              : "No open SLA threads"
          }
        />
      </div>

      <div className="grid min-w-0 gap-4 lg:grid-cols-5">
        <ChartCard title="Breaches by bucket" subtitle="Gauge: past-target threads out of open threads (lower is better)" demo={demo} source={SOURCE_DESK} style={{ gridColumn: "1 / -1" }}>
          <div className="grid grid-cols-2 justify-items-center gap-x-2 gap-y-4 sm:grid-cols-3 lg:grid-cols-5">
            {sla.buckets.map((b) => (
              <BucketGauge
                key={b.id}
                label={b.label}
                value={b.breach}
                max={Math.max(1, b.open)}
                size={132}
                caption={b.open === 0 ? "No open threads" : `${b.open} open · ${b.atRisk} at risk · ${b.breach} past target`}
              />
            ))}
          </div>
        </ChartCard>
      </div>

      {ageBars.length > 0 ? (
        <ChartCard title="Open threads against their target" subtitle="100% = the SLA target for that thread's bucket. Past the line is a breach." demo={demo} source={SOURCE_DESK}>
          <HBarList items={ageBars} marker={100} markerLabel="SLA target (100%)" format={(n) => `${Math.round(n)}%`} />
        </ChartCard>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {(
          [
            ["breach", "Breaches"],
            ["open", "All open"],
            ["all", "Open + handled"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setFilter(id)}
            className={cn(
              "min-h-10 rounded-lg border px-3 py-1.5 text-xs font-medium transition md:min-h-8",
              filter === id
                ? "border-violet-500/40 bg-violet-500/10 text-violet-300"
                : "border-border text-muted-foreground hover:text-foreground"
            )}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="glass-panel overflow-hidden rounded-xl">
        <div className="border-b border-border/60 px-4 py-3 text-xs font-medium text-muted-foreground">
          Threads by age · {ranked.length} shown
        </div>
        {ranked.length === 0 ? (
          <p className="px-4 py-8 text-sm text-muted-foreground">
            No matching threads. Load demo in Settings or ingest mail, then refresh.
          </p>
        ) : (
          <table className="stack-table w-full text-left text-xs">
            <thead className="border-b border-border/50 text-[10px] uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-2 font-medium">Subject</th>
                <th className="px-3 py-2 font-medium">From</th>
                <th className="px-3 py-2 font-medium">Category</th>
                <th className="px-3 py-2 font-medium">Age</th>
                <th className="px-3 py-2 font-medium">Target</th>
                <th className="px-3 py-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {ranked.map((t) => {
                const age = threadAgeMin(t);
                const bucket = slaBucketFor(t, vipSenders);
                const target =
                  bucket === "vip"
                    ? 30
                    : bucket === "urgent" || bucket === "action"
                      ? 60
                      : bucket === "meeting"
                        ? 240
                        : 1440;
                const breached = (t.status === "open" || t.status === "review") && age > target;
                const msg = toInboxMessage(t);
                return (
                  <tr key={t.id} className="border-b border-border/30 hover:bg-white/[0.03]">
                    <td data-label="Subject" className="px-4 py-2.5">
                      <Link
                        href="/hitl-queue"
                        className="font-medium text-foreground hover:text-violet-300"
                      >
                        {t.subject}
                      </Link>
                      {msg.priority === "urgent" ? (
                        <span className="ml-2 text-[10px] text-rose-400">urgent</span>
                      ) : null}
                    </td>
                    <td data-label="From" className="px-3 py-2.5 text-muted-foreground">{t.fromEmail}</td>
                    <td data-label="Category" className="px-3 py-2.5 text-muted-foreground">{categoryLabel(t.category)}</td>
                    <td
                      data-label="Age" suppressHydrationWarning
                      className={cn(
                        "px-3 py-2.5 font-semibold",
                        breached ? "text-rose-400" : "text-foreground"
                      )}
                    >
                      {formatAge(age)}
                    </td>
                    <td data-label="Target" className="px-3 py-2.5 text-muted-foreground">
                      {bucket === "vip" ? "30m" : categoryTargetLabel(t.category)}
                    </td>
                    <td data-label="Status" className="px-3 py-2.5 text-muted-foreground">{statusLabel(t.status)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </PageFrame>
  );
}

function Stat({
  label,
  value,
  hint,
  hot,
  good,
}: {
  label: string;
  value: string;
  hint: string;
  hot?: boolean;
  good?: boolean;
}) {
  return (
    <div className="glass-panel rounded-xl px-4 py-3">
      <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p
        className={cn(
          "mt-1 truncate text-xl font-semibold tracking-tight",
          hot ? "text-rose-400" : good ? "text-emerald-400" : "text-foreground"
        )}
      >
        {value}
      </p>
      <p className="mt-1 text-[11px] text-muted-foreground">{hint}</p>
    </div>
  );
}
