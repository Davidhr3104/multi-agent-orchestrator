import Link from "next/link";
import { AutoFixButton } from "@/components/auto-fix-button";
import { ChannelBadge, ChannelChip } from "@/components/channel";
import { PostThumb } from "@/components/post-thumb";
import { formatSlot, PILLAR_LABEL, STATUS_LABEL } from "@/lib/format";
import type { ScoredPost } from "@/lib/store";
import type { PostStatus, Readiness } from "@/lib/types";
import { cn } from "@/lib/utils";

export { ChannelBadge };

const STATUS_STYLE: Record<PostStatus, string> = {
  draft: "bg-slate-400/10 text-slate-300 ring-slate-400/30",
  needs_review: "bg-amber-400/10 text-amber-300 ring-amber-400/30",
  changes: "bg-rose-400/10 text-rose-300 ring-rose-400/30",
  approved: "bg-emerald-400/10 text-emerald-300 ring-emerald-400/30",
  published: "bg-violet-400/10 text-violet-300 ring-violet-400/30",
};

/** Status is always spelled out, never colour alone. */
export function StatusBadge({ status }: { status: PostStatus }) {
  return <span className={cn("inline-flex whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1", STATUS_STYLE[status])}>{STATUS_LABEL[status]}</span>;
}

const SCORE_LABEL: Record<string, string> = {
  Length: "Max length for this network",
  Hashtags: "Relevant hashtags",
  "Call to action": "Call to action",
  "Brand voice": "Tone / brand safety",
  "Visual brief": "Visual brief",
};

export function ReadinessPill({ r }: { r: Readiness }) {
  return (
    <details className="relative shrink-0">
      <summary
        className={cn(
          "inline-flex cursor-pointer list-none items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 [&::-webkit-details-marker]:hidden",
          r.score === 100
            ? "bg-emerald-400/15 text-emerald-300 ring-emerald-400/40"
            : r.score < 70
              ? "bg-rose-400/15 text-rose-300 ring-rose-400/40"
              : "bg-amber-400/15 text-amber-200 ring-amber-400/40"
        )}
        title={r.summary}
      >
        {r.score === 100 && r.ready ? "Ready" : r.summary.startsWith("Blocked") ? "Blocked" : "Not ready"}
        <span className="tabular font-mono text-xs">{r.score}</span>
      </summary>
      <div className="absolute right-0 z-30 mt-2 w-72 max-w-[calc(100vw-3rem)] rounded-xl border border-border bg-card p-3 text-left shadow-xl">
        <p className="text-xs font-semibold text-foreground">Quality score {r.score}/100</p>
        <p className="mt-1 text-xs text-muted-foreground">{r.summary}</p>
        <ul className="mt-3 space-y-2">
          {r.factors.map((factor) => (
            <li key={factor.label}>
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-foreground">{SCORE_LABEL[factor.label] ?? factor.label}</span>
                <span className="tabular font-mono text-muted-foreground">
                  {factor.points}/{factor.max}
                </span>
              </div>
              <p className="text-xs text-muted-foreground">{factor.detail}</p>
            </li>
          ))}
        </ul>
      </div>
    </details>
  );
}

export function Kpi({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="rounded-xl border border-border bg-card/80 p-4 backdrop-blur">
      <p className="text-xs font-semibold tracking-[0.14em] text-muted-foreground uppercase">{label}</p>
      <p className="tabular mt-2 font-mono text-3xl font-semibold text-foreground">{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
    </div>
  );
}

/** Thin bar for a 0-100 readiness score. The number stays next to it so colour is never the only signal. */
export function MiniBar({ score }: { score: number }) {
  const tone = score === 100 ? "bg-emerald-400" : score < 70 ? "bg-rose-400" : "bg-amber-400";
  return (
    <span className="flex w-24 items-center gap-2" role="img" aria-label={`Readiness ${score} of 100`}>
      <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
        <span className={cn("block h-full rounded-full", tone)} style={{ width: `${score}%` }} />
      </span>
    </span>
  );
}

export function PostRow({ p, showPillar = false, quickFix = false, peekHref }: { p: ScoredPost; showPillar?: boolean; quickFix?: boolean; peekHref?: string }) {
  return (
    <div data-ai-id={p.id} className="flex flex-wrap items-center gap-x-4 gap-y-3 px-4 py-3 transition hover:bg-accent/50 sm:px-5">
      <Link href={`/posts/${p.id}`} className="flex min-w-0 flex-1 basis-72 items-center gap-4 rounded-md focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none">
        <span className="relative shrink-0">
          <PostThumb post={p} className="h-[4.5rem] w-24 sm:h-20 sm:w-28" />
          <ChannelChip channel={p.channel} className="absolute top-1 right-1 bg-background/85 backdrop-blur" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="tabular font-mono text-xs text-muted-foreground">{formatSlot(p.scheduledFor)}</span>
            <StatusBadge status={p.status} />
          </span>
          <span className="mt-1 line-clamp-2 block text-sm font-medium text-foreground">{p.caption}</span>
          {showPillar ? <span className="block text-xs text-muted-foreground">{PILLAR_LABEL[p.pillar]}</span> : null}
        </span>
      </Link>
      <div className="flex shrink-0 items-center gap-3">
        <div className="flex flex-col items-end gap-1.5">
          <ReadinessPill r={p.readiness} />
          <MiniBar score={p.readiness.score} />
        </div>
        {peekHref ? (
          <Link href={peekHref} className="inline-flex min-h-10 items-center rounded-lg px-2 text-xs font-semibold text-primary hover:underline">
            Preview
          </Link>
        ) : null}
        {quickFix ? <AutoFixButton postId={p.id} score={p.readiness.score} compact /> : null}
      </div>
    </div>
  );
}
