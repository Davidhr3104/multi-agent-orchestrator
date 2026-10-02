"use client";

import { useState } from "react";
import { notifyDesk, postJson } from "@/components/notify-desk";
import { stockForPillar, visualPrompt } from "@/lib/stock";
import type { MediaItem, Pillar } from "@/lib/types";

export function MediaPanel({
  postId,
  pillar,
  caption,
  brandName,
  asset,
  media,
  library = [],
}: {
  postId: string;
  pillar: Pillar;
  caption: string;
  brandName: string;
  asset: string;
  media: MediaItem[];
  library?: { id: string; name: string }[];
}) {
  const [url, setUrl] = useState("");
  const [label, setLabel] = useState("");
  const [kind, setKind] = useState<"image" | "video">("image");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const prompt = visualPrompt(pillar, caption, brandName);
  const stock = stockForPillar(pillar);

  async function run(id: string, body: unknown, message: string) {
    setBusy(id);
    setError(null);
    try {
      await postJson(`/api/posts/${encodeURIComponent(postId)}/media`, body);
      if (id === "link") {
        setUrl("");
        setLabel("");
      }
      notifyDesk(message, [postId]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed");
    } finally {
      setBusy(null);
    }
  }

  async function savePrompt() {
    setBusy("prompt");
    setError(null);
    try {
      await postJson(`/api/posts/${encodeURIComponent(postId)}/edit`, { asset: prompt });
      notifyDesk("Saved the image prompt as the visual brief. No image was generated.", [postId]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed");
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="rounded-xl border border-border bg-card/80 p-5" aria-labelledby="media-heading">
      <h2 id="media-heading" className="text-lg font-semibold text-foreground">
        Media
      </h2>
      <p className="mt-1 text-xs text-muted-foreground">Attach a file link or a stock frame for this pillar. Stock is a real photo. The prompt below is text for an image model — this desk does not generate it.</p>
      {asset ? <p className="mt-3 text-sm text-foreground">Visual brief: {asset}</p> : <p className="mt-3 text-sm text-muted-foreground">No visual brief yet.</p>}

      {media.length ? (
        <ul className="mt-4 grid gap-3 sm:grid-cols-2">
          {media.map((item) => (
            <li key={item.id} className="overflow-hidden rounded-lg border border-border">
              {item.kind === "image" ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={item.url} alt={item.label} className="aspect-video w-full object-cover" />
              ) : (
                <video src={item.url} controls className="aspect-video w-full bg-black" />
              )}
              <div className="flex items-center justify-between gap-2 px-3 py-2">
                <p className="truncate text-xs text-foreground">
                  {item.label} <span className="text-muted-foreground">· {item.source}</span>
                </p>
                <button type="button" className="text-xs font-semibold text-muted-foreground hover:text-foreground" disabled={!!busy} onClick={() => void run(item.id, { action: "remove", mediaId: item.id }, "Removed the attachment.")}>
                  Remove
                </button>
              </div>
            </li>
          ))}
        </ul>
      ) : null}

      {library.length ? (
        <>
          <h3 className="mt-5 text-xs font-semibold tracking-wider text-muted-foreground uppercase">Brand-approved library</h3>
          <div className="mt-2 flex flex-wrap gap-2">
            {library.map((item) => (
              <button
                key={item.id}
                type="button"
                disabled={!!busy}
                onClick={() => void run(item.id, { libraryId: item.id }, "Attached a brand-approved asset.")}
                className="inline-flex min-h-9 cursor-pointer items-center rounded-lg border border-border px-3 text-xs font-semibold text-foreground hover:bg-accent disabled:opacity-50"
              >
                {busy === item.id ? "Adding…" : item.name}
              </button>
            ))}
          </div>
        </>
      ) : null}

      <h3 className="mt-5 text-xs font-semibold tracking-wider text-muted-foreground uppercase">Stock for this pillar</h3>
      <div className="mt-2 flex flex-wrap gap-2">
        {stock.map((frame) => (
          <button
            key={frame.id}
            type="button"
            disabled={!!busy}
            onClick={() => void run(frame.id, { stockId: frame.id }, "Attached a stock frame.")}
            className="inline-flex min-h-9 cursor-pointer items-center rounded-lg border border-border px-3 text-xs font-semibold text-foreground hover:bg-accent disabled:opacity-50"
          >
            {busy === frame.id ? "Adding…" : frame.label}
          </button>
        ))}
      </div>

      <h3 className="mt-5 text-xs font-semibold tracking-wider text-muted-foreground uppercase">Image prompt</h3>
      <p className="mt-2 rounded-lg bg-background/60 px-3 py-2 text-xs leading-relaxed text-foreground">{prompt}</p>
      <button type="button" disabled={!!busy} onClick={() => void savePrompt()} className="mt-2 inline-flex min-h-9 cursor-pointer items-center rounded-lg border border-primary/40 bg-primary/10 px-3 text-xs font-semibold text-primary hover:bg-primary/20 disabled:opacity-50">
        {busy === "prompt" ? "Saving…" : "Generate image"}
      </button>
      <p className="mt-1 text-[11px] text-muted-foreground">Saves the prompt as the visual brief. FLUX, Midjourney and DALL-E are not connected, so no file is created.</p>

      <h3 className="mt-5 text-xs font-semibold tracking-wider text-muted-foreground uppercase">Your file</h3>
      <div className="mt-2 grid gap-2 sm:grid-cols-2">
        <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Label" className="rounded-lg border border-input bg-background/60 px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none" />
        <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…" className="rounded-lg border border-input bg-background/60 px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none" />
      </div>
      <div className="mt-2 flex flex-wrap gap-2">
        <button type="button" aria-pressed={kind === "image"} onClick={() => setKind("image")} className={`rounded-full border px-3 py-1 text-xs font-semibold ${kind === "image" ? "border-primary/50 bg-primary/15 text-primary" : "border-border text-muted-foreground"}`}>
          Image
        </button>
        <button type="button" aria-pressed={kind === "video"} onClick={() => setKind("video")} className={`rounded-full border px-3 py-1 text-xs font-semibold ${kind === "video" ? "border-primary/50 bg-primary/15 text-primary" : "border-border text-muted-foreground"}`}>
          Video
        </button>
        <button type="button" disabled={!!busy || !url.trim()} onClick={() => void run("link", { url, label, kind }, "Attached your file.")} className="inline-flex min-h-9 cursor-pointer items-center rounded-lg border border-border px-3 text-xs font-semibold text-foreground hover:bg-accent disabled:opacity-50">
          {busy === "link" ? "Adding…" : "Attach link"}
        </button>
      </div>
      {error ? (
        <p role="alert" className="mt-2 text-xs text-rose-400">
          {error}
        </p>
      ) : null}
    </section>
  );
}
