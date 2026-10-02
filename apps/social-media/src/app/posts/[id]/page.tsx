import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { DeskRefresher } from "@/components/ask-ai-section";
import { ChannelBadge, ReadinessPill, StatusBadge } from "@/components/bits";
import { PostStudio } from "@/components/post-studio";
import { CommentsPanel } from "@/components/comments-panel";
import { DeskAction } from "@/components/desk-actions";
import { MediaPanel } from "@/components/media-panel";
import { RepurposePanel } from "@/components/repurpose-panel";
import { ReviewActions } from "@/components/review-actions";
import { ScheduleHint } from "@/components/schedule-hint";
import { formatSlot, PILLAR_LABEL } from "@/lib/format";
import { regulatedWords } from "@/lib/compose";
import { hardBlockers, postLength } from "@/lib/readiness";
import { sameSlot, suggestSlot } from "@/lib/schedule";
import { getBrand, getPost, listAssets } from "@/lib/store";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function PostPage({ params }: PageProps<"/posts/[id]">) {
  const { id } = await params;
  const [post, brand, assets] = await Promise.all([getPost(id), getBrand(), listAssets()]);
  if (!post) notFound();
  const blockers = hardBlockers(post.readiness.factors);
  const suggestion = suggestSlot(post.channel, post.pillar);
  const cover = post.media?.find((item) => item.kind === "image") ?? post.media?.[0];

  return (
    <>
      <DeskRefresher />
      <Link href="/posts" className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-3.5" aria-hidden /> All posts
      </Link>

      <header className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold text-foreground">{formatSlot(post.scheduledFor)}</h1>
        <ChannelBadge channel={post.channel} />
        <StatusBadge status={post.status} />
        <ReadinessPill r={post.readiness} />
      </header>

      <PostStudio
        postId={post.id}
        channel={post.channel}
        brand={brand.name}
        handle={brand.handle}
        caption={post.caption}
        hashtags={post.hashtags}
        media={cover}
        score={post.readiness.score}
        voice={brand.voice.length ? `Voice: ${brand.voice.join(", ")}.` : "No voice words yet."}
        avoid={brand.avoid}
        watch={regulatedWords(brand.directives)}
      />

      <section className="flex flex-wrap gap-3 rounded-xl border border-border bg-card/80 p-4">
        <DeskAction action="cascade" body={{ id: post.id }} label="Build channel set" message="Added channel drafts." />
        {post.status === "approved" ? (
          <>
            <DeskAction action="evergreen" body={{ id: post.id, months: 3 }} label="Copy in 3 months" message="Scheduled a later copy." />
            <DeskAction action="evergreen" body={{ id: post.id, months: 6 }} label="Copy in 6 months" message="Scheduled a later copy." />
          </>
        ) : null}
        <p className="w-full text-[11px] text-muted-foreground">The set is rewritten for each channel from this caption. A later copy keeps the signed-off wording. Neither one uses engagement, because this desk has none.</p>
      </section>

      <div className="grid gap-6 lg:grid-cols-5">
        <div className="space-y-6 lg:col-span-3">
          <section data-ai-id={post.id} className="rounded-xl border border-border bg-card/80 p-5">
            <dl className="grid grid-cols-2 gap-3 text-xs sm:grid-cols-4">
              <div>
                <dt className="text-muted-foreground">Pillar</dt>
                <dd className="font-semibold text-foreground">{PILLAR_LABEL[post.pillar]}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Length</dt>
                <dd className="tabular font-mono font-semibold text-foreground">{postLength(post)} chars</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Drafted by</dt>
                <dd className="font-semibold text-foreground">{post.createdBy === "helix_ai" ? "Helix AI" : "Team"}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Approved by</dt>
                <dd className="font-semibold text-foreground">{post.approvedBy ?? "—"}</dd>
              </div>
            </dl>
            {post.sourcePostId ? (
              <p className="mt-3 text-xs text-muted-foreground">
                Repurposed from <Link href={`/posts/${post.sourcePostId}`} className="font-semibold text-primary hover:underline">another post</Link>.
              </p>
            ) : null}
          </section>

          <MediaPanel
            postId={post.id}
            pillar={post.pillar}
            caption={post.caption}
            brandName={brand.name}
            asset={post.asset}
            media={post.media ?? []}
            library={assets.filter((item) => item.approved && item.url).map((item) => ({ id: item.id, name: item.name }))}
          />

          <section className="rounded-xl border border-border bg-card/80 p-5" aria-labelledby="review-heading">
            <h2 id="review-heading" className="mb-3 text-lg font-semibold text-foreground">
              Review
            </h2>
            {post.internalSignOff ? <p className="mb-3 text-xs text-amber-200">Internal sign-off by {post.internalSignOff.by}. The client finishes this approval.</p> : null}
            <ReviewActions postId={post.id} status={post.status} blocked={blockers.length ? blockers.map((b) => b.detail).join("; ") : null} />
          </section>
        </div>

        <div className="space-y-6 lg:col-span-2">
          <section className="rounded-xl border border-border bg-card/80 p-5" aria-labelledby="why-heading">
            <div className="flex items-baseline justify-between">
              <h2 id="why-heading" className="text-lg font-semibold text-foreground">
                Why this score?
              </h2>
              <span className="tabular font-mono text-2xl font-semibold text-foreground">{post.readiness.score}</span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">{post.readiness.summary}</p>
            <ul className="mt-4 space-y-3">
              {post.readiness.factors.map((f) => (
                <li key={f.label}>
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-foreground">{f.label}</span>
                    <span className="tabular font-mono text-muted-foreground">
                      {f.points}/{f.max}
                    </span>
                  </div>
                  <span className="mt-1 block h-1.5 rounded-full bg-muted">
                    <span className={cn("block h-1.5 rounded-full", f.points === 0 ? "bg-rose-400" : f.points < f.max ? "bg-amber-400" : "bg-primary")} style={{ width: `${(f.points / f.max) * 100}%` }} />
                  </span>
                  <p className="mt-1 text-[11px] text-muted-foreground">{f.detail}</p>
                </li>
              ))}
            </ul>
            <p className="mt-4 text-[11px] text-muted-foreground">These rules check form, not taste — whether the post is good is your call. Click the score on any row for the same checklist.</p>
          </section>

          <ScheduleHint postId={post.id} scheduledFor={post.scheduledFor} suggestionIso={suggestion.iso} reason={suggestion.reason} matches={sameSlot(post.scheduledFor, suggestion)} />
          <RepurposePanel postId={post.id} status={post.status} channel={post.channel} />
          <CommentsPanel postId={post.id} comments={post.comments ?? []} revisions={post.revisions ?? []} />

          <section className="rounded-xl border border-border bg-card/80 p-5" aria-labelledby="audit-heading">
            <h2 id="audit-heading" className="text-lg font-semibold text-foreground">
              Audit
            </h2>
            <ol className="mt-3 space-y-2 text-xs text-foreground">
              <li>
                {[
                  post.createdBy === "helix_ai" ? "Generated by Helix" : "Written by the team",
                  `Scored ${post.readiness.score}/100`,
                  ...(post.revisions ?? []).map((revision) => `${revision.summary} · ${revision.actor}`),
                  post.approvedBy ? `Approved by ${post.approvedBy}` : "Waiting for approval",
                ].join(" → ")}
              </li>
            </ol>
          </section>
          <section className="rounded-xl border border-border bg-card/80 p-5" aria-labelledby="notes-heading">
            <h2 id="notes-heading" className="text-lg font-semibold text-foreground">
              Notes
            </h2>
            {post.notes.length === 0 ? (
              <p className="mt-2 text-sm text-muted-foreground">No notes yet.</p>
            ) : (
              <ul className="mt-3 space-y-2">
                {post.notes.map((n, i) => (
                  <li key={i} className="rounded-md bg-background/60 px-3 py-2 text-xs text-foreground">
                    {n}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </>
  );
}
