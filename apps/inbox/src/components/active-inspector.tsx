"use client";

import { useState } from "react";
import type { InboxMessage } from "@/lib/types";
import { categoryLabel } from "@/lib/types";

export function ActiveInspector({
  thread,
  onUpdate,
}: {
  thread: InboxMessage;
  onUpdate: () => void;
}) {
  const [busy, setBusy] = useState<string | null>(null);

  async function act(action: string) {
    setBusy(action);
    try {
      await fetch(`/api/messages/${thread.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      onUpdate();
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="glass-panel relative overflow-hidden rounded-xl border-[#8B5CF6]/35 p-5 shadow-lg dark:shadow-[0_8px_30px_rgba(0,0,0,0.6)]">
      <div className="pointer-events-none absolute -top-12 -right-12 size-32 rounded-full bg-[#8B5CF6]/15 blur-2xl" />
      <div className="mb-3 flex items-center justify-between border-b border-border pb-3">
        <div className="flex items-center gap-2">
          <span className="size-2 animate-pulse rounded-full bg-[#10B981] shadow-[0_0_6px_#10B981]" />
          <h3 className="text-sm font-semibold text-foreground">Active inspector</h3>
        </div>
        <div className="flex items-center gap-1.5 rounded-full border border-[#10B981]/40 bg-gradient-to-r from-[#10B981]/20 to-[#059669]/20 px-2.5 py-1 text-emerald-700 dark:text-[#34D399]">
          <span className="font-mono text-[10px] font-semibold tracking-wider uppercase">Conf</span>
          <span className="font-mono text-xs font-bold">{Math.round(thread.aiConfidence)}%</span>
        </div>
      </div>
      <h4 className="mb-1 text-sm leading-snug font-semibold text-foreground">{thread.subject}</h4>
      <div className="mb-3 text-xs text-muted-foreground">
        <span className="text-accent dark:text-purple-200">{thread.fromName}</span>
        <span className="text-muted-foreground"> &lt;{thread.fromEmail}&gt;</span>
      </div>
      <div className="mb-3 flex flex-wrap gap-1.5">
        <span className="rounded-full border border-[#10B981]/30 bg-[#10B981]/15 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-700 dark:text-[#34D399]">
          {categoryLabel(thread.category)}
        </span>
        <span className="rounded-full border border-[#8B5CF6]/30 bg-[#8B5CF6]/15 px-2.5 py-0.5 text-[11px] font-semibold text-accent dark:text-[#DDD6FE]">
          {thread.sentiment}
        </span>
      </div>
      <div className="mb-2 flex items-center gap-1.5 text-xs text-foreground/80">
        <span className="text-muted-foreground">Route target:</span>
        <span className="rounded border border-[#8B5CF6]/30 bg-[#8B5CF6]/15 px-2 py-0.5 font-medium text-accent dark:text-[#C4B5FD]">
          {thread.routeTo}
        </span>
      </div>
      {thread.reasoning ? (
        <div className="mb-3 rounded-lg border border-[#8B5CF6]/20 bg-gradient-to-r from-surface-muted to-accent/5 dark:from-[#080412]/80 dark:to-[#140D26]/80 p-3 text-xs text-foreground/80 italic">
          &ldquo;{thread.reasoning}&rdquo;
        </div>
      ) : null}
      {thread.draftReply ? (
        <p className="mb-3 rounded-lg border border-border bg-surface-muted p-3 text-[11px] leading-relaxed text-muted-foreground">
          {thread.draftReply}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busy != null}
          className="btn-tactile h-8 rounded-md bg-gradient-to-r from-[#4E5FF7] to-[#8B5CF6] px-3 text-[11px] font-semibold text-white disabled:opacity-50"
          onClick={() => void act("approve")}
        >
          {busy === "approve" ? "…" : "Approve draft"}
        </button>
        <button
          type="button"
          disabled={busy != null}
          className="btn-tactile h-8 rounded-md border border-border px-3 text-[11px] text-foreground disabled:opacity-50"
          onClick={() => void act("route")}
        >
          {busy === "route" ? "…" : "Route"}
        </button>
        <button
          type="button"
          disabled={busy != null}
          className="btn-tactile h-8 rounded-md border border-[#8B5CF6]/40 px-3 text-[11px] text-accent dark:text-[#C4B5FD] disabled:opacity-50"
          onClick={() => void act("smart_reply")}
        >
          {busy === "smart_reply" ? "…" : "Regen reply"}
        </button>
        <button
          type="button"
          disabled={busy != null}
          className="btn-tactile h-8 rounded-md border border-[#EF4444]/30 px-3 text-[11px] text-red-600 dark:text-[#FCA5A5] disabled:opacity-50"
          onClick={() => void act("block")}
        >
          {busy === "block" ? "…" : "Block"}
        </button>
      </div>
    </section>
  );
}
