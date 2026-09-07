"use client";

import type { InboxMessage } from "@/lib/types";
import { categoryLabel } from "@/lib/types";
import { cn } from "@/lib/utils";

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
}: {
  threads: InboxMessage[];
  selectedId: string | null;
  onSelect: (thread: InboxMessage) => void;
}) {
  if (threads.length === 0) return null;

  return (
    <div className="glass-panel overflow-hidden rounded-xl">
      <div className="divide-y divide-border">
        {threads.map((thread) => {
          const on = thread.id === selectedId;
          return (
            <button
              key={thread.id}
              type="button"
              onClick={() => onSelect(thread)}
              className={cn(
                "flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors",
                on ? "bg-[#8B5CF6]/12" : "hover:bg-surface-muted"
              )}
            >
              <div className="flex size-8 shrink-0 items-center justify-center rounded-full border border-[#8B5CF6]/30 bg-[#8B5CF6]/15 text-[10px] font-semibold text-accent dark:text-[#C4B5FD]">
                {initials(thread.fromName)}
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium text-foreground">{thread.subject}</div>
                <div className="truncate text-xs text-muted-foreground">
                  {thread.fromName} · {categoryLabel(thread.category)} · conf{" "}
                  <span className="font-mono text-accent">{Math.round(thread.aiConfidence)}%</span>
                </div>
              </div>
              <div className="shrink-0 text-right">
                <div className="font-mono text-[11px] text-amber-600 dark:text-[#FBBF24]">{thread.urgencyScore}</div>
                <div className="text-[10px] text-muted-foreground">urgency</div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
