"use client";

import type { InboxMessage } from "@/lib/types";
import { categoryLabel } from "@/lib/types";
import { confidenceBand } from "@/lib/desk-ui";
import { cn } from "@/lib/utils";

const BAND = {
  high: "text-emerald-700 dark:text-emerald-300",
  mid: "text-amber-700 dark:text-amber-300",
  low: "text-red-600 dark:text-red-300",
} as const;

function initials(name: string) {
  return name
    .split(/\s+/)
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export function QueueTable({
  threads,
  selectedId,
  onSelect,
  checkedIds,
  onToggle,
}: {
  threads: InboxMessage[];
  selectedId: string | null;
  onSelect: (thread: InboxMessage) => void;
  checkedIds?: Set<string>;
  onToggle?: (id: string) => void;
}) {
  if (threads.length === 0) return null;

  return (
    <div className="glass-panel overflow-hidden rounded-xl">
      <div className="divide-y divide-border">
        {threads.map((thread) => {
          const on = thread.id === selectedId;
          return (
            <div
              key={thread.id}
              role="button"
              tabIndex={0}
              onClick={() => onSelect(thread)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onSelect(thread);
                }
              }}
              className={cn(
                "flex w-full min-w-0 items-center gap-3 px-3 py-3.5 text-left transition-colors sm:px-4",
                on ? "bg-[#8B5CF6]/12" : "hover:bg-surface-muted"
              )}
            >
              {onToggle ? (
                <input
                  type="checkbox"
                  className="size-5 shrink-0 accent-violet-500"
                  checked={checkedIds?.has(thread.id) ?? false}
                  aria-label={`Select ${thread.subject}`}
                  onClick={(e) => e.stopPropagation()}
                  onChange={() => onToggle(thread.id)}
                />
              ) : null}
              <div className="flex size-8 shrink-0 items-center justify-center rounded-full border border-[#8B5CF6]/30 bg-[#8B5CF6]/15 text-[10px] font-semibold text-accent dark:text-[#C4B5FD]">
                {initials(thread.fromName)}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <div className="truncate text-sm font-medium text-foreground">{thread.subject}</div>
                  {thread.status === "blocked" || thread.category === "spam" ? (
                    <span className="shrink-0 rounded-full bg-red-500/15 px-1.5 py-0.5 text-[9px] font-semibold text-red-600">BLOCKED</span>
                  ) : thread.priority === "urgent" ? (
                    <span className="shrink-0 rounded-full bg-red-500/15 px-1.5 py-0.5 text-[9px] font-semibold text-red-600">URGENT</span>
                  ) : thread.needsReview ? (
                    <span className="shrink-0 rounded-full bg-amber-500/15 px-1.5 py-0.5 text-[9px] font-semibold text-amber-700">REVIEW</span>
                  ) : thread.status === "sent" || thread.status === "routed" ? (
                    <span className="shrink-0 rounded-full bg-emerald-500/15 px-1.5 py-0.5 text-[9px] font-semibold text-emerald-700">RESOLVED</span>
                  ) : null}
                </div>
                <div className="truncate text-xs text-muted-foreground">
                  {thread.fromName} · {categoryLabel(thread.category)} · conf{" "}
                  <span className={cn("font-mono", BAND[confidenceBand(thread.aiConfidence)])}>
                    {Math.round(thread.aiConfidence)}%
                  </span>
                </div>
                <div className="mt-1.5 h-1 max-w-48 overflow-hidden rounded-full bg-foreground/10" role="img" aria-label={`AI confidence ${Math.round(thread.aiConfidence)} percent`}>
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${Math.max(3, Math.min(100, thread.aiConfidence))}%`,
                      background: thread.aiConfidence >= 85 ? "#34d399" : thread.aiConfidence >= 70 ? "#8b5cf6" : "#fbbf24",
                    }}
                  />
                </div>
              </div>
              <div className="shrink-0 text-right">
                <div className="font-mono text-[11px] text-amber-600 dark:text-[#FBBF24]">{thread.urgencyScore}</div>
                <div className="text-[10px] text-muted-foreground">urgency</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
