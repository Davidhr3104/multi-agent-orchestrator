"use client";

import { useState } from "react";
import { Wand2 } from "lucide-react";
import { notifyDesk, postJson } from "@/components/notify-desk";

/** Brings length, hashtags, CTA, banned words and the visual brief up to a score of 100. */
export function AutoFixButton({ postId, score, compact = false, prominent = false }: { postId: string; score: number; compact?: boolean; prominent?: boolean }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [diff, setDiff] = useState<{ before: string; after: string } | null>(null);
  if (score === 100) {
    if (compact) return null;
    return <p className="text-xs text-primary">This draft already scores 100. Auto-fix has nothing to change.</p>;
  }

  function wordDiff(before: string, after: string) {
    const later = new Set(after.toLowerCase().split(/\s+/));
    const earlier = new Set(before.toLowerCase().split(/\s+/));
    const removed = before.split(/(\s+)/).map((part, index) => {
      const token = part.trim().toLowerCase();
      const gone = token.length > 2 && !later.has(token);
      return gone ? (
        <del key={`r-${index}`} className="rounded bg-rose-500/30 text-rose-100">
          {part}
        </del>
      ) : (
        <span key={`r-${index}`}>{part}</span>
      );
    });
    const added = after.split(/(\s+)/).map((part, index) => {
      const token = part.trim().toLowerCase();
      const fresh = token.length > 2 && !earlier.has(token);
      return fresh ? (
        <ins key={`a-${index}`} className="rounded bg-emerald-500/30 text-emerald-100 no-underline">
          {part}
        </ins>
      ) : (
        <span key={`a-${index}`}>{part}</span>
      );
    });
    return { removed, added };
  }

  async function preview() {
    setBusy(true);
    setError(null);
    try {
      const data = await postJson<{ before: string; after: string }>(`/api/posts/${encodeURIComponent(postId)}/autofix`, { preview: true });
      if (data.before === data.after) {
        notifyDesk("Auto-fix has no wording change for this draft.", [postId]);
        return;
      }
      setDiff(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed");
    } finally {
      setBusy(false);
    }
  }

  async function apply() {
    setBusy(true);
    setError(null);
    try {
      const data = await postJson<{ post: { readiness: { score: number } } }>(`/api/posts/${encodeURIComponent(postId)}/autofix`, {});
      setDiff(null);
      notifyDesk(`Auto-fix set the readiness score to ${data.post.readiness.score}. If it was approved, it is back in review.`, [postId]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={compact ? "shrink-0" : "space-y-2"}>
      <button
        type="button"
        disabled={busy}
        onClick={() => void preview()}
        className={
          prominent
            ? "inline-flex min-h-9 cursor-pointer items-center gap-1.5 rounded-full border border-emerald-300/70 bg-gradient-to-r from-emerald-400/30 to-primary/30 px-3 text-xs font-semibold text-emerald-100 shadow-[0_0_18px_rgba(52,211,153,0.35)] hover:brightness-110 disabled:opacity-50"
            : compact
              ? "inline-flex min-h-8 cursor-pointer items-center gap-1.5 rounded-full border border-primary/40 bg-primary/10 px-3 text-xs font-semibold text-primary hover:bg-primary/20 disabled:opacity-50"
              : "inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-lg border border-primary/40 bg-primary/10 px-4 text-sm font-semibold text-primary hover:bg-primary/20 disabled:opacity-50"
        }
      >
        <Wand2 className={compact ? "size-3.5" : "size-4"} aria-hidden />
        {busy ? "Fixing…" : compact ? "Auto-fix with AI" : "Auto-fix to 100"}
      </button>
      {compact ? null : <p className="text-xs text-muted-foreground">Fixes form: length, hashtags, a call to action, banned words and a visual brief. It spends one AI credit. It does not decide if the post is good. Instagram and TikTok also need an attached image to reach 100; auto-fix does not add one.</p>}
      {diff ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 backdrop-blur-sm" role="presentation" onMouseDown={() => setDiff(null)}>
          <div role="dialog" aria-modal="true" aria-label="Auto-fix preview" className="w-full max-w-lg space-y-3 rounded-2xl border border-border bg-card p-5 shadow-2xl" onMouseDown={(event) => event.stopPropagation()}>
            <h3 className="text-lg font-semibold text-foreground">Before and after</h3>
            <p className="text-xs text-muted-foreground">Removed words are red. Added words are green. Nothing is saved until you apply it. One credit is spent on apply.</p>
            <p className="rounded-lg bg-background/60 p-3 text-sm leading-relaxed text-foreground">{wordDiff(diff.before, diff.after).removed}</p>
            <p className="rounded-lg bg-emerald-400/10 p-3 text-sm leading-relaxed text-foreground">{wordDiff(diff.before, diff.after).added}</p>
            <div className="flex gap-2">
              <button type="button" onClick={() => setDiff(null)} className="inline-flex min-h-10 cursor-pointer items-center rounded-lg border border-border px-4 text-sm font-semibold">
                Keep the original
              </button>
              <button type="button" disabled={busy} onClick={() => void apply()} className="inline-flex min-h-10 cursor-pointer items-center rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-50">
                {busy ? "Applying…" : "Apply auto-fix"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
      {error ? (
        <p role="alert" className="text-xs text-rose-400">
          {error}
        </p>
      ) : null}
    </div>
  );
}
