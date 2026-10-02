"use client";

import { useState } from "react";
import { AutoFixButton } from "@/components/auto-fix-button";
import { CaptionCopilot } from "@/components/caption-copilot";
import { ChannelPreview } from "@/components/channel-preview";
import type { Channel, MediaItem } from "@/lib/types";

export function PostStudio({
  postId,
  channel,
  brand,
  handle,
  caption,
  hashtags,
  media,
  score,
  voice,
  avoid = [],
  watch = [],
}: {
  postId: string;
  channel: Channel;
  brand: string;
  handle: string;
  caption: string;
  hashtags: string[];
  media?: MediaItem;
  score: number;
  voice: string;
  avoid?: string[];
  watch?: string[];
}) {
  const [liveCaption, setLiveCaption] = useState(caption);
  const [liveTags, setLiveTags] = useState(hashtags);

  return (
    <div className="grid items-start gap-6 lg:grid-cols-2">
      <section className="rounded-xl border border-border bg-card/80 p-5" aria-labelledby="editor-heading">
        <h2 id="editor-heading" className="text-lg font-semibold text-foreground">
          Editor
        </h2>
        <p className="mt-1 text-xs text-muted-foreground">Hashtags and mentions stay highlighted. The commands refine this draft. {voice}</p>
        <div className="mt-4">
          <AutoFixButton postId={postId} score={score} prominent={score < 100} />
        </div>
        <details className="mt-4" open>
          <summary className="cursor-pointer text-xs font-semibold tracking-wider text-muted-foreground uppercase">Refine, shorten, add a CTA</summary>
          <div className="mt-3">
            <CaptionCopilot
              postId={postId}
              caption={caption}
              hashtags={hashtags}
              avoid={avoid}
              watch={watch}
              onDraft={(nextCaption, nextTags) => {
                setLiveCaption(nextCaption);
                setLiveTags(nextTags);
              }}
            />
          </div>
        </details>
      </section>
      <section className="rounded-xl border border-border bg-card/80 p-5 lg:sticky lg:top-4" aria-labelledby="preview-heading">
        <h2 id="preview-heading" className="text-lg font-semibold text-foreground">
          Live mock
        </h2>
        <p className="mt-1 mb-4 text-xs text-muted-foreground">The mock follows the caption as you type. It is not the live network.</p>
        <ChannelPreview channel={channel} brand={brand} handle={handle} caption={liveCaption} hashtags={liveTags} media={media} />
      </section>
    </div>
  );
}
