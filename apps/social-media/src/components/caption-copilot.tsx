"use client";

import { useEffect, useRef, useState } from "react";
import { notifyDesk, postJson } from "@/components/notify-desk";
import type { RewriteAction } from "@/lib/copilot";

const ACTIONS: { id: RewriteAction; label: string }[] = [
  { id: "concise", label: "Make concise" },
  { id: "emojis", label: "Add emojis" },
  { id: "professional", label: "Professional tone" },
  { id: "cta", label: "Add CTA" },
];

const btn =
  "inline-flex min-h-9 cursor-pointer items-center rounded-lg border border-border px-3 text-xs font-semibold text-foreground transition hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50";

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Draft editor. A selection rewrites that fragment; with no selection the action covers the whole caption. */
function paint(text: string, avoid: string[], watch: string[]) {
  const banned = avoid.map((word) => word.trim()).filter((word) => word.length > 1);
  const watched = watch.map((word) => word.trim()).filter((word) => word.length > 1);
  const pattern = banned.length || watched.length
    ? new RegExp(`((?:#|@)[\\p{L}\\p{N}_]+|${[...banned, ...watched].map(escapeRegExp).join("|")})`, "giu")
    : /((?:#|@)[\p{L}\p{N}_]+)/gu;
  const parts = text.split(pattern);
  return parts.map((part, index) => {
    const blocked = banned.some((word) => word.toLowerCase() === part.toLowerCase());
    const flagged = watched.some((word) => word.toLowerCase() === part.toLowerCase());
    if (blocked) {
      return (
        <mark key={index} className="rounded bg-rose-500/35 text-rose-100">
          {part}
        </mark>
      );
    }
    if (flagged) {
      return (
        <mark key={index} className="rounded bg-amber-400/35 text-amber-50">
          {part}
        </mark>
      );
    }
    return part.startsWith("#") || part.startsWith("@") ? (
      <span key={index} className="text-sky-300">
        {part}
      </span>
    ) : (
      <span key={index}>{part}</span>
    );
  });
}

export function CaptionCopilot({
  postId,
  caption,
  hashtags,
  avoid = [],
  watch = [],
  onDraft,
}: {
  postId: string;
  caption: string;
  hashtags: string[];
  avoid?: string[];
  watch?: string[];
  onDraft?: (caption: string, hashtags: string[]) => void;
}) {
  const tagLine = hashtags.join(" ");
  const [text, setText] = useState(caption);
  const [tags, setTags] = useState(tagLine);
  const [range, setRange] = useState<[number, number]>([0, 0]);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const draftRef = useRef(onDraft);
  draftRef.current = onDraft;
  useEffect(() => setText(caption), [caption]);
  useEffect(() => setTags(tagLine), [tagLine]);
  useEffect(() => {
    draftRef.current?.(text, tags.split(/[\s,]+/).filter(Boolean));
  }, [tags, text]);

  const selected = range[0] !== range[1];

  async function rewrite(action: RewriteAction) {
    setBusy(action);
    setError(null);
    try {
      const data = await postJson<{ post: { caption: string } }>(`/api/posts/${encodeURIComponent(postId)}/rewrite`, {
        action,
        start: range[0],
        end: range[1],
      });
      setText(data.post.caption);
      notifyDesk(selected ? "Rewrote the selection. If this was approved, it is back in review." : "Rewrote the draft. If this was approved, it is back in review.", [postId]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed");
    } finally {
      setBusy(null);
    }
  }

  async function save() {
    setBusy("save");
    setError(null);
    try {
      await postJson(`/api/posts/${encodeURIComponent(postId)}/edit`, {
        caption: text,
        hashtags: tags.split(/[\s,]+/).filter(Boolean),
      });
      notifyDesk("Saved the draft.", [postId]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2" aria-label="Rewrite actions">
        {ACTIONS.map((action) => (
          <button key={action.id} type="button" className={btn} disabled={!!busy} onClick={() => void rewrite(action.id)}>
            {busy === action.id ? "Working…" : action.label}
          </button>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">
        {selected ? "Actions apply to the selected text and follow the brand voice." : "Select a fragment to rewrite just that part. With nothing selected, the action covers the whole draft."}
      </p>
      <label htmlFor="caption-draft" className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
        Caption
      </label>
      <div className="relative">
        <pre aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden px-3 py-2 font-sans text-sm leading-relaxed whitespace-pre-wrap text-foreground">
          {paint(text, avoid, watch)}
          {"\n"}
        </pre>
        <textarea
          id="caption-draft"
          value={text}
          rows={7}
          maxLength={8000}
          onChange={(e) => setText(e.target.value)}
          onSelect={(e) => setRange([e.currentTarget.selectionStart, e.currentTarget.selectionEnd])}
          className="relative w-full rounded-lg border border-input bg-transparent px-3 py-2 font-sans text-sm leading-relaxed text-transparent caret-foreground focus:border-primary focus:outline-none"
        />
      </div>
      <label htmlFor="hashtag-draft" className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
        Hashtags
      </label>
      <input
        id="hashtag-draft"
        value={tags}
        onChange={(e) => setTags(e.target.value)}
        className="w-full rounded-lg border border-input bg-background/60 px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none"
      />
      <button type="button" className={`${btn} bg-primary text-primary-foreground hover:brightness-110`} disabled={!!busy} onClick={() => void save()}>
        {busy === "save" ? "Saving…" : "Save draft"}
      </button>
      {error ? (
        <p role="alert" className="text-xs text-rose-400">
          {error}
        </p>
      ) : null}
    </div>
  );
}
