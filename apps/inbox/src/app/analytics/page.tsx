"use client";

import { useEffect, useMemo, useState } from "react";
import { AreaChart, ChartCard, Donut, DemoChip, HBarList, Heatmap, KpiCard } from "@helix/ui";
import { Clock3, Gauge as GaugeIcon, Inbox, UserCheck } from "lucide-react";
import type { InboxMessage } from "@/lib/types";
import { downloadCsv, printReport } from "@/lib/download";
import {
  CATEGORY_COLOR,
  HEAT_COLUMNS,
  HEAT_ROWS,
  STATUS_COLOR,
  categoryName,
  confidenceHistogram,
  countBy,
  dailyVolume,
  deskCounts,
  hourDayMatrix,
  statusLabel,
} from "@/lib/desk-metrics";
import { ColumnChart, GhostButton, Grid, PageFrame, SOURCE_DESK, VIOLET, useDeskMode, useNow, useTzOffset } from "@/components/desk-kit";
import { inWindow } from "@/lib/sla";

export default function InboxAnalyticsPage() {
  const [messages, setMessages] = useState<InboxMessage[]>([]);
  const [vip, setVip] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState<7 | 14>(14);
  const now = useNow();
  const mode = useDeskMode();
  const tz = useTzOffset();
  const demo = mode === "demo";

  useEffect(() => {
    void Promise.all([
      fetch("/api/messages").then((r) => r.json() as Promise<{ messages?: InboxMessage[] }>),
      fetch("/api/preferences").then((r) => r.json() as Promise<{ preferences?: { vipSenders?: string[] } }>).catch(() => ({ preferences: undefined })),
    ])
      .then(([m, p]) => {
        setMessages(m.messages ?? []);
        setVip(p.preferences?.vipSenders ?? []);
      })
      .catch(() => undefined)
      .finally(() => setLoading(false));
  }, []);

  const view = useMemo(() => {
    const at = now ?? 0;
    const rows = messages.filter((m) => inWindow(m, days, at));
    const counts = deskCounts(messages, { vipSenders: vip, now: at, windowDays: days });
    const daily = dailyVolume(messages, days, at, tz);
    const status = [...countBy(rows, (m) => m.status).entries()].map(([k, v]) => ({ label: statusLabel(k as InboxMessage["status"]), value: v, color: STATUS_COLOR[k as InboxMessage["status"]] }));
    const category = [...countBy(rows, (m) => m.category).entries()].map(([k, v]) => ({ label: categoryName(k as InboxMessage["category"]), value: v, color: CATEGORY_COLOR[k as InboxMessage["category"]] }));
    const route = [...countBy(rows.filter((m) => m.category !== "spam"), (m) => m.routeTo || "Unrouted").entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([label, value]) => ({ label, value }));
    return {
      rows,
      counts,
      daily,
      status,
      category,
      route,
      hist: confidenceHistogram(rows.map((m) => m.aiConfidence)),
      heat: hourDayMatrix(messages, tz, days, at),
    };
  }, [messages, vip, days, now, tz]);

  if (loading) return <div className="p-8 text-muted-foreground">Loading analytics…</div>;

  const { counts, daily } = view;
  const windowLabel = `last ${days} days`;

  return (
    <PageFrame
      title="Analytics"
      subtitle={`Volume, mix and review load for this desk over the ${windowLabel}. Every number counts spam as a thread and is timed by when the email was received.`}
      chips={demo ? <DemoChip /> : null}
      actions={
        <>
          <div role="group" aria-label="Time window" className="inline-flex overflow-hidden rounded-md border border-border text-xs">
            {([7, 14] as const).map((d) => (
              <button key={d} type="button" aria-pressed={days === d} onClick={() => setDays(d)} className={`min-h-10 px-3 py-1.5 md:min-h-8 ${days === d ? "bg-accent/20 font-semibold text-foreground" : "text-muted-foreground"}`}>
                {d} days
              </button>
            ))}
          </div>
          <GhostButton
            onClick={() =>
              downloadCsv(
                "helix-inbox-analytics.csv",
                view.rows.map((m) => ({ received: m.receivedAt, subject: m.subject, from: m.fromEmail, category: m.category, status: m.status, confidence: m.aiConfidence, urgency: m.urgencyScore }))
              )
            }
          >
            Export CSV
          </GhostButton>
          <GhostButton
            onClick={() =>
              printReport("Helix for Inbox analytics", [
                `Window: ${windowLabel}`,
                `Threads: ${counts.total}`,
                `Avg confidence: ${counts.avgConfidence}%`,
                `Hours saved: ${counts.hoursSaved}h`,
                ...view.category.map((row) => `${row.label}: ${row.value}`),
              ])
            }
          >
            Print PDF
          </GhostButton>
        </>
      }
    >
      <Grid cols={4}>
        <KpiCard label={`Threads · ${days}d`} value={counts.total} hint={`${counts.spamBlocked} spam blocked`} icon={<Inbox className="size-4" />} accent={VIOLET} spark={daily.map((d) => d.total)} />
        <KpiCard label="Hours saved" value={`${counts.hoursSaved}h`} hint={`${counts.minutesSaved} min estimated`} icon={<Clock3 className="size-4" />} accent="#34d399" spark={daily.map((d) => d.hoursSaved)} />
        <KpiCard label="Avg AI confidence" value={`${counts.avgConfidence}%`} hint="mean over received threads" icon={<GaugeIcon className="size-4" />} accent="#38bdf8" spark={daily.map((d) => d.confidence)} />
        <KpiCard label="Waiting on a person" value={counts.reviewCount} hint={`${counts.openCount} open · ${counts.breachCount} past SLA`} icon={<UserCheck className="size-4" />} accent="#fbbf24" />
      </Grid>

      <p className="text-sm text-muted-foreground">
        Hours saved is an estimate: 3 minutes per spam email blocked plus 5 minutes per thread handled without review ({counts.spamBlocked} and {counts.autoHandled} in this window).
      </p>

      <Grid cols={2}>
        <ChartCard title="Volume by day" subtitle="Threads received per day" demo={demo} source={SOURCE_DESK}>
          <AreaChart points={daily.map((d, i) => ({ label: daily.length > 8 && i === daily.length - 2 ? "" : d.label, value: d.total, detail: `${d.label} · ${d.spam} spam blocked` }))} ariaLabel={`Threads received per day over the ${windowLabel}`} />
        </ChartCard>
        <ChartCard title="Status" subtitle="Where threads ended up" demo={demo} source={SOURCE_DESK}>
          <Donut slices={view.status} centerValue={counts.total} centerLabel="threads" ariaLabel="Threads by status" />
        </ChartCard>
        <ChartCard title="AI confidence" subtitle="How sure the model was, per thread" demo={demo} source={SOURCE_DESK}>
          <ColumnChart items={view.hist.map((b) => ({ label: b.label, parts: [{ name: "Threads", value: b.value, color: b.label === "90-100" ? "#34d399" : b.label === "<50" || b.label === "50-59" ? "#fbbf24" : VIOLET }] }))} ariaLabel="Histogram of AI confidence" />
        </ChartCard>
        <ChartCard title="Category mix" subtitle="What kind of email arrives" demo={demo} source={SOURCE_DESK}>
          <Donut slices={view.category} centerValue={counts.total} centerLabel="threads" ariaLabel="Threads by category" />
        </ChartCard>
        <ChartCard title="When email arrives" subtitle="Weekday and 3-hour block, in your local time" demo={demo} source={SOURCE_DESK}>
          <Heatmap rows={HEAT_ROWS} columns={HEAT_COLUMNS} cells={view.heat} color={VIOLET} ariaLabel="Heatmap of threads by weekday and hour" />
        </ChartCard>
        <ChartCard title="Routed to" subtitle="Where non-spam threads were sent" demo={demo} source={SOURCE_DESK}>
          <HBarList items={view.route} colorAll={VIOLET} />
        </ChartCard>
      </Grid>
    </PageFrame>
  );
}
