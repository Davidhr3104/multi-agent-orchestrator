"use client";

import { useEffect, useId, useMemo, useState } from "react";
import { AVATAR_CSS, AVATAR_TEMPLATE } from "./helix-avatar-art.generated";
import { cssVersion } from "./css-version";

/**
 * The animated Helix cloud avatar. One component for all eight desks: the shapes and
 * animations are shared (Stitch catalog, see helix-avatar-art.generated.ts) and only the
 * palette changes per desk. State is a class on the root svg (`is-thinking`, ...).
 */

export const HELIX_AVATAR_DESKS = ["leads", "data", "legal", "commerce", "marketing", "real-estate", "social", "inbox"] as const;
export type HelixAvatarDesk = (typeof HELIX_AVATAR_DESKS)[number];
export type HelixAvatarState = "idle" | "thinking" | "speaking" | "unsure" | "done" | "error";

type Palette = {
  /** visor darks, edge -> center */
  V: [string, string, string];
  /** body tones, deepest -> light accent */
  B: [string, string, string, string];
  /** light tint for highlights and the helix glow */
  T: string;
};

// Colors come from the eight approved logo variants. The desk -> color pairing is the one
// proposed to the owner; change it here and every app follows.
const PALETTES: Record<HelixAvatarDesk, Palette> = {
  leads: { V: ["#060e26", "#0b1b4a", "#112352"], B: ["#172554", "#1d4ed8", "#2563eb", "#38bdf8"], T: "#bae6fd" },
  data: { V: ["#030a0d", "#081d24", "#0e2a33"], B: ["#0e7490", "#0891b2", "#06b6d4", "#22d3ee"], T: "#cffafe" },
  legal: { V: ["#020617", "#0f172a", "#1e293b"], B: ["#64748b", "#94a3b8", "#cbd5e1", "#e2e8f0"], T: "#f8fafc" },
  commerce: { V: ["#020a06", "#061e14", "#0b2e1f"], B: ["#065f46", "#059669", "#10b981", "#34d399"], T: "#d1fae5" },
  marketing: { V: ["#0a0604", "#1c100b", "#2d160c"], B: ["#9a3412", "#ea580c", "#f97316", "#fb923c"], T: "#ffedd5" },
  "real-estate": { V: ["#0a0804", "#1c160b", "#2d2210"], B: ["#713f12", "#ca8a04", "#eab308", "#fde047"], T: "#fef9c3" },
  social: { V: ["#0a0408", "#1c0b15", "#2d1020"], B: ["#831843", "#db2777", "#ec4899", "#f472b6"], T: "#fce7f3" },
  inbox: { V: ["#080410", "#140d24", "#241540"], B: ["#4c1d95", "#6d28d9", "#8b5cf6", "#a78bfa"], T: "#ede9fe" },
};

const hexToRgb = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const mix = (a: string, b: string, t: number) => {
  const [ra, rb] = [hexToRgb(a), hexToRgb(b)];
  return "#" + ra.map((v, i) => Math.round(v + (rb[i] - v) * t).toString(16).padStart(2, "0")).join("");
};

/** below this size the state cues need exaggerating to stay readable */
const COMPACT_BELOW = 72;

const AVATAR_STYLE_HREF = `helix-avatar-${cssVersion(AVATAR_CSS)}`;

const warned = new Set<string>();

function paint(palette: Palette, uid: string) {
  const [B1, B2, B3, B4] = palette.B;
  const [V1, V2, V3] = palette.V;
  const map: Record<string, string> = {
    __B1__: B1, __B2__: B2, __B3__: B3, __B4__: B4,
    __V1__: V1, __V2__: V2, __V3__: V3,
    __T__: palette.T, __M__: mix(B4, palette.T, 0.5), __ID__: uid,
  };
  let out = AVATAR_TEMPLATE;
  for (const [token, value] of Object.entries(map)) out = out.split(token).join(value);
  return out;
}

export function HelixAvatar({
  desk,
  state = "idle",
  size = 40,
  decorative = false,
  animated = true,
  compact,
  label = "Helix AI assistant",
  className,
}: {
  desk: HelixAvatarDesk;
  state?: HelixAvatarState;
  /** px; the logo scales cleanly, but the thought bubbles only read from ~96px up */
  size?: number;
  /** true when an adjacent heading or label already names it (hides it from screen readers) */
  decorative?: boolean;
  /** false freezes the motion (older chat messages); the face still reflects `state` */
  animated?: boolean;
  /** exaggerates the state cues (bubble, eye tilt, voice halo) for small sizes; defaults to size < 72 */
  compact?: boolean;
  label?: string;
  className?: string;
}) {
  // ids must be unique per instance: a url(#id) that points at a hidden or unmounted copy erases the cloud.
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  let palette = PALETTES[desk];
  if (!palette) {
    if (!warned.has(String(desk))) {
      warned.add(String(desk));
      console.warn(`HelixAvatar: unknown desk "${String(desk)}", falling back to "leads".`);
    }
    palette = PALETTES.leads;
  }
  const inner = useMemo(() => paint(palette, uid), [palette, uid]);

  return (
    <>
      {/* React 19 hoists and de-duplicates a style with href + precedence, so N avatars ship the CSS once */}
      <style href={AVATAR_STYLE_HREF} precedence="default">
        {AVATAR_CSS}
      </style>
      <span className={className} style={{ display: "inline-block", width: size, height: size, flexShrink: 0 }}>
        <svg
          className={`helix-avatar is-${state}${(compact ?? size < COMPACT_BELOW) ? " is-compact" : ""}${animated ? "" : " is-static"}`}
          viewBox="0 0 320 320"
          width="100%"
          height="100%"
          focusable="false"
          xmlns="http://www.w3.org/2000/svg"
          {...(decorative ? { "aria-hidden": true } : { role: "img", "aria-label": label })}
          dangerouslySetInnerHTML={{ __html: inner }}
        />
      </span>
    </>
  );
}

/** How long a fresh reply "speaks" and how long the happy "done" face lingers afterwards. */
export const HELIX_SPEAK_MS = 2600;
export const HELIX_DONE_MS = 1200;

export type AvatarPhase = "idle" | "speaking" | "done";

/**
 * After a request ends cleanly the face speaks, then shows done, then rests. Every step is a pure
 * transition so a late timer from a phase we already left changes nothing.
 */
export function nextPhase(phase: AvatarPhase, event: "start" | "fail" | "reply" | "speakEnd" | "doneEnd"): AvatarPhase {
  switch (event) {
    case "start":
    case "fail":
      return "idle";
    case "reply":
      return "speaking";
    case "speakEnd":
      return phase === "speaking" ? "done" : phase;
    case "doneEnd":
      return phase === "done" ? "idle" : phase;
  }
}

/** Pure rule for which face to show; kept separate so it is testable without a DOM. */
export function nextAvatarState({
  busy,
  error,
  needsHuman,
  phase,
  taskDone = false,
}: {
  busy: boolean;
  error: boolean;
  /** the latest reply is waiting for a person to approve it (the "human brake") */
  needsHuman: boolean;
  phase: AvatarPhase;
  /** the latest reply's task is finished (confirmed, executed or approved): rest on "done" until something new happens */
  taskDone?: boolean;
}): HelixAvatarState {
  if (error) return "error";
  if (busy) return "thinking";
  if (needsHuman) return "unsure";
  if (phase === "speaking") return "speaking";
  if (phase === "done" || taskDone) return "done";
  return "idle";
}

/**
 * Derives the face from real chat state: thinking while a request is in flight, speaking when the
 * reply lands, done afterwards (and it stays done while the task is finished), unsure while a reply waits for
 * a human OK, error while an error shows.
 * No timers pretend to be work; the only timers are the short speaking/done flashes after a real reply.
 */
export function useHelixAvatarState(busy: boolean, error: boolean, needsHuman = false, taskDone = false): HelixAvatarState {
  const [prevBusy, setPrevBusy] = useState(busy);
  const [phase, setPhase] = useState<AvatarPhase>("idle");
  if (busy !== prevBusy) {
    // render-phase update (React's documented "adjust state on prop change" pattern)
    setPrevBusy(busy);
    setPhase(nextPhase(phase, busy ? "start" : error ? "fail" : "reply"));
  }
  useEffect(() => {
    if (phase === "idle") return;
    const speaking = phase === "speaking";
    const t = setTimeout(() => setPhase((p) => nextPhase(p, speaking ? "speakEnd" : "doneEnd")), speaking ? HELIX_SPEAK_MS : HELIX_DONE_MS);
    return () => clearTimeout(t);
  }, [phase]);
  return nextAvatarState({ busy, error, needsHuman, phase, taskDone });
}
