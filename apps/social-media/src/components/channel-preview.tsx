import { CHANNEL_RULES, postLength } from "@/lib/readiness";
import type { Channel, MediaItem } from "@/lib/types";

function SampleTag({ show }: { show: boolean }) {
  return show ? <span className="absolute bottom-2 left-2 rounded bg-black/70 px-1.5 py-0.5 text-xs leading-none font-medium text-white">Sample image</span> : null;
}

/** A static mock of the destination feed. It previews copy; it is not the live network. */
export function ChannelPreview({
  channel,
  brand,
  handle,
  caption,
  hashtags,
  media,
  sample = false,
}: {
  channel: Channel;
  brand: string;
  handle: string;
  caption: string;
  hashtags: string[];
  media?: MediaItem;
  /** The image is a stock stand-in, not this post's own. It gets a "Sample image" label. */
  sample?: boolean;
}) {
  const tags = hashtags.map((tag) => `#${tag}`).join(" ");
  const frame = "overflow-hidden rounded-2xl border border-border bg-background text-foreground shadow-sm";

  if (channel === "x") {
    return (
      <article className={`${frame} p-4`} aria-label="X preview">
        <div className="flex gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-full bg-slate-700 text-xs font-bold">{brand.slice(0, 1)}</span>
          <div className="min-w-0">
            <p className="text-sm font-semibold">
              {brand} <span className="font-normal text-muted-foreground">{handle || "@brand"}</span>
            </p>
            <p className="mt-1 text-sm leading-relaxed whitespace-pre-line">{caption}</p>
            {tags ? <p className="mt-2 text-sm text-sky-300">{tags}</p> : null}
            {(() => {
              const used = postLength({ caption, hashtags });
              const limit = CHANNEL_RULES.x.hardMax ?? 280;
              return (
                <p className={`mt-2 text-xs ${used > limit ? "font-semibold text-rose-300" : "text-muted-foreground"}`}>
                  {used} / {limit} characters{used > limit ? ` — ${used - limit} over the X limit, the post would be cut off` : ""}
                </p>
              );
            })()}
          </div>
        </div>
      </article>
    );
  }

  if (channel === "linkedin") {
    return (
      <article className={frame} aria-label="LinkedIn preview">
        <div className="flex items-center gap-3 p-4">
          <span className="grid size-12 place-items-center rounded-md bg-sky-800 text-sm font-bold">{brand.slice(0, 1)}</span>
          <div>
            <p className="text-sm font-semibold">{brand}</p>
            <p className="text-xs text-muted-foreground">Company · just now</p>
          </div>
        </div>
        <p className="px-4 pb-3 text-sm leading-relaxed whitespace-pre-line">{caption}</p>
        {media?.kind === "image" ? (
          <div className="relative">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={media.url} alt="" className="max-h-72 w-full object-cover" />
            <SampleTag show={sample} />
          </div>
        ) : (
          <div className="grid h-36 place-items-center bg-sky-950/40 text-xs text-muted-foreground">No image attached</div>
        )}
        {tags ? <p className="px-4 py-3 text-sm text-sky-300">{tags}</p> : null}
      </article>
    );
  }

  if (channel === "tiktok") {
    return (
      <article className={`${frame} mx-auto max-w-xs bg-zinc-950`} aria-label="TikTok preview">
        <div className="relative grid min-h-96 place-items-end">
          {media?.kind === "image" ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={media.url} alt="" className="absolute inset-0 h-full w-full object-cover opacity-80" />
              <SampleTag show={sample} />
            </>
          ) : (
            <div className="absolute inset-0 bg-gradient-to-b from-zinc-800 to-black" />
          )}
          <div className="relative p-4">
            <p className="text-sm font-semibold">{handle || brand}</p>
            <p className="mt-1 text-sm leading-snug whitespace-pre-line">{caption}</p>
            {tags ? <p className="mt-2 text-xs text-zinc-300">{tags}</p> : null}
          </div>
        </div>
      </article>
    );
  }

  const accent = channel === "facebook" ? "text-blue-300" : "text-pink-300";
  return (
    <article className={frame} aria-label={channel === "facebook" ? "Facebook preview" : "Instagram preview"}>
      <div className="flex items-center gap-3 p-3">
        <span className="grid size-9 place-items-center rounded-full bg-pink-900 text-xs font-bold">{brand.slice(0, 1)}</span>
        <p className="text-sm font-semibold">{handle || brand}</p>
      </div>
      {media?.kind === "image" ? (
        <div className="relative">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={media.url} alt="" className="aspect-square w-full object-cover" />
          <SampleTag show={sample} />
        </div>
      ) : (
        <div className="grid aspect-square place-items-center bg-muted text-xs text-muted-foreground">No image attached</div>
      )}
      <div className="space-y-2 p-3">
        <p className="text-sm leading-relaxed whitespace-pre-line">
          <span className="font-semibold">{handle || brand} </span>
          {caption}
        </p>
        {tags ? <p className={`text-sm ${accent}`}>{tags}</p> : null}
      </div>
    </article>
  );
}
