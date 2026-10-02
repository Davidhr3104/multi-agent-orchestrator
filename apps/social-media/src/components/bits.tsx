import Link from "next/link";
import { AutoFixButton } from "@/components/auto-fix-button";
import { channelLabel, formatSlot, PILLAR_LABEL, snippet, STATUS_LABEL } from "@/lib/format";
import type { ScoredPost } from "@/lib/store";
import type { Channel, PostStatus, Readiness } from "@/lib/types";
import { cn } from "@/lib/utils";

function ChannelMark({ channel }: { channel: Channel }) {
  const common = { viewBox: "0 0 24 24", className: "size-3.5", "aria-hidden": true, fill: "currentColor" } as const;
  if (channel === "instagram") {
    return (
      <svg {...common}>
        <rect x="4" y="4" width="16" height="16" rx="4" fill="none" stroke="currentColor" strokeWidth="2" />
        <circle cx="12" cy="12" r="3.5" fill="none" stroke="currentColor" strokeWidth="2" />
        <circle cx="17.2" cy="6.8" r="1" />
      </svg>
    );
  }
  if (channel === "x") {
    return (
      <svg {...common}>
        <path d="M5 5l14 14M19 5L5 19" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
      </svg>
    );
  }
  if (channel === "linkedin") {
    return (
      <svg {...common}>
        <rect x="4" y="4" width="16" height="16" rx="2" fill="none" stroke="currentColor" strokeWidth="2" />
        <path d="M8 10.5V16M8 8h.01M12 16v-3.2a2 2 0 114 0V16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    );
  }
  if (channel === "tiktok") {
    return (
      <svg {...common}>
        <path d="M14 6c.6 2.2 2.2 3.6 4.4 4v2.2A6.6 6.6 0 0114 11v5.2a4.2 4.2 0 11-4.2-4.2c.3 0 .6 0 .9.1v2.3a2 2 0 100 2.6V6H14z" />
      </svg>
    );
  }
  return (
    <svg {...common}>
      <path d="M14.5 8.5H12V6h4v8.2c0 1.5-1.2 2.8-2.8 2.8S10.4 15.7 10.4 14.2 11.6 11.4 13.2 11.4c.4 0 .7 0 1 .1V9.2A5.2 5.2 0 008 14.2C8 17 10.2 19 13.2 19s5.2-2 5.2-4.8V8.5z" />
    </svg>
  );
}

const CHANNEL_STYLE: Record<Channel, string> = {
  instagram: "bg-pink-400/10 text-pink-300 ring-pink-400/30",
  linkedin: "bg-sky-400/10 text-sky-300 ring-sky-400/30",
  x: "bg-slate-300/10 text-slate-200 ring-slate-300/30",
  tiktok: "bg-teal-400/10 text-teal-300 ring-teal-400/30",
  facebook: "bg-blue-400/10 text-blue-300 ring-blue-400/30",
};

export function ChannelBadge({ channel }: { channel: Channel }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1", CHANNEL_STYLE[channel])}>
      <ChannelMark channel={channel} />
      {channelLabel(channel)}
    </span>
  );
}

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
        {r.score === 100 ? "Ready" : r.summary.startsWith("Blocked") ? "Blocked" : "Not ready"}
        <span className="tabular font-mono text-[11px]">{r.score}</span>
      </summary>
      <div className="absolute right-0 z-30 mt-2 w-80 rounded-xl border border-border bg-card p-3 text-left shadow-xl">
        <p className="text-xs font-semibold text-foreground">Quality score {r.score}/100</p>
        <p className="mt-1 text-[11px] text-muted-foreground">{r.summary}</p>
        <ul className="mt-3 space-y-2">
          {r.factors.map((factor) => (
            <li key={factor.label}>
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-foreground">{SCORE_LABEL[factor.label] ?? factor.label}</span>
                <span className="tabular font-mono text-muted-foreground">
                  {factor.points}/{factor.max}
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground">{factor.detail}</p>
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
      <p className="text-[11px] font-semibold tracking-[0.14em] text-muted-foreground uppercase">{label}</p>
      <p className="tabular mt-2 font-mono text-3xl font-semibold text-foreground">{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
    </div>
  );
}

export function PostRow({ p, showPillar = false, quickFix = false, peekHref }: { p: ScoredPost; showPillar?: boolean; quickFix?: boolean; peekHref?: string }) {
  return (
    <div data-ai-id={p.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3.5 transition hover:bg-accent/50">
      <Link href={`/posts/${p.id}`} className="flex min-w-0 flex-1 flex-wrap items-center gap-x-4 gap-y-1.5 rounded-md focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none">
        <span className="tabular w-36 shrink-0 font-mono text-xs text-muted-foreground">{formatSlot(p.scheduledFor)}</span>
        <ChannelBadge channel={p.channel} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium text-foreground">{snippet(p.caption, 90)}</span>
          {showPillar ? <span className="block text-xs text-muted-foreground">{PILLAR_LABEL[p.pillar]}</span> : null}
        </span>
        <StatusBadge status={p.status} />
      </Link>
      {peekHref ? (
        <Link href={peekHref} className="text-xs font-semibold text-primary hover:underline">
          Preview
        </Link>
      ) : null}
      {quickFix ? <AutoFixButton postId={p.id} score={p.readiness.score} compact /> : null}
      <ReadinessPill r={p.readiness} />
    </div>
  );
}
