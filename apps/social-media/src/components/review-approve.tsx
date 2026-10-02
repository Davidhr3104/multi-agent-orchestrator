"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { notifyDesk, postJson } from "@/components/notify-desk";

export function ReviewApprove({ token, postId }: { token: string; postId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function approve() {
    setBusy(true);
    setError(null);
    try {
      await postJson("/api/review", { token, id: postId });
      notifyDesk("Approved from the review link. Nothing was published.");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed");
    } finally {
      setBusy(false);
    }
  }

  const [note, setNote] = useState("");

  async function comment() {
    const clean = note.trim();
    if (!clean) return;
    setBusy(true);
    setError(null);
    try {
      await postJson("/api/review", { token, id: postId, action: "comment", body: clean });
      setNote("");
      notifyDesk("Comment saved on this desk.");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <span className="flex w-full flex-col gap-2">
      <label className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase" htmlFor={`note-${postId}`}>
        Comment
        <input id={`note-${postId}`} value={note} onChange={(event) => setNote(event.target.value)} className="mt-1 w-full rounded-lg border border-input bg-background/60 px-3 py-2 text-sm font-normal normal-case tracking-normal text-foreground focus:border-primary focus:outline-none" />
      </label>
      <span className="flex flex-wrap gap-2">
        <button type="button" disabled={busy || !note.trim()} onClick={() => void comment()} className="inline-flex min-h-9 cursor-pointer items-center rounded-lg border border-border px-3 text-xs font-semibold text-foreground disabled:opacity-50">
          {busy ? "Saving…" : "Leave a comment"}
        </button>
        <button type="button" disabled={busy} onClick={() => void approve()} className="inline-flex min-h-9 cursor-pointer items-center rounded-lg bg-primary px-3 text-xs font-semibold text-primary-foreground disabled:opacity-50">
          {busy ? "Saving…" : "Approve"}
        </button>
      </span>
      {error ? <span className="text-[11px] text-rose-400">{error}</span> : null}
    </span>
  );
}
