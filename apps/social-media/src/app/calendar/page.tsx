import Link from "next/link";
import { DeskRefresher } from "@/components/ask-ai-section";
import { AutopilotSwitch } from "@/components/autopilot-switch";
import { CalendarBoard } from "@/components/calendar-board";
import { channelLabel, PILLAR_LABEL, STATUS_LABEL } from "@/lib/format";
import { FILTER_CHANNELS, FILTER_PILLARS, FILTER_STATUSES, matchesFilter, readCalendarFilter, type CalendarFilter } from "@/lib/filters";
import { listPosts, autopilotEnabled } from "@/lib/store";
import type { Channel, Pillar, PostStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

const DOT: Record<PostStatus, string> = {
  draft: "bg-slate-400",
  needs_review: "bg-amber-400",
  changes: "bg-rose-400",
  approved: "bg-emerald-400",
  published: "bg-violet-400",
};

function query(filter: CalendarFilter, patch: Partial<CalendarFilter> = {}, extra: { view?: string; cursor?: string } = {}): string {
  const next = { ...filter, ...patch };
  const q = new URLSearchParams();
  if (next.channel) q.set("channel", next.channel);
  if (next.pillar) q.set("pillar", next.pillar);
  if (next.status) q.set("status", next.status);
  if (extra.view && extra.view !== "month") q.set("view", extra.view);
  if (extra.cursor) q.set("cursor", extra.cursor);
  const qs = q.toString();
  return qs ? `/calendar?${qs}` : "/calendar";
}

function exportHref(format: string, filter: CalendarFilter): string {
  const q = new URLSearchParams({ format });
  if (filter.channel) q.set("channel", filter.channel);
  if (filter.pillar) q.set("pillar", filter.pillar);
  if (filter.status) q.set("status", filter.status);
  return `/api/calendar/export?${q}`;
}

function Chip({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      aria-current={active ? "true" : undefined}
      className={cn(
        "inline-flex min-h-7 items-center rounded-full border px-2.5 text-[11px] transition focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
        active ? "border-primary/50 bg-primary/15 font-semibold text-primary" : "border-border text-muted-foreground hover:text-foreground"
      )}
    >
      {children}
    </Link>
  );
}

export default async function CalendarPage({ searchParams }: PageProps<"/calendar">) {
  const sp = await searchParams;
  const view = sp.view === "week" || sp.view === "day" || sp.view === "grid" ? sp.view : "month";
  const feed = sp.feed === "instagram" || sp.feed === "tiktok" ? sp.feed : "all";
  const cursor = typeof sp.cursor === "string" ? sp.cursor : undefined;
  const filter = readCalendarFilter({
    channel: typeof sp.channel === "string" ? sp.channel : undefined,
    pillar: typeof sp.pillar === "string" ? sp.pillar : undefined,
    status: typeof sp.status === "string" ? sp.status : undefined,
  });
  const [all, autopilot] = await Promise.all([listPosts(), autopilotEnabled()]);
  const posts = all.filter((post) => matchesFilter(post, filter));

  return (
    <>
      <DeskRefresher />
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold text-foreground">Calendar</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {posts.length} of {all.length} posts match the filters. Move between months, weeks and days without losing the rest of the plan.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2" aria-label="Export the filtered calendar">
          <AutopilotSwitch on={autopilot} />
          {(["csv", "json", "pdf"] as const).map((format) => (
            <a
              key={format}
              href={exportHref(format, filter)}
              className="inline-flex min-h-9 items-center rounded-lg border border-border px-3 text-xs font-semibold text-foreground uppercase hover:bg-accent"
            >
              {format}
            </a>
          ))}
        </div>
      </header>

      <div className="sticky top-0 z-10 space-y-1.5 rounded-xl border border-border bg-background/80 p-2 backdrop-blur">
        <div className="flex flex-wrap gap-2" aria-label="Filter by channel">
          <Chip href={query(filter, { channel: null }, { view, cursor })} active={!filter.channel}>
            All channels
          </Chip>
          {FILTER_CHANNELS.map((channel: Channel) => (
            <Chip key={channel} href={query(filter, { channel }, { view, cursor })} active={filter.channel === channel}>
              {channelLabel(channel)}
            </Chip>
          ))}
        </div>
        <div className="flex flex-wrap gap-2" aria-label="Filter by pillar">
          <Chip href={query(filter, { pillar: null }, { view, cursor })} active={!filter.pillar}>
            All pillars
          </Chip>
          {FILTER_PILLARS.map((pillar: Pillar) => (
            <Chip key={pillar} href={query(filter, { pillar }, { view, cursor })} active={filter.pillar === pillar}>
              {PILLAR_LABEL[pillar]}
            </Chip>
          ))}
        </div>
        <div className="flex flex-wrap gap-2" aria-label="Filter by approval status">
          <Chip href={query(filter, { status: null }, { view, cursor })} active={!filter.status}>
            Any status
          </Chip>
          {FILTER_STATUSES.map((status: PostStatus) => (
            <Chip key={status} href={query(filter, { status }, { view, cursor })} active={filter.status === status}>
              {STATUS_LABEL[status]}
            </Chip>
          ))}
        </div>
      </div>

      <ul className="flex flex-wrap gap-3 text-xs text-muted-foreground" aria-label="Status legend">
        {FILTER_STATUSES.map((s) => (
          <li key={s} className="inline-flex items-center gap-1.5">
            <span className={cn("size-2 rounded-full", DOT[s])} aria-hidden />
            {STATUS_LABEL[s]}
          </li>
        ))}
      </ul>

      <CalendarBoard
        view={view}
        feed={feed}
        cursor={cursor}
        search={[filter.channel && `channel=${filter.channel}`, filter.pillar && `pillar=${filter.pillar}`, filter.status && `status=${filter.status}`].filter(Boolean).join("&")}
        posts={posts.map((post) => ({
          id: post.id,
          caption: post.caption,
          channel: post.channel,
          pillar: post.pillar,
          status: post.status,
          scheduledFor: post.scheduledFor,
          mediaUrl: post.media?.find((item) => item.kind === "image")?.url,
        }))}
      />
    </>
  );
}
