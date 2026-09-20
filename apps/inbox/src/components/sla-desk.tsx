"use client";

import { useMemo, useState } from "react";
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

  return (
    <div className="space-y-6 p-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">SLA</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Time-to-first-human by urgency / VIP. Hours saved estimates ops time from auto-triage and
            spam blocked — the story Inbox sells to EAs and founders.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => void refresh()}
            className="text-xs font-medium text-muted-foreground hover:text-foreground"
          >
            Refresh
          </button>
          <Link href="/hitl-queue" className="text-xs font-medium text-violet-400 hover:underline">
            Open HITL →
          </Link>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat
          label="SLA breaches"
          value={String(sla.breachCount)}
          hint={`${sla.atRiskCount} approaching · ${sla.openCount} open`}
          hot={sla.breachCount > 0}
        />
        <Stat
          label="Hours saved"
          value={String(sla.hoursSaved)}
          hint={`${sla.minutesSaved} min · spam ${sla.spamBlocked} · auto ${sla.autoHandled}`}
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

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {sla.buckets.map((b) => (
          <div key={b.id} className="glass-panel rounded-xl px-3 py-3">
            <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              {b.label}
            </p>
            <p className="mt-1 text-lg font-semibold text-foreground">{b.open} open</p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              <span className={b.breach ? "text-rose-400" : ""}>{b.breach} breach</span>
              {" · "}
              {b.atRisk} at risk
            </p>
          </div>
        ))}
      </div>

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
              "rounded-lg border px-3 py-1.5 text-xs font-medium transition",
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
          <table className="w-full text-left text-xs">
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
                    <td className="px-4 py-2.5">
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
                    <td className="px-3 py-2.5 text-muted-foreground">{t.fromEmail}</td>
                    <td className="px-3 py-2.5 text-muted-foreground">{categoryLabel(t.category)}</td>
                    <td
                      className={cn(
                        "px-3 py-2.5 font-semibold",
                        breached ? "text-rose-400" : "text-foreground"
                      )}
                    >
                      {formatAge(age)}
                    </td>
                    <td className="px-3 py-2.5 text-muted-foreground">
                      {bucket === "vip" ? "30m" : categoryTargetLabel(t.category)}
                    </td>
                    <td className="px-3 py-2.5 capitalize text-muted-foreground">{t.status}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
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
