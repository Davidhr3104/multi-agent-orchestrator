import Link from "next/link";
import { DeskRefresher } from "@/components/ask-ai-section";
import { ChannelBadge, ReadinessPill, StatusBadge } from "@/components/bits";
import { ReviewActions } from "@/components/review-actions";
import { formatSlot, snippet } from "@/lib/format";
import { hardBlockers } from "@/lib/readiness";
import { listPosts } from "@/lib/store";

export const dynamic = "force-dynamic";

export default async function ClientReviewPage() {
  const posts = (await listPosts()).filter((post) => post.status === "needs_review" || post.status === "approved");
  return (
    <>
      <DeskRefresher />
      <header>
        <h1 className="text-3xl font-semibold text-foreground">Client review</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          A read path on this desk for the current session. It is not a public or white-label host, and it does not publish. Sign-off still follows the workspace role: a client can finish the second step only when that approval path is on.
        </p>
      </header>
      <ul className="space-y-3">
        {posts.map((post) => (
          <li key={post.id} className="rounded-xl border border-border bg-card/80 p-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-xs text-muted-foreground">{formatSlot(post.scheduledFor)}</span>
              <ChannelBadge channel={post.channel} />
              <StatusBadge status={post.status} />
              <ReadinessPill r={post.readiness} />
              <Link href={`/posts/${post.id}`} className="text-xs font-semibold text-primary">
                Open
              </Link>
            </div>
            <p className="mt-2 text-sm text-foreground">{snippet(post.caption, 180)}</p>
            <div className="mt-3">
              <ReviewActions
                postId={post.id}
                status={post.status}
                blocked={(() => {
                  const blockers = hardBlockers(post.readiness.factors);
                  return blockers.length ? blockers.map((item) => item.detail).join("; ") : null;
                })()}
              />
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}
