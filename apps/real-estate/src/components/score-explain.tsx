"use client";

import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { TierBadge } from "@/components/bits";
import type { ScoreFactor, Tier } from "@/lib/types";

/**
 * The tier badge as a button: hover, focus or click shows how the score is built — each factor's points,
 * its share of the total, and the field it came from. Same numbers as the "Why this?" panel on the buyer page.
 */
export function ScoreExplain({ tier, score, factors, align = "left" }: { tier: Tier; score: number; factors: ScoreFactor[]; align?: "left" | "right" }) {
  const [open, setOpenState] = useState(false);
  const [pinned, setPinned] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const ref = useRef<HTMLSpanElement>(null);
  const id = useId();
  const total = factors.reduce((s, f) => s + f.points, 0) || 1;

  const setOpen = (next: boolean) => {
    if (next && ref.current) {
      const r = ref.current.getBoundingClientRect();
      const width = 288;
      const left = align === "left" ? r.left : r.right - width;
      const below = window.innerHeight - r.bottom > 300;
      setPos({ top: below ? r.bottom + 8 : Math.max(8, r.top - 8 - 290), left: Math.max(8, Math.min(left, window.innerWidth - width - 8)) });
    }
    setOpenState(next);
  };

  useEffect(() => {
    if (!open) return;
    const close = () => {
      setPinned(false);
      setOpenState(false);
    };
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => {
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
  }, [open]);

  useEffect(() => {
    if (!pinned) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setPinned(false);
        setOpenState(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setPinned(false);
        setOpenState(false);
      }
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [pinned]);

  return (
    <span ref={ref} className="relative inline-flex" onMouseEnter={() => setOpen(true)} onMouseLeave={() => !pinned && setOpen(false)}>
      <button
        type="button"
        aria-expanded={open}
        aria-describedby={open ? id : undefined}
        aria-label={`Score ${score}, ${tier}. Show how it is calculated`}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setPinned((p) => !p);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => !pinned && setOpen(false)}
        className="cursor-help rounded-full focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
      >
        <TierBadge tier={tier} score={score} />
      </button>
      {open && pos
        ? createPortal(
        <span
          id={id}
          role="tooltip"
          style={{ top: pos.top, left: pos.left }}
          className="glass-panel fixed z-[70] block w-72 rounded-xl p-3 text-left animate-in fade-in-0 zoom-in-95 duration-150"
        >
          <span className="flex items-baseline justify-between">
            <span className="text-xs font-semibold text-foreground">Why {score}?</span>
            <span className="text-[10px] text-muted-foreground">points · share of score</span>
          </span>
          <span className="mt-2 block space-y-2">
            {factors.map((f) => {
              const share = Math.round((f.points / total) * 100);
              return (
                <span key={f.label} className="block">
                  <span className="flex items-baseline justify-between gap-2 text-[11px]">
                    <span className="font-medium text-foreground">{f.label}</span>
                    <span className="tabular font-mono text-muted-foreground">
                      {f.points}/{f.max} · {share}%
                    </span>
                  </span>
                  <span className="mt-1 block h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden>
                    <span className="block h-full rounded-full bg-primary" style={{ width: `${(f.points / f.max) * 100}%` }} />
                  </span>
                  <span className="mt-0.5 block truncate text-[10px] text-muted-foreground">{f.detail}</span>
                </span>
              );
            })}
          </span>
          <span className="mt-2 block border-t border-border/60 pt-2 text-[10px] text-muted-foreground">Rules over the buyer&apos;s own fields — no model guesses.</span>
        </span>,
            document.body
          )
        : null}
    </span>
  );
}
