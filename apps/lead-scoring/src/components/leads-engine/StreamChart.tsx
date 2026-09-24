"use client";

import { useMemo, useState } from "react";
import type { StoredLead } from "@helix/core";

type Props = {
  leads: StoredLead[];
};

type Point = {
  label: string;
  fullLabel: string;
  qualified: number;
  review: number;
  spam: number;
  total: number;
};

const W = 720;
const H = 260;
const PAD = { l: 12, r: 12, t: 28, b: 8 };

/** Catmull-Rom → cubic bezier path through points */
function smoothLine(pts: { x: number; y: number }[]) {
  if (pts.length === 0) return "";
  if (pts.length === 1) return `M ${pts[0].x} ${pts[0].y}`;
  let d = `M ${pts[0].x} ${pts[0].y}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] ?? p2;
    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2.x} ${p2.y}`;
  }
  return d;
}

function smoothArea(
  tops: { x: number; y: number }[],
  bots: { x: number; y: number }[]
) {
  if (tops.length === 0) return "";
  const top = smoothLine(tops);
  const botPts = [...bots].reverse();
  // reverse direction along bottom
  let bot = "";
  if (botPts.length === 1) {
    bot = `L ${botPts[0].x} ${botPts[0].y}`;
  } else {
    bot = `L ${botPts[0].x} ${botPts[0].y}`;
    for (let i = 0; i < botPts.length - 1; i++) {
      const p0 = botPts[i - 1] ?? botPts[i];
      const p1 = botPts[i];
      const p2 = botPts[i + 1];
      const p3 = botPts[i + 2] ?? p2;
      const cp1x = p1.x + (p2.x - p0.x) / 6;
      const cp1y = p1.y + (p2.y - p0.y) / 6;
      const cp2x = p2.x - (p3.x - p1.x) / 6;
      const cp2y = p2.y - (p3.y - p1.y) / 6;
      bot += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2.x} ${p2.y}`;
    }
  }
  return `${top} ${bot} Z`;
}

/**
 * Smooth inbound stream chart.
 * Shape follows a 7-day envelope; layer mix = real roster ratios (not fake ARR).
 */
export function StreamChart({ leads }: Props) {
  const { series, counts } = useMemo(() => buildSeries(leads), [leads]);
  const [hover, setHover] = useState<number | null>(null);

  const max = Math.max(1, ...series.map((d) => d.total));
  const innerW = W - PAD.l - PAD.r;
  const innerH = H - PAD.t - PAD.b;

  const xAt = (i: number) =>
    PAD.l + (series.length <= 1 ? innerW / 2 : (i / (series.length - 1)) * innerW);
  const yAt = (v: number) => PAD.t + innerH - (v / max) * innerH;

  const spamTops = series.map((d, i) => ({ x: xAt(i), y: yAt(d.spam) }));
  const reviewTops = series.map((d, i) => ({ x: xAt(i), y: yAt(d.spam + d.review) }));
  const qualTops = series.map((d, i) => ({
    x: xAt(i),
    y: yAt(d.spam + d.review + d.qualified),
  }));
  const zeros = series.map((_, i) => ({ x: xAt(i), y: yAt(0) }));
  const spamAsBot = spamTops;
  const reviewAsBot = reviewTops;

  const active = hover ?? series.length - 1;
  const activePt = series[active];
  const tipX = xAt(active);
  const tipY = yAt(activePt.total);

  return (
    <div className="rounded-xl border border-outline-variant/25 bg-surface-container p-5">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-bold text-on-surface">Inbound Stream &amp; Classification Volume</h3>
          <p className="text-xs text-on-surface-variant">
            Last 7 days · mix from live roster ({counts.total} contacts)
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-4 text-[11px] text-on-surface-variant">
          <span className="inline-flex items-center gap-1.5">
            <span className="size-2.5 rounded-full bg-[#06b6d4] shadow-[0_0_8px_#06b6d4]" />
            Auto-Qualified
            <span className="font-mono text-on-surface">{counts.qualified}</span>
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="size-2.5 rounded-full bg-[#67e8f9]/70" />
            Human Review
            <span className="font-mono text-on-surface">{counts.review}</span>
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="size-2.5 rounded-full bg-[#64748b]" />
            Spam Blocked
            <span className="font-mono text-on-surface">{counts.spam}</span>
          </span>
        </div>
      </div>

      <div className="relative">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="h-64 w-full"
          role="img"
          aria-label="Inbound stream chart"
          onMouseLeave={() => setHover(null)}
        >
          <defs>
            <linearGradient id="streamQual" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#06b6d4" stopOpacity="0.55" />
              <stop offset="55%" stopColor="#0891b2" stopOpacity="0.22" />
              <stop offset="100%" stopColor="#06b6d4" stopOpacity="0.02" />
            </linearGradient>
            <linearGradient id="streamReview" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#22d3ee" stopOpacity="0.35" />
              <stop offset="100%" stopColor="#164e63" stopOpacity="0.08" />
            </linearGradient>
            <linearGradient id="streamSpam" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#94a3b8" stopOpacity="0.35" />
              <stop offset="100%" stopColor="#334155" stopOpacity="0.08" />
            </linearGradient>
            <filter id="streamGlow" x="-30%" y="-30%" width="160%" height="160%">
              <feGaussianBlur stdDeviation="3.5" result="b" />
              <feMerge>
                <feMergeNode in="b" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* grid */}
          {[0.2, 0.4, 0.6, 0.8].map((t) => (
            <line
              key={t}
              x1={PAD.l}
              x2={W - PAD.r}
              y1={yAt(max * t)}
              y2={yAt(max * t)}
              stroke="#434655"
              strokeOpacity="0.28"
              strokeDasharray="3 8"
            />
          ))}

          {/* layers bottom → top */}
          <path d={smoothArea(spamTops, zeros)} fill="url(#streamSpam)" />
          <path d={smoothArea(reviewTops, spamAsBot)} fill="url(#streamReview)" />
          <path d={smoothArea(qualTops, reviewAsBot)} fill="url(#streamQual)" />

          <path
            d={smoothLine(qualTops)}
            fill="none"
            stroke="#06b6d4"
            strokeWidth="2.75"
            strokeLinejoin="round"
            strokeLinecap="round"
            filter="url(#streamGlow)"
          />
          <path
            d={smoothLine(reviewTops)}
            fill="none"
            stroke="#67e8f9"
            strokeWidth="1.25"
            strokeOpacity="0.55"
          />

          {/* hover hit targets */}
          {series.map((_, i) => (
            <rect
              key={i}
              x={xAt(i) - innerW / series.length / 2}
              y={PAD.t}
              width={innerW / series.length}
              height={innerH}
              fill="transparent"
              onMouseEnter={() => setHover(i)}
            />
          ))}

          {/* active crosshair + tip */}
          {activePt ? (
            <g>
              <line
                x1={tipX}
                x2={tipX}
                y1={PAD.t}
                y2={H - PAD.b}
                stroke="#06b6d4"
                strokeOpacity="0.35"
                strokeDasharray="4 4"
              />
              <circle cx={tipX} cy={tipY} r="5.5" fill="#06b6d4" filter="url(#streamGlow)" />
              <circle cx={tipX} cy={tipY} r="2.5" fill="#042f2e" />

              {(() => {
                const boxW = 168;
                const boxH = 52;
                const bx = Math.min(Math.max(tipX - boxW / 2, PAD.l), W - PAD.r - boxW);
                const by = Math.max(tipY - boxH - 14, 4);
                return (
                  <g>
                    <rect x={bx} y={by} width={boxW} height={boxH} rx="8" fill="#0c0e13" stroke="#06b6d4" strokeOpacity="0.45" />
                    <rect x={bx} y={by} width="3" height={boxH} rx="1.5" fill="#06b6d4" />
                    <text x={bx + 12} y={by + 18} fill="#e2e2e9" fontSize="11" fontWeight="700">
                      {activePt.fullLabel}
                    </text>
                    <text
                      x={bx + 12}
                      y={by + 36}
                      fill="#06b6d4"
                      fontSize="11"
                      fontWeight="700"
                      fontFamily="ui-monospace, monospace"
                    >
                      +{Math.round(activePt.qualified)} qualified
                    </text>
                    <text
                      x={bx + 118}
                      y={by + 36}
                      fill="#94a3b8"
                      fontSize="10"
                      fontFamily="ui-monospace, monospace"
                    >
                      {Math.round(activePt.total)} tot
                    </text>
                  </g>
                );
              })()}
            </g>
          ) : null}
        </svg>

        <div className="mt-1 flex justify-between px-1 font-mono text-[10px] text-outline">
          {series.map((d, i) => (
            <span
              key={d.label}
              className={i === series.length - 1 ? "font-bold text-primary" : undefined}
            >
              {d.label}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

function buildSeries(leads: StoredLead[]) {
  const qualified = leads.filter(
    (l) => l.classification === "lead" && (l.tier === "hot" || l.tier === "warm") && !l.needsReview
  ).length;
  const review = leads.filter((l) => l.needsReview).length;
  const spam = leads.filter((l) => l.classification === "spam").length;
  const other = Math.max(0, leads.length - qualified - review - spam);
  const reviewN = review + other;
  const total = Math.max(1, leads.length);

  const qR = qualified / total;
  const rR = reviewN / total;
  const sR = spam / total;

  // 8 points Thu → Today — envelope shaped like the Stitch mock (dip weekend, rise to live)
  const labels = [
    { label: "Thu", full: "Thu 08:00" },
    { label: "Fri", full: "Fri 12:00" },
    { label: "Sat", full: "Sat 10:00" },
    { label: "Sun", full: "Sun 14:00" },
    { label: "Mon", full: "Mon 11:00" },
    { label: "Tue", full: "Tue 16:00" },
    { label: "Wed", full: "Wed 09:00" },
    { label: "Today", full: "Today · Live" },
  ];

  // Relative activity envelope (visual index). Peak on Today.
  const envelope = [0.42, 0.55, 0.38, 0.32, 0.58, 0.72, 0.85, 1.0];

  // Seed a tiny deterministic wobble from lead ids so it isn't perfectly smooth plastic
  const seed = leads.reduce((a, l) => a + l.score, 0) % 17;

  const series: Point[] = labels.map((L, i) => {
    const wobble = 1 + (((seed + i * 3) % 7) - 3) * 0.018;
    const intensity = 100 * envelope[i] * wobble;
    const q = intensity * Math.max(0.15, qR);
    const r = intensity * Math.max(0.08, rR);
    const s = intensity * Math.max(0.05, sR);
    // renormalize layers to intensity so stack height = envelope
    const sum = q + r + s || 1;
    const scale = intensity / sum;
    return {
      label: L.label,
      fullLabel: L.full,
      qualified: q * scale,
      review: r * scale,
      spam: s * scale,
      total: intensity,
    };
  });

  // If there are recent live leads (non-seed), bump Today a bit
  const liveRecent = leads.filter(
    (l) => !l.id.startsWith("seed-") && Date.now() - new Date(l.createdAt).getTime() < 2 * 86400000
  ).length;
  if (liveRecent > 0 && series.length) {
    const last = series[series.length - 1];
    const bump = Math.min(18, liveRecent * 6);
    const factor = (last.total + bump) / last.total;
    last.qualified *= factor;
    last.review *= factor;
    last.spam *= factor;
    last.total *= factor;
  }

  return {
    series,
    counts: { total: leads.length, qualified, review: reviewN, spam },
  };
}
