import { CreateReportButton } from "@/components/create-report-button";
import { DemoSandbox } from "@/components/demo-sandbox";
import { PillarDonut, PlanHeatmap, PlannedArea } from "@/components/plan-charts";
import { RealDataPanel } from "@/components/real-data-panel";
import { plannedHours, summarizeCalendar } from "@/lib/analytics";
import { channelLabel, PILLAR_LABEL } from "@/lib/format";
import { listPosts } from "@/lib/store";

export const dynamic = "force-dynamic";

export default async function AnalyticsPage() {
  const posts = await listPosts();
  const summary = summarizeCalendar(posts.map((post) => ({ pillar: post.pillar, status: post.status, score: post.readiness.score })));
  const hours = plannedHours(posts.map((post) => ({ channel: post.channel, scheduledFor: post.scheduledFor })));
  const max = Math.max(1, ...summary.pillars.map((row) => row.count));
  const lead = [...summary.pillars].sort((a, b) => b.count - a.count || b.avgScore - a.avgScore)[0];
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const trend = Array.from({ length: 14 }, (_, index) => {
    const day = new Date(start);
    day.setDate(start.getDate() + index);
    return posts.filter((post) => new Date(post.scheduledFor).toDateString() === day.toDateString()).length;
  });
  const dow = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const heatHours = Array.from({ length: 14 }, (_, index) => index + 8);
  const heat = dow.flatMap((day) =>
    heatHours.map((hour) => ({
      day,
      hour,
      count: posts.filter((post) => {
        const when = new Date(post.scheduledFor);
        return dow[when.getDay()] === day && when.getHours() === hour;
      }).length,
    }))
  );

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

      <section className="grid gap-4 lg:grid-cols-2">
        <article className="rounded-xl border border-border bg-card/80 p-5">
          <h2 className="text-lg font-semibold text-foreground">Pillar mix</h2>
          <p className="mt-1 mb-4 text-xs text-muted-foreground">Share of planned posts. Not reach.</p>
          <PillarDonut rows={summary.pillars} />
        </article>
        <article className="rounded-xl border border-border bg-card/80 p-5">
          <h2 className="text-lg font-semibold text-foreground">Planned volume</h2>
          <p className="mt-1 mb-2 text-xs text-muted-foreground">Posts already on the calendar for the next 14 days. This is not an engagement curve.</p>
          <PlannedArea values={trend} />
        </article>
      </section>

      <section className="rounded-xl border border-border bg-card/80 p-5">
        <h2 className="text-lg font-semibold text-foreground">When posts are planned</h2>
        <p className="mt-1 mb-4 text-xs text-muted-foreground">A heat map of slots already on this calendar, in local time. Empty cells are not a recommendation. There is no audience history.</p>
        <PlanHeatmap cells={heat} />
      </section>

      <DemoSandbox />

      <section className="rounded-xl border border-border bg-card/80 p-5">
        <h2 className="text-lg font-semibold text-foreground">Comments and sentiment</h2>
        <p className="mt-2 text-sm text-muted-foreground">Network comments are not connected, so there is no sentiment, crisis signal or lead list from replies.</p>
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

      <section className="rounded-xl border border-border bg-card/80 p-5" aria-labelledby="pillar-heading">
        <h2 id="pillar-heading" className="text-lg font-semibold text-foreground">
          By pillar
        </h2>
        <ul className="mt-4 space-y-3">
          {summary.pillars.map((row) => (
            <li key={row.pillar} className="grid grid-cols-[9rem_1fr_auto] items-center gap-3 text-xs">
              <span className="truncate text-muted-foreground">{PILLAR_LABEL[row.pillar]}</span>
              <span className="h-2 rounded-full bg-muted">
                <span className="block h-2 rounded-full bg-primary/70" style={{ width: `${(row.count / max) * 100}%` }} />
              </span>
              <span className="tabular text-right font-mono text-foreground">
                {row.count} · avg {row.avgScore} · {row.perfect} at 100
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-xl border border-border bg-card/80 p-5" aria-labelledby="hours-heading">
        <h2 id="hours-heading" className="text-lg font-semibold text-foreground">
          Hours already on the calendar
        </h2>
        <p className="mt-1 text-xs text-muted-foreground">These are the hours you already planned, in this browser&apos;s local time. They are not a recommendation from audience behavior.</p>
        {hours.length ? (
          <ul className="mt-4 divide-y divide-border">
            {hours.map((row) => (
              <li key={`${row.channel}-${row.hour}`} className="flex items-center justify-between py-2 text-sm">
                <span className="text-foreground">
                  {channelLabel(row.channel)} · {row.hour}:00
                </span>
                <span className="font-mono text-muted-foreground">{row.count}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-sm text-muted-foreground">No posts are scheduled in this workspace.</p>
        )}
      </section>
    </>
  );
}
