"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { AutoFixButton } from "@/components/auto-fix-button";
import { BulkApprove } from "@/components/bulk-approve";
import { ChannelBadge } from "@/components/bits";
import { channelLabel, formatSlot, PILLAR_LABEL, snippet } from "@/lib/format";
import type { ScoredPost } from "@/lib/store";
import type { Channel } from "@/lib/types";
import { cn } from "@/lib/utils";

type Filter = "all" | "ready" | "attention" | Channel;

const TABS: { id: Filter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "ready", label: "Ready 100" },
  { id: "attention", label: "Needs attention" },
  { id: "instagram", label: "Instagram" },
  { id: "linkedin", label: "LinkedIn" },
  { id: "x", label: "X" },
];

export function ApprovalQueue({ posts }: { posts: ScoredPost[] }) {
  const [filter, setFilter] = useState<Filter>("all");
  const perfect = posts.filter((post) => post.readiness.score === 100).length;
  const shown = useMemo(() => {
    const rows = posts.filter((post) => {
      if (filter === "ready") return post.readiness.score === 100;
      if (filter === "attention") return post.readiness.score < 100;
      if (filter === "all") return true;
      return post.channel === filter;
    });
    return rows.slice(0, 7);
  }, [posts, filter]);

  return (
    <section data-tour="social-queue" className="rounded-xl border border-border bg-card/80 lg:col-span-3" aria-labelledby="queue-heading">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border px-5 py-4">
        <div>
          <h2 id="queue-heading" className="text-lg font-semibold text-foreground">
            Approval queue
          </h2>
          <p className="text-xs text-muted-foreground">Soonest first. Auto-fix repairs form on a blocked draft. A person still approves it.</p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <BulkApprove
            count={perfect}
            items={posts.filter((post) => post.readiness.score === 100).map((post) => ({ id: post.id, caption: post.caption }))}
          />
          <Link href="/posts?status=needs_review" className="text-xs font-semibold text-primary hover:underline">
            All in review
          </Link>
        </div>
      </div>
      <div className="flex gap-1.5 overflow-x-auto px-5 py-3" role="tablist" aria-label="Queue filters">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={filter === tab.id}
            onClick={() => setFilter(tab.id)}
            className={cn(
              "shrink-0 rounded-full border px-3 py-1 text-xs font-semibold",
              filter === tab.id ? "border-primary/50 bg-primary/15 text-primary" : "border-border text-muted-foreground hover:text-foreground"
            )}
          >
            {tab.id === "instagram" || tab.id === "linkedin" || tab.id === "x" ? channelLabel(tab.id) : tab.label}
          </button>
        ))}
      </div>
      {shown.length === 0 ? (
        <p className="px-5 py-8 text-center text-sm text-muted-foreground">Nothing in review matches this filter.</p>
      ) : (
        <ul className="divide-y divide-border">
          {shown.map((post) => (
            <li key={post.id} className="flex flex-wrap items-center gap-3 px-4 py-2.5">
              <Link href={`/posts/${post.id}`} className="flex min-w-0 flex-1 items-center gap-3">
                <ChannelBadge channel={post.channel} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm text-foreground">{snippet(post.caption, 72)}</span>
                  <span className="text-xs text-muted-foreground">{formatSlot(post.scheduledFor)} · {PILLAR_LABEL[post.pillar]}</span>
                </span>
              </Link>
              <span className="tabular font-mono text-xs text-muted-foreground" aria-label={`Quality score ${post.readiness.score}`}>
                {post.readiness.score}
              </span>
              <AutoFixButton postId={post.id} score={post.readiness.score} compact prominent={post.readiness.score < 100} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
