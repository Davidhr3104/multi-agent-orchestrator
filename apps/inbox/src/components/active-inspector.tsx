"use client";

import { useEffect, useState } from "react";
import type { InboxMessage } from "@/lib/types";
import { categoryLabel } from "@/lib/types";
import { confidenceBand } from "@/lib/desk-ui";
import { toneHint } from "@/lib/tone";
import { readKnowledgeLinks } from "@/lib/knowledge-links";
import type { InboxPersona } from "@/lib/agent-profile";
import { SlaCountdown } from "@/components/sla-countdown";
import { DraftDiff } from "@/components/draft-diff";
import { ErrorText } from "@/components/operator-notice";
import { cn } from "@/lib/utils";

const BAND = {
  high: "border-emerald-500/40 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  mid: "border-amber-500/40 bg-amber-500/15 text-amber-700 dark:text-amber-300",
  low: "border-red-500/40 bg-red-500/15 text-red-600 dark:text-red-300",
} as const;

export function ActiveInspector({
  thread,
  onUpdate,
}: {
  thread: InboxMessage;
  onUpdate: () => void;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [whyOpen, setWhyOpen] = useState(true);
  const [persona, setPersona] = useState<InboxPersona>("executive");
  const band = confidenceBand(thread.aiConfidence);

  useEffect(() => {
    void fetch("/api/studio")
      .then((r) => r.json())
      .then((d: { profile?: { persona?: InboxPersona } }) => {
        if (d.profile?.persona) setPersona(d.profile.persona);
      })
      .catch(() => undefined);
  }, []);

  async function act(action: string, extra?: Record<string, string | string[]>) {
    setBusy(action);
    setError(null);
    try {
      await fetch(`/api/messages/${thread.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...extra }),
      }).then(async (res) => {
        if (!res.ok) {
          const data = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(data.error || `HTTP ${res.status}`);
        }
      });
      onUpdate();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(null);
    }
  }

  async function draftFollowup() {
    // M4: this button reuses the same smart_reply codepath as "Regen reply"
    // — it drafts, it does not send. regenerateSmartReply(id) takes no
    // tone/intent parameter today, so there is no "followup" mode to pass
    // through; adding one would be a bigger change than this label fix
    // warrants. The operator still reviews/edits before hitting "Send reply".
    await act("smart_reply");
  }

  return (
    <section className="glass-panel relative overflow-hidden rounded-xl border-[#8B5CF6]/35 p-5 shadow-lg dark:shadow-[0_8px_30px_rgba(0,0,0,0.6)]">
      <div className="pointer-events-none absolute -top-12 -right-12 size-32 rounded-full bg-[#8B5CF6]/15 blur-2xl" />
      <div className="mb-3 flex items-center justify-between border-b border-border pb-3">
        <div className="flex items-center gap-2">
          <span className="size-2 animate-pulse rounded-full bg-[#10B981] shadow-[0_0_6px_#10B981]" />
          <h3 className="text-sm font-semibold text-foreground">Active inspector</h3>
        </div>
        <div className={cn("flex items-center gap-1.5 rounded-full border px-2.5 py-1", BAND[band])}>
          <span className="font-mono text-[10px] font-semibold tracking-wider uppercase">Conf</span>
          <span className="font-mono text-xs font-bold">{Math.round(thread.aiConfidence)}%</span>
        </div>
      </div>
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <h4 className="text-sm leading-snug font-semibold text-foreground">{thread.subject}</h4>
        <SlaCountdown thread={thread} />
        {persona === "sales" || thread.leadIntent ? (
          <span className="rounded-full border border-amber-500/40 bg-amber-500/15 px-2 py-0.5 font-mono text-[10px] font-semibold text-amber-700 dark:text-amber-300">
            Match {thread.urgencyScore}
          </span>
        ) : null}
      </div>
      <div className="mb-3 text-xs text-muted-foreground">
        <span className="text-accent dark:text-purple-200">{thread.fromName}</span>
        <span className="text-muted-foreground"> &lt;{thread.fromEmail}&gt;</span>
      </div>
      <details className="mb-3">
        <summary className="cursor-pointer text-[11px] text-muted-foreground">Category, route, and signals</summary>
      <div className="mt-2 flex flex-wrap gap-1.5">
        <span className="rounded-full border border-[#10B981]/30 bg-[#10B981]/15 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-700 dark:text-[#34D399]">
          {categoryLabel(thread.category)}
        </span>
        <span className="rounded-full border border-[#8B5CF6]/30 bg-[#8B5CF6]/15 px-2.5 py-0.5 text-[11px] font-semibold text-accent dark:text-[#DDD6FE]">
          {thread.sentiment}
        </span>
        {thread.leadIntent ? (
          <span className="rounded-full border border-amber-500/30 bg-amber-500/15 px-2.5 py-0.5 text-[11px] font-semibold text-amber-600 dark:text-amber-300">
            Buyer intent
          </span>
        ) : null}
      </div>
      <div className="mb-2 flex items-center gap-1.5 text-xs text-foreground/80">
        <span className="text-muted-foreground">Route target:</span>
        <span className="rounded border border-[#8B5CF6]/30 bg-[#8B5CF6]/15 px-2 py-0.5 font-medium text-accent dark:text-[#C4B5FD]">
          {thread.routeTo}
        </span>
      </div>
      </details>
      <div className="mb-3 rounded-lg border border-[#8B5CF6]/20 bg-surface-muted">
        <button
          type="button"
          className="flex w-full items-center justify-between px-3 py-2 text-left text-[11px] font-semibold text-foreground"
          onClick={() => setWhyOpen((v) => !v)}
        >
          Why Helix classified this as {categoryLabel(thread.category)}
          <span className="text-muted-foreground">{whyOpen ? "Hide" : "Show"}</span>
        </button>
        {whyOpen ? (
          <div className="px-3 pb-3">
            <p className="mb-1 text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">
              {thread.engine === "claude" ? "Engine: Claude" : "Engine: keyword rules (no AI)"}
            </p>
            <p className="text-xs text-foreground/80 italic">{thread.reasoning || "No written reason was stored for this message."}</p>
          </div>
        ) : null}
      </div>
      {thread.kbHits?.length ? (
        <ul className="mb-3 space-y-1 text-[11px] text-muted-foreground">
          {thread.kbHits.slice(0, 3).map((hit) => (
            <li key={hit.chunkId}>
              Source: {hit.docTitle} — {hit.quote || hit.excerpt}
            </li>
          ))}
        </ul>
      ) : null}
      <DraftDiff
        incoming={thread.snippet || thread.body}
        draft={thread.draftReply}
        tone={toneHint({
          category: thread.category,
          sentiment: thread.sentiment,
          leadIntent: thread.leadIntent,
          persona,
          draftTone: thread.draftTone,
        })}
      />
      {error ? (
        <p className="mb-3 rounded-lg border border-[#EF4444]/30 bg-[#EF4444]/10 p-2 text-[11px] text-red-600 dark:text-[#FCA5A5]">
          <ErrorText message={error} />
        </p>
      ) : null}
      {thread.handedOffAt ? (
        <p className="mb-3 text-[11px] text-emerald-600 dark:text-[#34D399]">
          Sent to Helix for Leads {new Date(thread.handedOffAt).toLocaleString("en-US")}.
        </p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busy != null}
          className="btn-tactile h-8 rounded-md bg-gradient-to-r from-[#4E5FF7] to-[#8B5CF6] px-3 text-[11px] font-semibold text-white disabled:opacity-50"
          onClick={() => void act("approve")}
        >
          {busy === "approve" ? "…" : "Send reply"}
        </button>
        {thread.status === "sent" ? (
          <button
            type="button"
            disabled={busy != null}
            className="btn-tactile h-8 rounded-md border border-amber-500/40 px-3 text-[11px] text-amber-600 dark:text-amber-300 disabled:opacity-50"
            onClick={() => void draftFollowup()}
          >
            {busy === "smart_reply" ? "…" : "Draft followup"}
          </button>
        ) : null}
        {thread.leadIntent && !thread.handedOffAt ? (
          <button
            type="button"
            disabled={busy != null}
            className="btn-tactile h-8 rounded-md border border-amber-500/40 px-3 text-[11px] text-amber-600 dark:text-amber-300 disabled:opacity-50"
            onClick={() => void act("handoff_leads")}
          >
            {busy === "handoff_leads" ? "…" : "Send to Leads"}
          </button>
        ) : null}
        <button
          type="button"
          disabled={busy != null}
          className="btn-tactile h-8 rounded-md border border-border px-3 text-[11px] text-foreground disabled:opacity-50"
          onClick={() => void act("route")}
        >
          {busy === "route" ? "…" : "Mark routed"}
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
        <button
          type="button"
          disabled={busy != null}
          className="btn-tactile h-8 rounded-md border border-border px-3 text-[11px] text-muted-foreground disabled:opacity-50"
          onClick={() => void act("feedback")}
        >
          {busy === "feedback" ? "…" : "Wrong classification"}
        </button>
        <button type="button" disabled={busy != null} className="btn-tactile h-8 rounded-md border border-border px-3 text-[11px] disabled:opacity-50" onClick={() => void act("meeting")}>
          {busy === "meeting" ? "…" : "Add Meet link"}
        </button>
        <button
          type="button"
          disabled={busy != null}
          className="btn-tactile h-8 rounded-md border border-border px-3 text-[11px] disabled:opacity-50"
          onClick={() => void act("meeting", { provider: "zoom" })}
        >
          {busy === "meeting" ? "…" : "Add Zoom link"}
        </button>
        <button type="button" disabled={busy != null} className="btn-tactile h-8 rounded-md border border-border px-3 text-[11px] disabled:opacity-50" onClick={() => void act("attach_kb", { links: readKnowledgeLinks() })}>
          {busy === "attach_kb" ? "…" : "Attach company file"}
        </button>
        <button
          type="button"
          disabled={busy != null}
          className="btn-tactile h-8 rounded-md border border-border px-3 text-[11px] disabled:opacity-50"
          onClick={() => {
            let token = "";
            try {
              token = (JSON.parse(localStorage.getItem("helix-inbox-integration-tokens") ?? "{}") as { hubspot?: string }).hubspot ?? "";
            } catch {
              token = "";
            }
            void act("crm", { token });
          }}
        >
          {busy === "crm" ? "…" : "Create HubSpot deal"}
        </button>
        <button type="button" disabled={busy != null} className="btn-tactile h-8 rounded-md border border-accent/40 px-3 text-[11px] text-accent disabled:opacity-50" onClick={() => void act("save_style")}>
          {busy === "save_style" ? "…" : "Save my style"}
        </button>
      </div>
    </section>
  );
}
