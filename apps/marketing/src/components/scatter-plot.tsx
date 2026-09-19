"use client";

import { useMemo, useState, type PointerEvent } from "react";
import type { StoredCampaign } from "@helix/core";
import { compactCount, median, money, recLabel, recTone } from "@/lib/format";

const LEFT = 60;
const RIGHT = 680;
const TOP = 20;
const BOTTOM = 210;

function scoreToY(score: number) {
  const stops: [number, number][] = [
    [100, 20],
    [70, 70],
    [50, 115],
    [35, 155],
    [0, 210],
  ];
  const s = Math.max(0, Math.min(100, score));
  for (let i = 0; i < stops.length - 1; i += 1) {
    const [s1, y1] = stops[i];
    const [s0, y0] = stops[i + 1];
    if (s <= s1 && s >= s0) {
      const t = (s1 - s0) === 0 ? 0 : (s - s0) / (s1 - s0);
      return y0 + t * (y1 - y0);
    }
  }
  return BOTTOM;
}

function spendToX(spend: number, maxSpend: number) {
  const max = Math.max(100, maxSpend);
  return LEFT + (spend / max) * (RIGHT - LEFT);
}

function bubbleR(forms: number) {
  return Math.max(5, Math.min(12, 4.2 + Math.sqrt(Math.max(0, forms)) * 0.55));
}

export function ScatterPlot({
  campaigns,
  onSelect,
}: {
  campaigns: StoredCampaign[];
  onSelect: (id: string) => void;
}) {
  const [tip, setTip] = useState<{
    x: number;
    y: number;
    c: StoredCampaign;
  } | null>(null);

  const { maxSpend, midSpend, ticks } = useMemo(() => {
    const spends = campaigns.map((c) => c.spend);
    const rawMax = spends.length === 0 ? 2600 : Math.max(...spends);
    const maxSpend = Math.max(2600, Math.ceil(rawMax / 100) * 100);
    return {
      maxSpend,
      midSpend: median(spends),
      ticks: [0, 0.25, 0.5, 0.75, 1].map((t) => t * maxSpend),
    };
  }, [campaigns]);

  function moveTip(e: PointerEvent<SVGElement>, c: StoredCampaign) {
    const svg = e.currentTarget.ownerSVGElement;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    setTip({
      x: Math.min(e.clientX - rect.left + 14, rect.width - 220),
      y: Math.max(10, e.clientY - rect.top - 38),
      c,
    });
  }

  const midX = spendToX(midSpend, maxSpend);

  return (
    <div className="relative h-64 w-full select-none rounded-lg border border-white/[0.06] bg-[#08090d] p-3">
      <svg className="h-full w-full" viewBox="0 0 700 240" onPointerLeave={() => setTip(null)}>
        <defs>
          <linearGradient id="scaleZone" x1="0%" x2="0%" y1="0%" y2="100%">
            <stop offset="0%" stopColor="#3BAF7E" stopOpacity="0.08" />
            <stop offset="100%" stopColor="#3BAF7E" stopOpacity="0.01" />
          </linearGradient>
          <linearGradient id="drainZone" x1="0%" x2="0%" y1="0%" y2="100%">
            <stop offset="0%" stopColor="#D9605F" stopOpacity="0.01" />
            <stop offset="100%" stopColor="#D9605F" stopOpacity="0.08" />
          </linearGradient>
        </defs>
        <rect fill="url(#scaleZone)" height="55" width="620" x="60" y="15" />
        <rect fill="url(#drainZone)" height="55" width="465" x="215" y="155" />
        <text fill="rgba(255,255,255,0.06)" fontFamily="Inter, sans-serif" fontSize="11" fontWeight="600" x="68" y="32">
          OVER-PERFORMING · SCALE
        </text>
        <text
          fill="rgba(255,255,255,0.06)"
          fontFamily="Inter, sans-serif"
          fontSize="11"
          fontWeight="600"
          textAnchor="end"
          x="672"
          y="32"
        >
          HEALTHY AT SCALE
        </text>
        <text fill="rgba(255,255,255,0.06)" fontFamily="Inter, sans-serif" fontSize="11" fontWeight="600" x="68" y="200">
          LOW SIGNAL · WATCH
        </text>
        <text
          fill="rgba(255,255,255,0.06)"
          fontFamily="Inter, sans-serif"
          fontSize="11"
          fontWeight="600"
          textAnchor="end"
          x="672"
          y="200"
        >
          DRAIN · PAUSE NOW
        </text>
        <line stroke="rgba(255,255,255,0.05)" x1="60" x2="680" y1="20" y2="20" />
        <line stroke="#3BAF7E" strokeDasharray="4 4" strokeOpacity="0.3" x1="60" x2="680" y1="70" y2="70" />
        <line stroke="rgba(255,255,255,0.05)" x1="60" x2="680" y1="115" y2="115" />
        <line stroke="#D9605F" strokeDasharray="4 4" strokeOpacity="0.3" x1="60" x2="680" y1="155" y2="155" />
        <line stroke="rgba(255,255,255,0.08)" x1="60" x2="680" y1="210" y2="210" />
        <line stroke="rgba(255,255,255,0.08)" x1="60" x2="60" y1="15" y2="210" />
        <line stroke="rgba(255,255,255,0.18)" strokeDasharray="3 3" x1={midX} x2={midX} y1="15" y2="210" />
        <line stroke="rgba(255,255,255,0.05)" x1="370" x2="370" y1="15" y2="210" />
        <line stroke="rgba(255,255,255,0.05)" x1="525" x2="525" y1="15" y2="210" />
        <line stroke="rgba(255,255,255,0.05)" x1="680" x2="680" y1="15" y2="210" />
        <text fill="#9CA3AF" fontFamily="JetBrains Mono, monospace" fontSize="10" textAnchor="end" x="52" y="24">
          100
        </text>
        <text fill="#9CA3AF" fontFamily="JetBrains Mono, monospace" fontSize="10" textAnchor="end" x="52" y="74">
          70
        </text>
        <text fill="#6B7280" fontFamily="JetBrains Mono, monospace" fontSize="10" textAnchor="end" x="52" y="119">
          50
        </text>
        <text fill="#9CA3AF" fontFamily="JetBrains Mono, monospace" fontSize="10" textAnchor="end" x="52" y="159">
          35
        </text>
        <text fill="#6B7280" fontFamily="JetBrains Mono, monospace" fontSize="10" textAnchor="end" x="52" y="213">
          0
        </text>
        <text fill="#3BAF7E" fontFamily="Inter, sans-serif" fontSize="10" fontWeight="500" textAnchor="end" x="670" y="66">
          scale ≥ 70
        </text>
        <text fill="#D9605F" fontFamily="Inter, sans-serif" fontSize="10" fontWeight="500" textAnchor="end" x="670" y="151">
          pause ≤ 35
        </text>
        <text fill="#9CA3AF" fontFamily="Inter, sans-serif" fontSize="10" textAnchor="middle" x={midX} y="12">
          median spend ({money(midSpend)})
        </text>
        {ticks.map((tick, i) => (
          <text
            key={tick}
            fill={i === 0 || i === ticks.length - 1 ? "#9CA3AF" : "#6B7280"}
            fontFamily="JetBrains Mono, monospace"
            fontSize="10"
            textAnchor={i === 0 ? "start" : i === ticks.length - 1 ? "end" : "middle"}
            x={spendToX(tick, maxSpend)}
            y="226"
          >
            {money(tick)}
          </text>
        ))}
        {campaigns.map((c) => {
          const tone = recTone(c.action);
          const x = spendToX(c.spend, maxSpend);
          const y = scoreToY(c.metrics.avgScore);
          const r = bubbleR(c.metrics.formLeads);
          return (
            <g
              key={c.id}
              className="cursor-pointer"
              transform={`translate(${x}, ${y})`}
              onClick={() => onSelect(c.id)}
              onPointerEnter={(e) => moveTip(e, c)}
              onPointerMove={(e) => moveTip(e, c)}
            >
              <circle cx="0" cy="0" fill={tone.hex} fillOpacity="0.9" r={r} stroke={tone.stroke} strokeWidth="1.5" />
              <circle cx="0" cy="0" fill="transparent" r={r + 10} />
            </g>
          );
        })}
      </svg>
      {tip ? (
        <div
          className="pointer-events-none absolute z-30 rounded-lg border border-white/[0.18] bg-[#161a24] p-2.5 text-xs text-white shadow-2xl"
          style={{ left: tip.x, top: tip.y }}
        >
          <div className="mb-1.5 flex items-center gap-2 border-b border-white/10 pb-1.5 font-medium">
            <span>{tip.c.name}</span>
            <span className="rounded-full bg-white/[0.06] px-2 py-0.5 text-[10px]" style={{ color: recTone(tip.c.action).hex }}>
              {recLabel(tip.c)}
            </span>
          </div>
          <div className="grid grid-cols-3 gap-3 text-[11px] text-[#9CA3AF]">
            <div>
              Spend: <span className="font-mono font-medium text-white">{money(tip.c.spend)}</span>
            </div>
            <div>
              Score: <span className="font-mono font-medium text-white">{tip.c.metrics.avgScore.toFixed(2)}</span>
            </div>
            <div>
              Forms: <span className="font-mono font-medium text-white">{compactCount(tip.c.metrics.formLeads)}</span>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
