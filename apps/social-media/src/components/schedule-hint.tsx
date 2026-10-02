"use client";

import { useState } from "react";
import { notifyDesk, postJson } from "@/components/notify-desk";
import { formatSlot } from "@/lib/format";

export function ScheduleHint({ postId, scheduledFor, suggestionIso, reason, matches }: { postId: string; scheduledFor: string; suggestionIso: string; reason: string; matches: boolean }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function apply() {
    setBusy(true);
    setError(null);
    try {
      await postJson(`/api/posts/${encodeURIComponent(postId)}/schedule`, { when: suggestionIso });
      notifyDesk("Moved the post to the guideline slot.", [postId]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-xl border border-border bg-card/80 p-5" aria-labelledby="slot-heading">
      <h2 id="slot-heading" className="text-lg font-semibold text-foreground">
        Suggested time
      </h2>
      <p className="mt-1 text-xs text-muted-foreground">Planned for {formatSlot(scheduledFor)}.</p>
      <p className="mt-2 text-sm leading-relaxed text-foreground">{reason}</p>
      {matches ? (
        <p className="mt-3 text-xs text-primary">This slot already matches the guideline.</p>
      ) : (
        <button
          type="button"
          disabled={busy}
          onClick={() => void apply()}
          className="mt-3 inline-flex min-h-9 cursor-pointer items-center rounded-lg bg-primary px-3 text-xs font-semibold text-primary-foreground transition hover:brightness-110 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:opacity-50"
        >
          {busy ? "Moving…" : `Use ${formatSlot(suggestionIso)}`}
        </button>
      )}
      {error ? (
        <p role="alert" className="mt-2 text-xs text-rose-400">
          {error}
        </p>
      ) : null}
    </section>
  );
}
