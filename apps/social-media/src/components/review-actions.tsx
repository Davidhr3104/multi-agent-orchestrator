"use client";

import { useState } from "react";
import { Check, Send, Undo2 } from "lucide-react";
import { OperatorText } from "@/components/operator-text";
import type { PostStatus } from "@/lib/types";

type Decision = "approve" | "changes" | "submit";

const TOAST: Record<Decision, string> = {
  approve: "Approved — recorded as your sign-off. Nothing was published.",
  changes: "Sent back with your note.",
  submit: "Moved into the approval queue.",
};

/** A person's review buttons. Approval is blocked server-side while the post fails a hard check. */
export function ReviewActions({ postId, status, blocked }: { postId: string; status: PostStatus; blocked: string | null }) {
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState<Decision | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function decide(decision: Decision) {
    setBusy(decision);
    setError(null);
    try {
      const res = await fetch(`/api/posts/${encodeURIComponent(postId)}/review`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ decision, note: note.trim() || undefined }),
      });
      const body = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) throw new Error(body?.error ?? `Request failed (${res.status})`);
      setNote("");
      window.dispatchEvent(new CustomEvent("helix:ai-action", { detail: { message: TOAST[decision], ids: [postId] } }));
      window.dispatchEvent(new CustomEvent("helix:desk-refresh"));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed");
    } finally {
      setBusy(null);
    }
  }

  const canApprove = status !== "approved" && status !== "published";
  const canSubmit = status === "draft" || status === "changes";
  const btn = "inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-lg px-4 text-sm font-semibold transition focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50";

  return (
    <div className="space-y-3">
      <label htmlFor="review-note" className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
        Note for the team
      </label>
      <textarea
        id="review-note"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        rows={2}
        maxLength={400}
        placeholder="Required to send back; optional otherwise."
        className="w-full rounded-lg border border-input bg-background/60 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
      />
      <div className="flex flex-wrap gap-2">
        {canApprove ? (
          <button type="button" disabled={!!busy || !!blocked} onClick={() => void decide("approve")} className={`${btn} bg-primary text-primary-foreground hover:brightness-110`}>
            <Check className="size-4" aria-hidden /> {busy === "approve" ? "Approving…" : "Approve"}
          </button>
        ) : null}
        <button type="button" disabled={!!busy || !note.trim()} onClick={() => void decide("changes")} className={`${btn} border border-border text-foreground hover:bg-accent`}>
          <Undo2 className="size-4" aria-hidden /> {busy === "changes" ? "Sending…" : "Request changes"}
        </button>
        {canSubmit ? (
          <button type="button" disabled={!!busy} onClick={() => void decide("submit")} className={`${btn} border border-border text-foreground hover:bg-accent`}>
            <Send className="size-4" aria-hidden /> {busy === "submit" ? "Moving…" : "Send to review"}
          </button>
        ) : null}
      </div>
      {blocked && canApprove ? <p className="text-xs text-amber-300">Approve is off until this is fixed: {blocked}</p> : null}
      {error ? (
        <p role="alert" className="text-xs text-rose-400">
          <OperatorText text={error} />
        </p>
      ) : null}
      <p className="text-xs text-muted-foreground">Approving records your sign-off on this desk; it does not post anything. Publishing is a separate button on each approved post.</p>
    </div>
  );
}
