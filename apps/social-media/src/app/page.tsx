import Link from "next/link";
import { CalendarDays, PenLine, Sparkles } from "lucide-react";
import { ChartCard, Funnel, Sparkline, StackedBar } from "@helix/ui";
import { AskAiSection, AskHelixButton, DeskChrome } from "@/components/ask-ai-section";
import { ChannelChip } from "@/components/channel";
import { PillarDonut, Source } from "@/components/plan-charts";
import { PostThumb } from "@/components/post-thumb";
import { ReadinessRing } from "@/components/readiness-ring";
import { SetupChecklist } from "@/components/setup-checklist";
import { AutopilotSwitch } from "@/components/autopilot-switch";
import { plannedPerDay, statusFunnel, summarizeCalendar } from "@/lib/analytics";
import { connectionReport } from "@/lib/connections";
import { channelLabel, formatSlot, PILLAR_LABEL, snippet, STATUS_LABEL } from "@/lib/format";
import { DESK_TZ_LABEL } from "@/lib/tz";
import { CHANNEL_COLOR, CHANNEL_ORDER } from "@/lib/visuals";
import { gapMessage, pillarGaps } from "@/lib/gaps";
import { openSlots, scoreHealth } from "@/lib/health";
import { autopilotEnabled, currentDeskMode, getBrand, listPosts } from "@/lib/store";
import type { PostStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

type Pipeline = "all" | "ready" | "review" | "draft";

function pipelineHref(pipeline: Pipeline) {
  return pipeline === "all" ? "/" : `/?pipeline=${pipeline}`;
}

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ pipeline?: string }> }) {
  const params = await searchParams;
  const pipeline: Pipeline = params.pipeline === "ready" || params.pipeline === "review" || params.pipeline === "draft" ? params.pipeline : "all";
  const [posts, brand, autopilot] = await Promise.all([listPosts(), getBrand(), autopilotEnabled()]);
  const queue = posts.filter((post) => post.status === "needs_review");
  const readyQueue = queue.filter((post) => post.readiness.ready);
  const approved = posts.filter((post) => post.status === "approved");
  const drafts = posts.filter((post) => post.status === "draft");
  const gaps = pillarGaps(posts);
  const balance = summarizeCalendar(posts.map((post) => ({ pillar: post.pillar, status: post.status, score: post.readiness.score })));
  const balanceMax = Math.max(1, ...balance.pillars.map((row) => row.count));
  const health = scoreHealth(posts.map((post) => ({ pillar: post.pillar, score: post.readiness.score, scheduledFor: post.scheduledFor })));
  const slots = openSlots(posts);
  const demo = currentDeskMode() === "demo";
  const queueSpark = plannedPerDay(queue, 7).map((day) => day.count);
  const funnel = statusFunnel(posts.map((post) => post.status));
  const channelSegments = CHANNEL_ORDER.map((channel) => ({ label: channelLabel(channel), value: posts.filter((post) => post.channel === channel).length, color: CHANNEL_COLOR[channel] }));
  const readyCount = posts.filter((post) => post.readiness.ready).length;
  const connections = connectionReport();
  const networkTokens = connections.channels.filter((row) => row.tokenState === "set" && row.adapter !== "token_only").length;
  const shown = [...posts]
    .filter((post) => {
      if (pipeline === "ready") return post.readiness.score === 100 && post.status === "needs_review";
      if (pipeline === "review") return post.status === "needs_review";
      if (pipeline === "draft") return post.status === "draft";
      return true;
    })
    .sort((a, b) => a.scheduledFor.localeCompare(b.scheduledFor))
    .slice(0, 4);

  const tabs: { id: Pipeline; label: string }[] = [
    { id: "all", label: `All planned (${posts.length})` },
    { id: "ready", label: `Ready (${readyQueue.length})` },
    { id: "review", label: `In review (${queue.length})` },
    { id: "draft", label: `Drafts (${drafts.length})` },
  ];

  return (
    <>
      <header className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold tracking-[0.14em] text-muted-foreground uppercase">Workspaces</span>
            <span className="text-muted-foreground/40">/</span>
            <span className="text-xs font-semibold tracking-[0.14em] text-primary uppercase">{brand.name}</span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
              <span className="size-1.5 rounded-full bg-primary" />
              {networkTokens === 0
                ? "No network connected · sign-off only"
                : `${networkTokens} network ${networkTokens === 1 ? "token" : "tokens"} set · publishing ${connections.publishSwitch ? "on, after approval" : "off"}`}
            </span>
          </div>
          <h1 className="mt-1 font-[family-name:var(--font-sora)] text-[32px] leading-10 font-bold tracking-tight text-foreground">Content desk</h1>
          <SetupChecklist />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link href="/calendar" className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-muted px-4 text-sm font-medium text-foreground hover:bg-accent lg:min-h-10">
            <CalendarDays className="size-4 text-secondary-foreground" aria-hidden />
            Open calendar
          </Link>
          <AskHelixButton className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border border-primary/50 bg-primary/10 px-4 text-sm font-semibold text-primary hover:bg-primary/20 lg:min-h-10">
            <Sparkles className="size-4" aria-hidden />
            Ask Helix AI
          </AskHelixButton>
          <a href="#ask-helix" className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground shadow-[0_0_20px_rgba(247,81,161,0.4)] lg:min-h-10">
            <PenLine className="size-4" aria-hidden />
            Draft a post
          </a>
        </div>
      </header>

      <DeskChrome brand={brand.name} />

      <section aria-label="Key numbers" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Link href="/posts?status=needs_review" className="group relative overflow-hidden rounded-xl bg-card p-5 shadow-md transition hover:bg-accent">
          <div className="pointer-events-none absolute -right-6 -bottom-6 size-24 rounded-full bg-primary/10 blur-2xl" />
          <p className="text-xs font-semibold tracking-[0.14em] text-muted-foreground uppercase">In review</p>
          <p className="mt-3 font-mono text-4xl font-bold text-foreground">{queue.length}</p>
          <p className="mt-1 text-xs text-muted-foreground">{queue.length} of {posts.length} planned</p>
          <div className="mt-3 flex items-center justify-between gap-3 text-xs text-muted-foreground">
            <Sparkline values={queueSpark} color="#f751a1" label="Posts in review over the next 7 days" width={120} height={28} />
            <span>next 7 days</span>
          </div>
        </Link>
        <Link href="/posts?status=needs_review&ready=1" className="relative overflow-hidden rounded-xl bg-card p-5 shadow-md transition hover:bg-accent">
          <p className="text-xs font-semibold tracking-[0.14em] text-muted-foreground uppercase">Ready to approve</p>
          <div className="mt-3 flex items-end justify-between gap-3">
            <p className="font-mono text-4xl font-bold text-foreground">{readyQueue.length}</p>
            <span className="rounded-full bg-primary/15 px-2 py-0.5 text-xs font-semibold text-primary">Score 100</span>
          </div>
          <p className="mt-4 text-xs text-muted-foreground">A person still signs off. Nothing is published.</p>
        </Link>
        <Link href="/posts?status=approved" className="relative overflow-hidden rounded-xl bg-card p-5 shadow-md transition hover:bg-accent">
          <p className="text-xs font-semibold tracking-[0.14em] text-muted-foreground uppercase">Approved</p>
          <p className="mt-3 font-mono text-4xl font-bold text-foreground">{approved.length}</p>
          <p className="mt-4 text-xs text-muted-foreground">Sign-off recorded. These posts are not live.</p>
        </Link>
        <Link href="/analytics" className="relative overflow-hidden rounded-xl bg-card p-5 shadow-md transition hover:bg-accent">
          <p className="text-xs font-semibold tracking-[0.14em] text-muted-foreground uppercase">Quality</p>
          <div className="mt-3 flex items-end justify-between gap-3">
            <p className="font-mono text-4xl font-bold text-foreground">{health.avg}</p>
            <span className="text-xs text-muted-foreground">/100</span>
          </div>
          <p className="mt-4 text-xs text-muted-foreground">Form score · {health.scope}. Not reach or revenue.</p>
        </Link>
      </section>

      <section aria-label="Desk overview" className="grid gap-4 lg:grid-cols-3">
        <ChartCard title="Approval funnel" subtitle="Posts that reached each stage" demo={demo}>
          <Funnel steps={funnel} color="#38bdf8" />
          <Source>Source: post status on this desk.</Source>
        </ChartCard>
        <ChartCard title="Readiness" subtitle="Average form score of the planned posts" demo={demo}>
          <div className="flex flex-wrap items-center gap-5">
            <ReadinessRing r={{ score: health.avg, ready: health.avg === 100 }} size={96} />
            <div className="min-w-0 text-sm">
              <p className="text-foreground">
                <span className="font-mono text-2xl font-bold">{readyCount}</span> of {posts.length} posts are ready to approve
              </p>
              <p className="mt-1 text-xs text-muted-foreground">Scope: {health.scope}. Instagram and TikTok need an attached image or clip to count as ready.</p>
            </div>
          </div>
          <Source>Source: readiness scores (length, hashtags, call to action, voice, visual brief). Form, not performance.</Source>
        </ChartCard>
        <ChartCard title="Mix" subtitle="Planned posts by channel and pillar" demo={demo}>
          <StackedBar ariaLabel="Planned posts by channel" segments={channelSegments} />
          <div className="mt-5">
            <PillarDonut rows={balance.pillars} size={116} />
          </div>
          <Source>Source: the planned calendar. Counts of posts, not reach.</Source>
        </ChartCard>
      </section>

      <div data-tour="social-ask">
        <AskAiSection />
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-12">
        <section className="flex flex-col gap-4 lg:col-span-8" aria-labelledby="pipeline-heading">
          <div className="flex flex-col gap-3 rounded-xl bg-card p-3 shadow-md sm:flex-row sm:items-center sm:justify-between">
            <h2 id="pipeline-heading" className="sr-only">Planned posts</h2>
            <div className="flex gap-2 overflow-x-auto">
              {tabs.map((tab) => (
                <Link
                  key={tab.id}
                  href={pipelineHref(tab.id)}
                  aria-current={pipeline === tab.id ? "page" : undefined}
                  className={cn(
                    "inline-flex min-h-10 shrink-0 items-center rounded-lg px-3.5 text-xs font-medium",
                    pipeline === tab.id ? "bg-primary font-semibold text-primary-foreground shadow-[0_0_12px_rgba(247,81,161,0.35)]" : "text-muted-foreground hover:bg-accent hover:text-foreground"
                  )}
                >
                  {tab.label}
                </Link>
              ))}
            </div>
            <Link href="/api/calendar/export?format=csv" className="inline-flex min-h-10 shrink-0 items-center text-xs font-medium text-muted-foreground hover:text-foreground">
              Export csv
            </Link>
          </div>

          {shown.length === 0 ? (
            <p className="rounded-xl bg-card px-5 py-10 text-center text-sm text-muted-foreground">Nothing in this set.</p>
          ) : (
            shown.map((post) => {
              const tone: Record<PostStatus, string> = {
                draft: "text-muted-foreground",
                needs_review: "text-primary",
                changes: "text-destructive",
                approved: "text-secondary-foreground",
                published: "text-secondary-foreground",
              };
              return (
                <article key={post.id} className="flex flex-col gap-4 rounded-xl bg-card p-5 shadow-md transition hover:bg-accent md:flex-row">
                  <div className="relative h-44 w-full shrink-0 md:h-36 md:w-48">
                    <PostThumb post={post} className="size-full" />
                    <ChannelChip channel={post.channel} label className="absolute top-2 left-2 bg-background/90 backdrop-blur" />
                  </div>
                  <div className="flex min-w-0 flex-1 flex-col justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className={cn("text-xs font-semibold tracking-wide uppercase", tone[post.status])}>{STATUS_LABEL[post.status]}</p>
                        <span className="inline-flex items-center gap-2 text-xs font-semibold text-muted-foreground">
                          {post.readiness.ready ? "Ready" : "Needs work"}
                          <ReadinessRing r={post.readiness} size={40} />
                        </span>
                      </div>
                      <h3 className="mt-1 text-lg leading-snug font-bold text-foreground">{snippet(post.caption, 72)}</h3>
                      <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{post.caption}</p>
                    </div>
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <p className="text-xs text-muted-foreground">{formatSlot(post.scheduledFor)} {DESK_TZ_LABEL} · {PILLAR_LABEL[post.pillar]}</p>
                      <Link href={`/posts/${post.id}`} className="inline-flex min-h-10 items-center rounded-lg bg-primary px-4 text-xs font-semibold text-primary-foreground">
                        Open
                      </Link>
                    </div>
                  </div>
                </article>
              );
            })
          )}
        </section>

        <aside className="flex flex-col gap-4 lg:col-span-4">
          <section className="rounded-xl bg-card p-5 shadow-md">
            <p className="text-xs font-semibold tracking-[0.14em] text-muted-foreground uppercase">Form score</p>
            <div className="mt-1 flex items-baseline justify-between gap-3">
              <h2 className="text-lg font-bold text-foreground">{health.avg}/100</h2>
              <span className="text-xs text-muted-foreground">{health.scope}</span>
            </div>
            <ul className="mt-4 space-y-2">
              {balance.pillars.map((row) => (
                <li key={row.pillar}>
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>{PILLAR_LABEL[row.pillar]}</span>
                    <span className="font-mono text-foreground">{row.count}</span>
                  </div>
                  <span className="mt-1 block h-1 rounded-full bg-muted">
                    <span className="block h-1 rounded-full bg-primary" style={{ width: `${(row.count / balanceMax) * 100}%` }} />
                  </span>
                </li>
              ))}
            </ul>
            {health.weak.length ? (
              <ul className="mt-3 space-y-1 text-xs text-muted-foreground">
                {health.weak.map((row) => (
                  <li key={row.pillar}>{PILLAR_LABEL[row.pillar]} averages {row.avg}. Open a draft and use Auto-fix.</li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-xs text-muted-foreground">No pillar in this set averages under 90.</p>
            )}
          </section>

          <section className="rounded-xl bg-card p-5 shadow-md">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-xs font-semibold tracking-[0.14em] text-muted-foreground uppercase">Open days</p>
                <h2 className="text-lg font-bold text-foreground">Next 3 days</h2>
              </div>
              <AutopilotSwitch on={autopilot} />
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              {slots.length ? slots.join(" · ") : "The next 3 days already have posts."} Autopilot drafts empty days once. It does not publish.
            </p>
            {gaps.length ? (
              <ul className="mt-3 space-y-1 text-xs text-muted-foreground">
                {gaps.slice(0, 3).map((gap) => (
                  <li key={gap.pillar}>{gapMessage(gap)}</li>
                ))}
              </ul>
            ) : null}
          </section>
        </aside>
      </div>
    </>
  );
}
