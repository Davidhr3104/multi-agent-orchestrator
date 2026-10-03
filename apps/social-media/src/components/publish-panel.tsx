"use client";

import { useState } from "react";
import { notifyDesk, postJson } from "@/components/notify-desk";
import type { Channel, Publication } from "@/lib/types";

/** One approved post, one person, one confirmation. The server re-checks every gate. */
export function PublishPanel({ postId, channel, allowed, reason, publication }: { postId: string; channel: Channel; allowed: boolean; reason: string | null; publication: Publication | null }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (publication) {
    return (
      <div className="space-y-1 text-sm">
        <p className="text-foreground">
          Published to {publication.network} on {new Date(publication.at).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })} by {publication.by}.
        </p>
        <p className="font-mono text-xs text-muted-foreground">Network post id: {publication.externalId}</p>
        {publication.permalink ? (
          <a href={publication.permalink} target="_blank" rel="noreferrer" className="text-xs font-semibold text-primary hover:underline">
            Open the live post
          </a>
        ) : (
          <p className="text-xs text-muted-foreground">The network did not return a link.</p>
        )}
      </div>
    );
  }

  async function publish() {
    if (!window.confirm(`Publish this approved post to ${channel} now? It goes out on the real account.`)) return;
    setBusy(true);
    setError(null);
    try {
      await postJson(`/api/posts/${encodeURIComponent(postId)}/publish`, { confirm: true });
      notifyDesk(`The ${channel} API accepted the post.`, [postId]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        disabled={!allowed || busy}
        onClick={() => void publish()}
        className="inline-flex min-h-10 cursor-pointer items-center rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {busy ? "Sending…" : `Publish to ${channel}`}
      </button>
      {reason ? <p className="text-xs text-muted-foreground">{reason}</p> : <p className="text-xs text-muted-foreground">Sends this exact approved version. Editing it afterwards needs a new approval.</p>}
      {error ? (
        <p role="alert" className="text-xs text-rose-400">
          {error}
        </p>
      ) : null}
    </div>
  );
}
