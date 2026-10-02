import Link from "next/link";
import { DeskRefresher } from "@/components/ask-ai-section";
import { PostRow, ReadinessPill, StatusBadge } from "@/components/bits";
import { BatchApprove } from "@/components/batch-approve";
import { ChannelPreview } from "@/components/channel-preview";
import { channelLabel, STATUS_LABEL } from "@/lib/format";
import { getBrand, listPosts } from "@/lib/store";
import type { Channel, PostStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

const STATUSES: PostStatus[] = ["needs_review", "changes", "draft", "approved"];
const CHANNELS: Channel[] = ["instagram", "linkedin", "x", "tiktok", "facebook"];

function Filter({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      aria-current={active ? "true" : undefined}
      className={cn(
        "inline-flex min-h-9 items-center rounded-full border px-3 text-xs transition focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
        active ? "border-primary/50 bg-primary/15 font-semibold text-primary" : "border-border text-muted-foreground hover:text-foreground"
      )}
    >
      {children}
    </Link>
  );
}

export default async function PostsPage({ searchParams }: PageProps<"/posts">) {
  const sp = await searchParams;
  const status = STATUSES.includes(sp.status as PostStatus) ? (sp.status as PostStatus) : null;
  const channel = CHANNELS.includes(sp.channel as Channel) ? (sp.channel as Channel) : null;
  const readyOnly = sp.ready === "1";
  const [all, brand] = await Promise.all([listPosts(), getBrand()]);
  const posts = all.filter((p) => (!status || p.status === status) && (!channel || p.channel === channel) && (!readyOnly || p.readiness.score === 100));
  const peeked = typeof sp.peek === "string" ? all.find((post) => post.id === sp.peek) : undefined;

  const href = (s: PostStatus | null, c: Channel | null, ready = readyOnly) => {
    const q = new URLSearchParams();
    if (s) q.set("status", s);
    if (c) q.set("channel", c);
    if (ready) q.set("ready", "1");
    const qs = q.toString();
    return qs ? `/posts?${qs}` : "/posts";
  };

  const peekHref = (id: string) => {
    const base = href(status, channel);
    return `${base}${base.includes("?") ? "&" : "?"}peek=${encodeURIComponent(id)}`;
  };

  return (
    <>
      <DeskRefresher />
      <header>
        <h1 className="text-3xl font-semibold text-foreground">Posts</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {posts.length} of {all.length} posts{status || channel ? " match the filters" : ""}, soonest first.
        </p>
        <div className="mt-3">
          <BatchApprove
            rows={all.map((post) => ({
              channel: post.channel,
              pillar: post.pillar,
              scheduledFor: post.scheduledFor,
              status: post.status,
              score: post.readiness.score,
            }))}
          />
        </div>
      </header>

      <div className="space-y-2">
        <div className="flex flex-wrap gap-2" aria-label="Filter by status">
          <Filter href={href(null, channel, false)} active={!status && !readyOnly}>
            Any status
          </Filter>
          <Filter href={href("needs_review", channel, true)} active={readyOnly && status === "needs_review"}>
            Ready 100
          </Filter>
          {STATUSES.map((s) => (
            <Filter key={s} href={href(s, channel, false)} active={status === s && !(readyOnly && s === "needs_review")}>
              {STATUS_LABEL[s]} · {all.filter((p) => p.status === s).length}
            </Filter>
          ))}
        </div>
        <div className="flex flex-wrap gap-2" aria-label="Filter by channel">
          <Filter href={href(status, null, readyOnly)} active={!channel}>
            All channels
          </Filter>
          {CHANNELS.map((c) => (
            <Filter key={c} href={href(status, c)} active={channel === c}>
              {channelLabel(c)}
            </Filter>
          ))}
        </div>
      </div>

      <div className={peeked ? "grid items-start gap-4 lg:grid-cols-5" : ""}>
      <section className={`rounded-xl border border-border bg-card/80 ${peeked ? "lg:col-span-3" : ""}`} aria-label="Posts">
        {posts.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-muted-foreground">{all.length === 0 ? "No posts on this desk yet." : "No posts match these filters."}</p>
        ) : (
          <div className="divide-y divide-border">
            {posts.map((p) => (
              <PostRow key={p.id} p={p} showPillar peekHref={peekHref(p.id)} />
            ))}
          </div>
        )}
      </section>
      {peeked ? (
        <aside className="space-y-3 rounded-xl border border-border bg-card/80 p-4 lg:col-span-2" aria-label="Draft preview">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={peeked.status} />
            <ReadinessPill r={peeked.readiness} />
            <Link href={`/posts/${peeked.id}`} className="text-xs font-semibold text-primary">
              Open editor
            </Link>
          </div>
          <ChannelPreview
            channel={peeked.channel}
            brand={brand.name}
            handle={brand.handle}
            caption={peeked.caption}
            hashtags={peeked.hashtags}
            media={peeked.media?.find((item) => item.kind === "image") ?? peeked.media?.[0]}
          />
          <ul className="space-y-1 text-xs text-muted-foreground">
            {peeked.readiness.factors.map((factor) => (
              <li key={factor.label}>
                {factor.label}: {factor.points}/{factor.max}
              </li>
            ))}
          </ul>
        </aside>
      ) : null}
      </div>
    </>
  );
}
