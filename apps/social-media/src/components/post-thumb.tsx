"use client";

import { useEffect, useRef, useState } from "react";
import { CoverArt } from "@helix/ui";
import { ChannelMark } from "@/components/channel";
import { channelLabel, PILLAR_LABEL } from "@/lib/format";
import { coverMedia, PILLAR_GRADIENT, sampleMedia } from "@/lib/visuals";
import type { Channel, Pillar, Post } from "@/lib/types";
import { cn } from "@/lib/utils";

type ThumbPost = Pick<Post, "id" | "pillar" | "channel" | "media">;

/**
 * Thumbnail for a post, in order: the photo or clip a person attached, a stock photo for its pillar
 * (always labelled "Sample image"), then a generated gradient cover with the network mark. The gradient is also
 * the fallback whenever an image fails to load, so a broken link never leaves a grey box.
 */
export function PostThumb({ post, className, showLabel = true }: { post: ThumbPost; className?: string; showLabel?: boolean }) {
  const own = coverMedia(post);
  const ownImage = own?.kind === "image" ? own : undefined;
  const sample = ownImage ? undefined : sampleMedia(post);
  const src = ownImage?.url ?? sample?.url;
  const [failed, setFailed] = useState(false);
  const img = useRef<HTMLImageElement>(null);

  // An image can fail before React attaches onError during hydration.
  useEffect(() => {
    const el = img.current;
    if (el && el.complete && el.naturalWidth === 0) setFailed(true);
  }, [src]);

  const alt = ownImage ? ownImage.label : `${PILLAR_LABEL[post.pillar]} sample image`;

  return (
    <div className={cn("relative isolate overflow-hidden rounded-lg bg-muted", className)}>
      {src && !failed ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img ref={img} src={src} alt={alt} loading="lazy" onError={() => setFailed(true)} className="absolute inset-0 size-full object-cover" />
      ) : (
        <GeneratedCover pillar={post.pillar} channel={post.channel} />
      )}
      {sample && src && !failed && showLabel ? (
        <span className="absolute bottom-1 left-1 rounded bg-black/70 px-1.5 py-0.5 text-xs leading-none font-medium text-white">Sample image</span>
      ) : null}
    </div>
  );
}

function GeneratedCover({ pillar, channel }: { pillar: Pillar; channel: Channel }) {
  return (
    <div className="absolute inset-0 [&>div]:h-full! [&>div]:rounded-none!">
      <CoverArt colors={PILLAR_GRADIENT[pillar]} label={`${PILLAR_LABEL[pillar]} cover for ${channelLabel(channel)}`}>
        <ChannelMark channel={channel} className="size-1/3 max-h-12 min-h-5 min-w-5 opacity-90" />
      </CoverArt>
    </div>
  );
}
