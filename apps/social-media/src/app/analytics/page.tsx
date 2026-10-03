import { ChartCard, Funnel, HBarList, StackedBar } from "@helix/ui";
import { CreateReportButton } from "@/components/create-report-button";
import { DemoSandbox } from "@/components/demo-sandbox";
import { ChannelPillarBars, hourLabel, PillarDonut, PlanHeatmap, PlannedArea, Source } from "@/components/plan-charts";
import { RealDataPanel } from "@/components/real-data-panel";
import { channelPillarMatrix, plannedHours, plannedPerDay, readinessBins, statusFunnel, summarizeCalendar } from "@/lib/analytics";
import { channelLabel, PILLAR_LABEL, STATUS_LABEL } from "@/lib/format";
import { currentDeskMode, listPosts } from "@/lib/store";
import { DESK_TZ_LABEL, zoneParts } from "@/lib/tz";
import { CHANNEL_COLOR, PILLAR_COLOR, STATUS_COLOR, STATUS_ORDER } from "@/lib/visuals";

export const dynamic = "force-dynamic";

export default async function AnalyticsPage() {
  const posts = await listPosts();
  const demo = currentDeskMode() === "demo";
  const summary = summarizeCalendar(posts.map((post) => ({ pillar: post.pillar, status: post.status, score: post.readiness.score })));
  const hours = plannedHours(posts.map((post) => ({ channel: post.channel, scheduledFor: post.scheduledFor })));
  const lead = [...summary.pillars].sort((a, b) => b.count - a.count || b.avgScore - a.avgScore)[0];
  const trend = plannedPerDay(posts, 14);
  const matrix = channelPillarMatrix(posts);
  const bins = readinessBins(posts.map((post) => post.readiness.score));
  const funnel = statusFunnel(posts.map((post) => post.status));
  const statusCounts = STATUS_ORDER.map((status) => ({ label: STATUS_LABEL[status], value: posts.filter((post) => post.status === status).length, color: STATUS_COLOR[status] }));
  const dow = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const heatHours = Array.from({ length: 14 }, (_, index) => index + 8);
  const parts = posts.map((post) => zoneParts(post.scheduledFor));
  const heat = dow.flatMap((day, dayIndex) => heatHours.map((hour) => ({ day, hour, count: parts.filter((p) => p.dow === dayIndex && p.hour === hour).length })));
  const planned = "Source: the planned calendar on this desk. Counts of posts, not engagement.";

  return (
    <>
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold text-foreground">Analytics</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Real account results from Meta come first, when a token is set. Everything below them counts the planned calendar and readiness scores, which are not engagement.
          </p>
        </div>
        <CreateReportButton />
      </header>

      <RealDataPanel />

      <h2 className="pt-2 text-sm font-semibold tracking-wider text-muted-foreground uppercase">Planned calendar (not engagement)</h2>

      <section className="rounded-xl border border-primary/30 bg-primary/5 p-5">
        <h2 className="text-sm font-semibold tracking-wider text-primary uppercase">From this calendar</h2>
        <p className="mt-2 text-sm text-foreground">
          {lead && lead.count
            ? `${PILLAR_LABEL[lead.pillar]} is the largest planned pillar: ${lead.count} posts, average readiness ${lead.avgScore}. The desk average is ${summary.avgScore}. These are planned posts and scores, not engagement.`
            : "No posts are planned in this workspace yet."}
        </p>
      </section>

      <section className="grid gap-4 sm:grid-cols-3">
        <article className="rounded-xl border border-border bg-card/80 p-5">
          <p className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">Score 100</p>
          <p className="mt-2 font-mono text-3xl text-foreground">{summary.bands.perfect}</p>
          <p className="mt-1 text-xs text-muted-foreground">{summary.bands.perfectApproved} of those are approved</p>
        </article>
        <article className="rounded-xl border border-border bg-card/80 p-5">
          <p className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">Below 100</p>
          <p className="mt-2 font-mono text-3xl text-foreground">{summary.bands.below}</p>
          <p className="mt-1 text-xs text-muted-foreground">{summary.bands.belowApproved} of those are approved</p>
        </article>
        <article className="rounded-xl border border-border bg-card/80 p-5">
          <p className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">Average score</p>
          <p className="mt-2 font-mono text-3xl text-foreground">{summary.avgScore}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {summary.approved} approved of {summary.total} planned
          </p>
        </article>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <ChartCard title="Pillar mix" subtitle="Share of planned posts. Not reach." demo={demo}>
          <PillarDonut rows={summary.pillars} />
          <Source>{planned}</Source>
        </ChartCard>
        <ChartCard title="Planned volume" subtitle="Posts already on the calendar for the next 14 days." demo={demo}>
          <PlannedArea days={trend} />
          <Source>{planned} Not an engagement curve.</Source>
        </ChartCard>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <ChartCard title="Channel by pillar" subtitle="Planned posts per network, split by content pillar." demo={demo}>
          <ChannelPillarBars rows={matrix} />
          <Source>{planned}</Source>
        </ChartCard>
        <ChartCard title="Readiness histogram" subtitle="How many posts fall in each score band." demo={demo}>
          <HBarList items={bins.map((bin) => ({ label: bin.label, value: bin.count, color: bin.color }))} format={(n) => `${n} posts`} />
          <Source>Source: readiness scores (length, hashtags, call to action, voice, visual brief). A score checks form, not taste or performance.</Source>
        </ChartCard>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <ChartCard title="Approval funnel" subtitle="Posts that reached each stage, by their current status." demo={demo}>
          <Funnel steps={funnel} color="#38bdf8" />
          <div className="mt-4">
            <StackedBar ariaLabel="Posts by status" segments={statusCounts} />
          </div>
          <Source>Source: post status on this desk. A post counts as sent to review once it has been in review, sent back, approved or published.</Source>
        </ChartCard>
        <ChartCard title="By pillar" subtitle="Posts, average readiness and posts at 100." demo={demo}>
          <HBarList
            items={summary.pillars.map((row) => ({ label: PILLAR_LABEL[row.pillar], value: row.count, color: PILLAR_COLOR[row.pillar], hint: `avg ${row.avgScore} · ${row.perfect} at 100` }))}
            format={(n) => `${n} posts`}
          />
          <Source>{planned}</Source>
        </ChartCard>
      </section>

      <ChartCard title="When posts are planned" subtitle={`Slots already on this calendar, in ${DESK_TZ_LABEL} (Eastern). Empty cells are not a recommendation: there is no audience history.`} demo={demo}>
        <PlanHeatmap cells={heat} />
        <Source>{planned}</Source>
      </ChartCard>

      <ChartCard title="Hours already on the calendar" subtitle={`The slots you already planned, in ${DESK_TZ_LABEL}. Not a recommendation from audience behavior.`} demo={demo}>
        {hours.length ? (
          <HBarList
            items={hours.map((row) => ({ label: `${channelLabel(row.channel)} · ${hourLabel(row.hour)} ${DESK_TZ_LABEL}`, value: row.count, color: CHANNEL_COLOR[row.channel] }))}
            format={(n) => `${n} posts`}
          />
        ) : (
          <p className="text-sm text-muted-foreground">No posts are scheduled in this workspace.</p>
        )}
        <Source>{planned}</Source>
      </ChartCard>

      <DemoSandbox />

      <section className="rounded-xl border border-border bg-card/80 p-5">
        <h2 className="text-lg font-semibold text-foreground">Comments and sentiment</h2>
        <p className="mt-2 text-sm text-muted-foreground">Network comments are not connected, so there is no sentiment, crisis signal or lead list from replies.</p>
      </section>
    </>
  );
}
