"use client";

import { useState } from "react";
import { notifyDesk, postJson } from "@/components/notify-desk";
import type { DeskRole } from "@/lib/types";
import type { Comment, Revision } from "@/lib/types";

const ROLES: { id: DeskRole; label: string }[] = [
  { id: "creator", label: "Creator" },
  { id: "client", label: "Client" },
  { id: "admin", label: "Admin" },
];

export function CommentsPanel({ postId, comments, revisions }: { postId: string; comments: Comment[]; revisions: Revision[] }) {
  const [role, setRole] = useState<DeskRole>("creator");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send() {
    setBusy(true);
    setError(null);
    try {
      await postJson(`/api/posts/${encodeURIComponent(postId)}/comments`, { role, body });
      setBody("");
      notifyDesk("Comment added.", [postId]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-xl border border-border bg-card/80 p-5" aria-labelledby="comments-heading">
      <h2 id="comments-heading" className="text-lg font-semibold text-foreground">
        Comments
      </h2>
      <p className="mt-1 text-xs text-muted-foreground">Feedback between creators, clients and admins stays on this draft.</p>
      {comments.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">No comments yet.</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {comments.map((comment) => (
            <li key={comment.id} className="rounded-md bg-background/60 px-3 py-2">
              <p className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
                {ROLES.find((item) => item.id === comment.role)?.label} · {comment.actor} · {new Date(comment.at).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
              </p>
              <p className="mt-1 text-sm text-foreground">{comment.body}</p>
            </li>
          ))}
        </ul>
      )}
      <label htmlFor="comment-body" className="mt-4 block text-xs font-semibold tracking-wider text-muted-foreground uppercase">
        Add a comment
      </label>
      <div className="mt-2 flex flex-wrap gap-2" aria-label="Comment as">
        {ROLES.map((item) => (
          <button
            key={item.id}
            type="button"
            aria-pressed={role === item.id}
            onClick={() => setRole(item.id)}
            className={`inline-flex min-h-8 cursor-pointer items-center rounded-full border px-3 text-xs font-semibold ${role === item.id ? "border-primary/50 bg-primary/15 text-primary" : "border-border text-muted-foreground"}`}
          >
            {item.label}
          </button>
        ))}
      </div>
      <textarea
        id="comment-body"
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={2}
        maxLength={400}
        className="mt-2 w-full rounded-lg border border-input bg-background/60 px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none"
      />
      <button
        type="button"
        disabled={busy || !body.trim()}
        onClick={() => void send()}
        className="mt-2 inline-flex min-h-9 cursor-pointer items-center rounded-lg border border-border px-3 text-xs font-semibold text-foreground hover:bg-accent disabled:opacity-50"
      >
        {busy ? "Saving…" : "Add comment"}
      </button>
      {error ? (
        <p role="alert" className="mt-2 text-xs text-rose-400">
          {error}
        </p>
      ) : null}

      <h3 className="mt-6 text-sm font-semibold text-foreground">Revision history</h3>
      {revisions.length === 0 ? (
        <p className="mt-2 text-sm text-muted-foreground">No rewrites yet. Caption edits and co-pilot actions land here.</p>
      ) : (
        <ul className="mt-2 space-y-2">
          {[...revisions].reverse().map((revision) => (
            <li key={revision.id} className="rounded-md bg-background/60 px-3 py-2">
              <p className="text-[11px] font-semibold text-muted-foreground">
                {revision.summary} · {revision.actor}
              </p>
              <p className="mt-1 line-clamp-3 text-xs text-foreground">{revision.caption}</p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
