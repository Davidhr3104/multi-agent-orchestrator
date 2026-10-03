import { channelLabel } from "@/lib/format";
import { CHANNEL_COLOR } from "@/lib/visuals";
import type { Channel } from "@/lib/types";
import { cn } from "@/lib/utils";

export function ChannelMark({ channel, className = "size-3.5" }: { channel: Channel; className?: string }) {
  const common = { viewBox: "0 0 24 24", className, "aria-hidden": true, fill: "currentColor" } as const;
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
      <path d="M13.5 20v-7h2.3l.4-2.8h-2.7V8.4c0-.8.3-1.4 1.4-1.4h1.4V4.5c-.3 0-1.1-.1-2.1-.1-2.1 0-3.5 1.3-3.5 3.6v2.2H8.4V13h2.3v7z" />
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

/** Network name with its mark, coloured per network. */
export function ChannelBadge({ channel }: { channel: Channel }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1", CHANNEL_STYLE[channel])}>
      <ChannelMark channel={channel} />
      {channelLabel(channel)}
    </span>
  );
}

/**
 * Compact network chip: a coloured square with the network mark. The name stays available to screen readers
 * and as a tooltip; pass `label` to print it next to the mark.
 */
export function ChannelChip({ channel, label = false, className }: { channel: Channel; label?: boolean; className?: string }) {
  return (
    <span
      title={channelLabel(channel)}
      className={cn("inline-flex shrink-0 items-center gap-1 rounded-md px-1 py-0.5 text-xs font-semibold", className)}
      style={{ color: CHANNEL_COLOR[channel], background: `color-mix(in srgb, ${CHANNEL_COLOR[channel]} 16%, transparent)` }}
    >
      <ChannelMark channel={channel} className="size-4" />
      {label ? <span>{channelLabel(channel)}</span> : <span className="sr-only">{channelLabel(channel)}</span>}
    </span>
  );
}
