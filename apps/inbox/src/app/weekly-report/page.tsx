import { ChartCard, DemoChip, Donut, KpiCard } from "@helix/ui";
import { Clock3, Inbox, ShieldOff, Send } from "lucide-react";
import { currentDeskMode, getPreferences, listAllThreads } from "@/lib/store";
import { summarizeWeek } from "@/lib/weekly-report";
import { isAutoHandled, isSpamBlocked, inWindow } from "@/lib/sla";
import { dailyVolume } from "@/lib/desk-metrics";
import { isSlackConfigured } from "@/lib/slack";
import { ExportWeekly } from "@/components/export-report";
import { ColumnChart, Grid, PageFrame, SOURCE_DESK, SenderBars, VIOLET } from "@/components/desk-kit";

export const dynamic = "force-dynamic";

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}

function requestTime(): number {
  return Date.now();
}

export default async function WeeklyReportPage() {
  const prefs = await getPreferences();
  const threads = await listAllThreads();
  const now = requestTime();
  const report = summarizeWeek(threads, { vipSenders: prefs.vipSenders, now });
  const slackOn = isSlackConfigured();
  const demo = currentDeskMode() === "demo";

  const week = threads.filter((t) => inWindow(t, 7, now));
  const daily = dailyVolume(threads, 7, now, 0);
  const leads = week.filter((t) => !isSpamBlocked(t) && t.handedOffAt).length;
  const auto = week.filter((t) => isAutoHandled(t) && !t.handedOffAt).length;
  const spam = report.spamBlocked;
  const person = Math.max(0, report.threadsHandled - spam - leads - auto);

  const bySender = new Map<string, { name: string; email: string; count: number }>();
  for (const t of week) {
    if (isSpamBlocked(t)) continue;
    const row = bySender.get(t.fromEmail) ?? { name: t.fromName || t.fromEmail, email: t.fromEmail, count: 0 };
    row.count += 1;
    bySender.set(t.fromEmail, row);
  }
  const senders = [...bySender.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name)).slice(0, 6);

  return (
    <PageFrame
      title="Weekly report"
      chips={demo ? <DemoChip /> : null}
      subtitle={`${fmtDate(report.periodStart)} to ${fmtDate(report.periodEnd)}${slackOn ? " · posted to Slack every Monday" : " · connect Slack in Settings to auto-post this weekly"}`}
      actions={<ExportWeekly />}
    >
      <Grid cols={4}>
        <KpiCard label="Hours saved" value={`${report.hoursSaved}h`} hint="3 min per spam, 5 min per auto-handled" icon={<Clock3 className="size-4" />} accent="#34d399" spark={daily.map((d) => d.hoursSaved)} />
        <KpiCard label="Threads handled" value={report.threadsHandled} hint="spam included" icon={<Inbox className="size-4" />} accent={VIOLET} spark={daily.map((d) => d.total)} />
        <KpiCard label="Spam blocked" value={report.spamBlocked} hint="never reached a person" icon={<ShieldOff className="size-4" />} accent="#f87171" spark={daily.map((d) => d.spam)} />
        <KpiCard label="Sent to Leads" value={report.handedOffToLeads} hint="sales intent handed off" icon={<Send className="size-4" />} accent="#38bdf8" />
      </Grid>

      <Grid cols={2}>
        <ChartCard title="Threads per day" subtitle="Last 7 days, by how they were handled" demo={demo} source={SOURCE_DESK}>
          <ColumnChart
            showLegend
            ariaLabel="Threads received per day, split by handled automatically, needed review and spam blocked"
            items={daily.map((d) => ({
              label: d.label,
              parts: [
                { name: "Handled automatically", value: d.handled, color: VIOLET },
                { name: "Needed review", value: d.needsReview, color: "#fbbf24" },
                { name: "Spam blocked", value: d.spam, color: "#f87171" },
              ],
            }))}
          />
        </ChartCard>
        <ChartCard title="What happened to the week's mail" subtitle="Every thread counted once" demo={demo} source={SOURCE_DESK}>
          <Donut
            centerValue={report.threadsHandled}
            centerLabel="threads"
            ariaLabel="Threads by outcome"
            slices={[
              { label: "Handled automatically", value: auto, color: VIOLET },
              { label: "Needed a person", value: person, color: "#fbbf24" },
              { label: "Spam blocked", value: spam, color: "#f87171" },
              { label: "Sent to Leads", value: leads, color: "#38bdf8" },
            ].filter((s) => s.value > 0)}
          />
        </ChartCard>
        <ChartCard title="Top senders" subtitle="Real people only, spam excluded" demo={demo} source={SOURCE_DESK}>
          {senders.length ? <SenderBars senders={senders} /> : <p className="text-sm text-muted-foreground">No senders this week.</p>}
        </ChartCard>
        <ChartCard title="In plain words" demo={demo} source={SOURCE_DESK}>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li>
              <span className="font-semibold text-foreground">{report.autoHandled}</span> threads were handled without a review, including {leads} sent to Leads.
            </li>
            <li>
              {report.medianReplyAgeMin != null ? (
                <>
                  Open threads are a median <span className="font-semibold text-foreground">{Math.round(report.medianReplyAgeMin)} min</span> old.
                </>
              ) : (
                "No open threads to measure."
              )}
            </li>
            <li>{report.breachCount > 0 ? `${report.breachCount} open threads are past their SLA target. See the SLA page for detail.` : "No open thread is past its SLA target."}</li>
          </ul>
        </ChartCard>
      </Grid>
    </PageFrame>
  );
}
