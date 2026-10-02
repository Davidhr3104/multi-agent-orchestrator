"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { notifyDesk, postJson } from "@/components/notify-desk";
import { channelLabel } from "@/lib/format";
import type { Channel, PostStatus } from "@/lib/types";

const CHANNELS: Channel[] = ["instagram", "linkedin", "x", "tiktok", "facebook"];

/** Turns an approved post into a draft sized for another channel. */
export function RepurposePanel({ postId, status, channel }: { postId: string; status: PostStatus; channel: Channel }) {
  const router = useRouter();
  const [busy, setBusy] = useState<Channel | null>(null);
  const [error, setError] = useState<string | null>(null);
  const open = status === "approved";

  async function go(target: Channel) {
    setBusy(target);
    setError(null);
    try {
      const data = await postJson<{ post: { id: string } }>(`/api/posts/${encodeURIComponent(postId)}/repurpose`, { channel: target });
      notifyDesk(`Drafted a ${channelLabel(target)} version. It still needs a person.`, [data.post.id]);
      router.push(`/posts/${data.post.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed");
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="rounded-xl border border-border bg-card/80 p-5" aria-labelledby="repurpose-heading">
      <h2 id="repurpose-heading" className="text-lg font-semibold text-foreground">
        Repurpose
      </h2>
      <p className="mt-1 text-xs text-muted-foreground">
        {open ? "Start a draft for another channel from this approved copy. The original stays approved." : "Available once this post is approved, so other channels start from signed-off copy."}
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        {CHANNELS.filter((item) => item !== channel).map((item) => (
          <button
            key={item}
            type="button"
            disabled={!open || !!busy}
            onClick={() => void go(item)}
            className="inline-flex min-h-9 cursor-pointer items-center rounded-lg border border-border px-3 text-xs font-semibold text-foreground transition hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy === item ? "Drafting…" : channelLabel(item)}
          </button>
        ))}
      </div>
      {error ? (
        <p role="alert" className="mt-2 text-xs text-rose-400">
          {error}
        </p>
      ) : null}
    </section>
  );
}
