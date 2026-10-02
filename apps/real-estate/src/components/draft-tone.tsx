"use client";

import { useSyncExternalStore, type ComponentProps } from "react";
import { DeskActionButton } from "@/components/desk-action-button";
import { DRAFT_TONES, TONE_LABEL, isTone, type DraftTone } from "@/lib/outreach";
import { cn } from "@/lib/utils";

const KEY = "helix-re:draft-tone";
const EVENT = "helix:draft-tone";

function subscribe(cb: () => void) {
  window.addEventListener(EVENT, cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(EVENT, cb);
    window.removeEventListener("storage", cb);
  };
}

export function useDraftTone(): [DraftTone, (t: DraftTone) => void] {
  const raw = useSyncExternalStore(
    subscribe,
    () => localStorage.getItem(KEY),
    () => null
  );
  const set = (t: DraftTone) => {
    localStorage.setItem(KEY, t);
    window.dispatchEvent(new Event(EVENT));
  };
  return [isTone(raw) ? raw : "friendly", set];
}

const HINT: Record<DraftTone, string> = {
  friendly: "“Hi Ana,” — warm and short",
  formal: "“Dear Ana Torres,” — ends with Kind regards",
  sales: "Direct ask to book a viewing",
};

/** Sets the greeting and closing Helix uses for new drafts. Facts in the middle never change with tone. */
export function ToneSelect({ className }: { className?: string }) {
  const [tone, setTone] = useDraftTone();
  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      <span className="text-xs text-muted-foreground">Draft tone</span>
      <div role="radiogroup" aria-label="Draft tone" className="inline-flex rounded-lg bg-muted/60 p-0.5">
        {DRAFT_TONES.map((t) => (
          <button
            key={t}
            type="button"
            role="radio"
            aria-checked={tone === t}
            title={HINT[t]}
            onClick={() => setTone(t)}
            className={cn("min-h-8 cursor-pointer rounded-md px-3 text-xs font-semibold transition", tone === t ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}
          >
            {TONE_LABEL[t]}
          </button>
        ))}
      </div>
    </div>
  );
}

/** A draft-writing desk action that carries the agent's chosen tone. */
export function TonedDeskActionButton(props: Omit<ComponentProps<typeof DeskActionButton>, "params">) {
  const [tone] = useDraftTone();
  return <DeskActionButton {...props} params={{ tone }} />;
}
