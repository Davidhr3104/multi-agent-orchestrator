import { ChannelBadge, ReadinessPill } from "@/components/bits";
import { ReviewApprove } from "@/components/review-approve";
import { formatSlot } from "@/lib/format";
import { postsForReviewToken } from "@/lib/store";

export const dynamic = "force-dynamic";

export default async function ReviewLinkPage({ params }: PageProps<"/review/[token]">) {
  const { token } = await params;
  const desk = await postsForReviewToken(token);
  if (!desk) {
    return (
      <header>
        <h1 className="text-3xl font-semibold text-foreground">Review link</h1>
        <p className="mt-2 text-sm text-muted-foreground">This link is not active on this desk.</p>
      </header>
    );
  }
  return (
    <>
      <header>
        <h1 className="text-3xl font-semibold text-foreground">{desk.brand} review</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Posts at a score of 100 that are waiting for sign-off. Approving records a sign-off on this desk and publishes nothing. This is not a separate hosted portal.
        </p>
      </header>
      {desk.posts.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nothing at 100 is waiting.</p>
      ) : (
        <ul className="space-y-3">
          {desk.posts.map((post) => (
            <li key={post.id} className="rounded-xl border border-border bg-card/80 p-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-xs text-muted-foreground">{formatSlot(post.scheduledFor)}</span>
                <ChannelBadge channel={post.channel} />
                <ReadinessPill r={post.readiness} />
              </div>
              <p className="mt-2 text-sm text-foreground">{post.caption}</p>
              {(post.comments ?? []).length ? (
                <ul className="mt-2 space-y-1">
                  {post.comments?.map((comment) => (
                    <li key={comment.id} className="text-xs text-muted-foreground">
                      {comment.actor}: {comment.body}
                    </li>
                  ))}
                </ul>
              ) : null}
              <div className="mt-3">
                <ReviewApprove token={token} postId={post.id} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
