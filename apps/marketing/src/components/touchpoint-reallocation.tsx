"use client";

import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";

type Touch = {
  id: string;
  label: string;
  short: string;
  color: string;
  lastTouch: number;
  markov: number;
  note?: string;
  warn?: boolean;
};

const TOUCHES: Touch[] = [
  {
    id: "meta",
    label: "Paid Social · Meta TOFU (Reels & Carousels)",
    short: "Meta TOFU",
    color: "#1877F2",
    lastTouch: 16.2,
    markov: 40.2,
    note: "High removal effect (0.44) — early pipeline discovery gets rediscovered credit.",
  },
  {
    id: "google",
    label: "Paid Search · Google High Intent (Non-Brand)",
    short: "Google Intent",
    color: "#f97316",
    lastTouch: 38.5,
    markov: 31.8,
    note: "Last-touch overcredits search when prospects were seeded via Video & Social.",
    warn: true,
  },
  {
    id: "tiktok",
    label: "Video UGC · TikTok Spark Ads (Creator Whitelist)",
    short: "TikTok Spark",
    color: "#e3e1e9",
    lastTouch: 6.3,
    markov: 16.5,
    note: "UGC discovery under-credited in last-touch; Markov restores mid-funnel lift.",
  },
  {
    id: "direct",
    label: "Organic / Direct Navigational (Brand URL)",
    short: "Direct / Brand",
    color: "#a78b7d",
    lastTouch: 39.0,
    markov: 11.5,
    note: "72% of Direct sessions carried lingering UTM cookies from earlier paid touchpoints.",
    warn: true,
  },
];

function moneyFromPct(pct: number, total = 48250) {
  return `$${Math.round((pct / 100) * total).toLocaleString()}`;
}

/** Improved Sankey-delta: left Last-Touch → flowing bands → right Markov */
export function TouchpointReallocationFlow() {
  const [hover, setHover] = useState<string | null>(null);

  const layout = useMemo(() => {
    const W = 760;
    const H = 320;
    const leftX = 8;
    const rightX = 620;
    const nodeW = 132;
    const gap = 14;
    const usable = H - gap * (TOUCHES.length + 1);
    const totalL = TOUCHES.reduce((s, t) => s + t.lastTouch, 0);
    const totalR = TOUCHES.reduce((s, t) => s + t.markov, 0);

    let yL = gap;
    let yR = gap;
    const nodes = TOUCHES.map((t) => {
      const hL = Math.max(22, (t.lastTouch / totalL) * usable);
      const hR = Math.max(22, (t.markov / totalR) * usable);
      const left = { x: leftX, y: yL, w: nodeW, h: hL };
      const right = { x: rightX, y: yR, w: nodeW, h: hR };
      yL += hL + gap;
      yR += hR + gap;
      const delta = t.markov - t.lastTouch;
      return { t, left, right, delta };
    });

    // Flow paths: ribbon from left node mid-right to right node mid-left
    const flows = nodes.map(({ t, left, right, delta }) => {
      const x0 = left.x + left.w;
      const x1 = right.x;
      const y0a = left.y + 2;
      const y0b = left.y + left.h - 2;
      const y1a = right.y + 2;
      const y1b = right.y + right.h - 2;
      const mid = (x0 + x1) / 2;
      const path = [
        `M ${x0} ${y0a}`,
        `C ${mid} ${y0a}, ${mid} ${y1a}, ${x1} ${y1a}`,
        `L ${x1} ${y1b}`,
        `C ${mid} ${y1b}, ${mid} ${y0b}, ${x0} ${y0b}`,
        "Z",
      ].join(" ");
      return { id: t.id, path, color: t.color, delta, t };
    });

    return { W, H, nodes, flows };
  }, []);

  return (
    <div className="flex flex-col gap-3 rounded-xl bg-surface-container-low p-4 shadow-md">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[16px] font-semibold text-on-surface">
              Touchpoint Re-Allocation Flow
            </span>
            <span className="rounded bg-tertiary/10 px-1.5 py-0.5 font-mono text-[10px] font-medium text-tertiary">
              Sankey Delta
            </span>
          </div>
          <p className="text-[11px] text-outline">
            Credit flow from last-touch baseline → Markov multi-touch · hover a channel to isolate
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3 font-mono text-[10px]">
          <span className="flex items-center gap-1.5 text-outline">
            <span className="size-2.5 rounded-sm bg-surface-container-highest" /> Last-Touch
          </span>
          <span className="flex items-center gap-1.5 text-primary">
            <span className="size-2.5 rounded-sm bg-primary-container" /> + Markov credit
          </span>
          <span className="flex items-center gap-1.5 text-alert-rose">
            <span className="size-2.5 rounded-sm bg-alert-rose" /> − Overcredited
          </span>
        </div>
      </div>

      <div className="relative overflow-hidden rounded-lg bg-obsidian-base p-3">
        <div className="pointer-events-none absolute -top-16 -right-16 size-56 rounded-full bg-primary-container/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-16 -left-16 size-56 rounded-full bg-tertiary/10 blur-3xl" />

        <div className="relative z-10 mb-2 flex justify-between px-1 font-mono text-[10px] tracking-wider text-outline uppercase">
          <span>Last-Touch Base</span>
          <span className="text-tertiary">Credit re-allocation</span>
          <span>Markov v4.4</span>
        </div>

        <svg
          viewBox={`0 0 ${layout.W} ${layout.H}`}
          className="relative z-10 h-auto w-full"
          role="img"
          aria-label="Touchpoint re-allocation Sankey"
        >
          <defs>
            {layout.flows.map((f) => (
              <linearGradient key={f.id} id={`flow-${f.id}`} x1="0%" y1="0%" x2="100%" y2="0%">
                <stop
                  offset="0%"
                  stopColor={f.color}
                  stopOpacity={f.delta >= 0 ? 0.35 : 0.22}
                />
                <stop
                  offset="100%"
                  stopColor={f.delta >= 0 ? "#f97316" : "#f43f5e"}
                  stopOpacity={f.delta >= 0 ? 0.55 : 0.45}
                />
              </linearGradient>
            ))}
          </defs>

          {/* Center axis guide */}
          <line
            x1={380}
            x2={380}
            y1={8}
            y2={layout.H - 8}
            stroke="rgba(255,255,255,0.06)"
            strokeDasharray="4 4"
          />

          {layout.flows.map((f) => {
            const dim = hover && hover !== f.id;
            return (
              <path
                key={f.id}
                d={f.path}
                fill={`url(#flow-${f.id})`}
                className="cursor-pointer transition-opacity duration-200"
                opacity={dim ? 0.12 : hover === f.id ? 0.95 : 0.7}
                onMouseEnter={() => setHover(f.id)}
                onMouseLeave={() => setHover(null)}
              />
            );
          })}

          {layout.nodes.map(({ t, left, right, delta }) => {
            const dim = hover && hover !== t.id;
            const op = dim ? 0.25 : 1;
            return (
              <g
                key={t.id}
                opacity={op}
                className="cursor-pointer transition-opacity duration-200"
                onMouseEnter={() => setHover(t.id)}
                onMouseLeave={() => setHover(null)}
              >
                {/* Left node */}
                <rect
                  x={left.x}
                  y={left.y}
                  width={left.w}
                  height={left.h}
                  rx={6}
                  fill="#1e1f25"
                  stroke={t.color}
                  strokeWidth={1.5}
                  strokeOpacity={0.55}
                />
                <rect
                  x={left.x}
                  y={left.y}
                  width={4}
                  height={left.h}
                  rx={2}
                  fill={t.color}
                />
                <text
                  x={left.x + 12}
                  y={left.y + left.h / 2 - 4}
                  fill="#e3e1e9"
                  fontSize={10}
                  fontFamily="JetBrains Mono, monospace"
                  fontWeight={600}
                >
                  {t.short}
                </text>
                <text
                  x={left.x + 12}
                  y={left.y + left.h / 2 + 10}
                  fill="#a78b7d"
                  fontSize={9}
                  fontFamily="JetBrains Mono, monospace"
                >
                  {t.lastTouch.toFixed(1)}% · {moneyFromPct(t.lastTouch)}
                </text>

                {/* Right node */}
                <rect
                  x={right.x}
                  y={right.y}
                  width={right.w}
                  height={right.h}
                  rx={6}
                  fill="#1e1f25"
                  stroke={delta >= 0 ? "#f97316" : "#f43f5e"}
                  strokeWidth={1.5}
                  strokeOpacity={0.7}
                />
                <rect
                  x={right.x + right.w - 4}
                  y={right.y}
                  width={4}
                  height={right.h}
                  rx={2}
                  fill={delta >= 0 ? "#f97316" : "#f43f5e"}
                />
                <text
                  x={right.x + 12}
                  y={right.y + right.h / 2 - 4}
                  fill="#e3e1e9"
                  fontSize={10}
                  fontFamily="JetBrains Mono, monospace"
                  fontWeight={600}
                >
                  {t.markov.toFixed(1)}%
                </text>
                <text
                  x={right.x + 12}
                  y={right.y + right.h / 2 + 10}
                  fill={delta >= 0 ? "#10b981" : "#f43f5e"}
                  fontSize={9}
                  fontFamily="JetBrains Mono, monospace"
                  fontWeight={600}
                >
                  {delta >= 0 ? "+" : ""}
                  {delta.toFixed(1)}% · {moneyFromPct(t.markov)}
                </text>

                {/* Mid delta chip */}
                <g transform={`translate(352, ${(left.y + left.h / 2 + right.y + right.h / 2) / 2 - 10})`}>
                  <rect
                    width={56}
                    height={20}
                    rx={10}
                    fill={delta >= 0 ? "rgba(16,185,129,0.15)" : "rgba(244,63,94,0.15)"}
                    stroke={delta >= 0 ? "rgba(16,185,129,0.35)" : "rgba(244,63,94,0.35)"}
                  />
                  <text
                    x={28}
                    y={13.5}
                    textAnchor="middle"
                    fill={delta >= 0 ? "#10b981" : "#f43f5e"}
                    fontSize={10}
                    fontFamily="JetBrains Mono, monospace"
                    fontWeight={700}
                  >
                    {delta >= 0 ? "+" : ""}
                    {delta.toFixed(1)}%
                  </text>
                </g>
              </g>
            );
          })}
        </svg>

        {/* Detail row under chart */}
        <div className="relative z-10 mt-3 grid gap-2 border-t border-[var(--border-hairline)] pt-3 sm:grid-cols-2">
          {TOUCHES.map((t) => {
            const delta = t.markov - t.lastTouch;
            const on = !hover || hover === t.id;
            return (
              <button
                key={t.id}
                type="button"
                className={cn(
                  "rounded-lg bg-surface-container px-3 py-2 text-left transition-opacity",
                  on ? "opacity-100" : "opacity-35"
                )}
                onMouseEnter={() => setHover(t.id)}
                onMouseLeave={() => setHover(null)}
              >
                <div className="mb-0.5 flex items-center gap-2">
                  <span className="size-2 rounded-full" style={{ background: t.color }} />
                  <span className="truncate text-[12px] font-medium text-on-surface">{t.label}</span>
                  <span
                    className={cn(
                      "ml-auto shrink-0 rounded px-1.5 py-0.5 font-mono text-[10px] font-semibold",
                      delta >= 0
                        ? "bg-success-emerald/15 text-success-emerald"
                        : "bg-alert-rose/15 text-alert-rose"
                    )}
                  >
                    {delta >= 0 ? "+" : ""}
                    {delta.toFixed(1)}%
                  </span>
                </div>
                {t.note ? (
                  <p className="pl-4 text-[11px] text-outline">
                    <span className="material-symbols-outlined mr-1 align-[-2px] text-[13px] text-tertiary">
                      {t.warn ? "warning" : "info"}
                    </span>
                    {t.note}
                  </p>
                ) : null}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
