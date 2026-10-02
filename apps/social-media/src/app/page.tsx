import Link from "next/link";
import { CalendarDays, PenLine } from "lucide-react";
import { AskAiSection, DeskChrome } from "@/components/ask-ai-section";
import { SetupChecklist } from "@/components/setup-checklist";
import { AutopilotSwitch } from "@/components/autopilot-switch";
import { summarizeCalendar } from "@/lib/analytics";
import { channelLabel, formatSlot, PILLAR_LABEL, snippet, STATUS_LABEL } from "@/lib/format";
import { gapMessage, pillarGaps } from "@/lib/gaps";
import { openSlots, scoreHealth } from "@/lib/health";
import { autopilotEnabled, getBrand, listPosts } from "@/lib/store";
import type { PostStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

type Pipeline = "all" | "ready" | "review" | "draft";

function Spark({ values }: { values: number[] }) {
  const max = Math.max(1, ...values);
  const width = 160;
  const height = 30;
  const coords = values.map((value, index) => {
    const x = values.length === 1 ? 0 : (index / (values.length - 1)) * width;
    const y = height - 4 - (value / max) * (height - 8);
    return { x, y };
  });
  const line = coords.map((point) => `${point.x},${point.y}`).join(" ");
  const area = `0,${height} ${line} ${width},${height}`;
  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="mt-4 h-8 w-full text-primary" aria-hidden>
      <polygon points={area} fill="currentColor" opacity="0.12" />
      <polyline points={line} fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}

function dayCounts(posts: { scheduledFor: string }[]) {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  return Array.from({ length: 7 }, (_, index) => {
    const day = new Date(start);
    day.setDate(start.getDate() + index);
    return posts.filter((post) => new Date(post.scheduledFor).toDateString() === day.toDateString()).length;
  });
}

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
            <span className="text-[10px] font-semibold tracking-[0.14em] text-muted-foreground uppercase">Workspaces</span>
            <span className="text-muted-foreground/40">/</span>
            <span className="text-[10px] font-semibold tracking-[0.14em] text-primary uppercase">{brand.name}</span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-0.5 text-[10px] font-medium text-muted-foreground">
              <span className="size-1.5 rounded-full bg-primary" />
              No network connected · sign-off only
            </span>
          </div>
          <h1 className="mt-1 font-[family-name:var(--font-sora)] text-[32px] leading-10 font-bold tracking-tight text-foreground">Content desk</h1>
          <SetupChecklist />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link href="/calendar" className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-muted px-4 text-sm font-medium text-foreground hover:bg-accent">
            <CalendarDays className="size-4 text-secondary-foreground" aria-hidden />
            Open calendar
          </Link>
          <a href="#ask-helix" className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground shadow-[0_0_20px_rgba(247,81,161,0.4)]">
            <PenLine className="size-4" aria-hidden />
            Draft a post
          </a>
        </div>
      </header>

      <DeskChrome brand={brand.name} />

      <section aria-label="Key numbers" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Link href="/posts?status=needs_review" className="group relative overflow-hidden rounded-xl bg-card p-5 shadow-md transition hover:bg-accent">
          <div className="pointer-events-none absolute -right-6 -bottom-6 size-24 rounded-full bg-primary/10 blur-2xl" />
          <p className="text-[10px] font-semibold tracking-[0.14em] text-muted-foreground uppercase">In review</p>
          <p className="mt-3 font-mono text-4xl font-bold text-foreground">{queue.length}</p>
          <p className="mt-1 text-[11px] text-muted-foreground">{queue.length} of {posts.length} planned</p>
          <Spark values={dayCounts(queue)} />
        </Link>
        <Link href="/posts?status=needs_review&ready=1" className="relative overflow-hidden rounded-xl bg-card p-5 shadow-md transition hover:bg-accent">
          <p className="text-[10px] font-semibold tracking-[0.14em] text-muted-foreground uppercase">Ready to approve</p>
          <div className="mt-3 flex items-end justify-between gap-3">
            <p className="font-mono text-4xl font-bold text-foreground">{readyQueue.length}</p>
            <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-semibold text-primary">Score 100</span>
          </div>
          <p className="mt-4 text-[11px] text-muted-foreground">A person still signs off. Nothing is published.</p>
        </Link>
        <Link href="/posts?status=approved" className="relative overflow-hidden rounded-xl bg-card p-5 shadow-md transition hover:bg-accent">
          <p className="text-[10px] font-semibold tracking-[0.14em] text-muted-foreground uppercase">Approved</p>
          <p className="mt-3 font-mono text-4xl font-bold text-foreground">{approved.length}</p>
          <p className="mt-4 text-[11px] text-muted-foreground">Sign-off recorded. These posts are not live.</p>
        </Link>
        <Link href="/analytics" className="relative overflow-hidden rounded-xl bg-card p-5 shadow-md transition hover:bg-accent">
          <p className="text-[10px] font-semibold tracking-[0.14em] text-muted-foreground uppercase">Quality</p>
          <div className="mt-3 flex items-end justify-between gap-3">
            <p className="font-mono text-4xl font-bold text-foreground">{health.avg}</p>
            <span className="text-[11px] text-muted-foreground">/100</span>
          </div>
          <p className="mt-4 text-[11px] text-muted-foreground">Form score · {health.scope}. Not reach or revenue.</p>
        </Link>
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
                    "shrink-0 rounded-lg px-3.5 py-1.5 text-xs font-medium",
                    pipeline === tab.id ? "bg-primary font-semibold text-primary-foreground shadow-[0_0_12px_rgba(247,81,161,0.35)]" : "text-muted-foreground hover:bg-accent hover:text-foreground"
                  )}
                >
                  {tab.label}
                </Link>
              ))}
            </div>
            <Link href="/api/calendar/export?format=csv" className="shrink-0 text-xs font-medium text-muted-foreground hover:text-foreground">
              Export csv
            </Link>
          </div>

          {shown.length === 0 ? (
            <p className="rounded-xl bg-card px-5 py-10 text-center text-sm text-muted-foreground">Nothing in this set.</p>
          ) : (
            shown.map((post) => {
              const cover = post.media?.find((item) => item.kind === "image");
              const tone: Record<PostStatus, string> = {
                draft: "text-muted-foreground",
                needs_review: "text-primary",
                changes: "text-destructive",
                approved: "text-secondary-foreground",
                published: "text-secondary-foreground",
              };
              return (
                <article key={post.id} className="flex flex-col gap-4 rounded-xl bg-card p-5 shadow-md transition hover:bg-accent md:flex-row">
                  <div className="relative h-36 w-full shrink-0 overflow-hidden rounded-lg bg-muted md:w-48">
                    {cover ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={cover.url} alt="" className="size-full object-cover" />
                    ) : (
                      <span className="grid size-full place-items-center px-3 text-center text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">{PILLAR_LABEL[post.pillar]}</span>
                    )}
                    <span className="absolute bottom-2 left-2 rounded bg-background/90 px-1.5 py-0.5 text-[10px] font-semibold text-primary">{channelLabel(post.channel)}</span>
                  </div>
                  <div className="flex min-w-0 flex-1 flex-col justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className={cn("text-[10px] font-semibold tracking-wide uppercase", tone[post.status])}>{STATUS_LABEL[post.status]}</p>
                        <span className="rounded-full bg-primary/15 px-2.5 py-0.5 text-[10px] font-bold text-primary">Score {post.readiness.score}/100</span>
                      </div>
                      <h3 className="mt-1 text-lg leading-snug font-bold text-foreground">{snippet(post.caption, 72)}</h3>
                      <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{post.caption}</p>
                    </div>
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <p className="text-[11px] text-muted-foreground">{formatSlot(post.scheduledFor)} · {PILLAR_LABEL[post.pillar]}</p>
                      <Link href={`/posts/${post.id}`} className="inline-flex min-h-9 items-center rounded-lg bg-primary px-3 text-xs font-semibold text-primary-foreground">
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
            <p className="text-[10px] font-semibold tracking-[0.14em] text-muted-foreground uppercase">Form score</p>
            <div className="mt-1 flex items-baseline justify-between gap-3">
              <h2 className="text-lg font-bold text-foreground">{health.avg}/100</h2>
              <span className="text-[11px] text-muted-foreground">{health.scope}</span>
            </div>
            <ul className="mt-4 space-y-2">
              {balance.pillars.map((row) => (
                <li key={row.pillar}>
                  <div className="flex items-center justify-between text-[11px] text-muted-foreground">
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
              <ul className="mt-3 space-y-1 text-[11px] text-muted-foreground">
                {health.weak.map((row) => (
                  <li key={row.pillar}>{PILLAR_LABEL[row.pillar]} averages {row.avg}. Open a draft and use Auto-fix.</li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-[11px] text-muted-foreground">No pillar in this set averages under 90.</p>
            )}
          </section>

          <section className="rounded-xl bg-card p-5 shadow-md">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-[10px] font-semibold tracking-[0.14em] text-muted-foreground uppercase">Open days</p>
                <h2 className="text-lg font-bold text-foreground">Next 3 days</h2>
              </div>
              <AutopilotSwitch on={autopilot} />
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              {slots.length ? slots.join(" · ") : "The next 3 days already have posts."} Autopilot drafts empty days once. It does not publish.
            </p>
            {gaps.length ? (
              <ul className="mt-3 space-y-1 text-[11px] text-muted-foreground">
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
