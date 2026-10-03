import { useId, type ReactNode } from "react";
import { DEFAULT_COLORS, TONE_COLOR, areaPath, clamp01, compact, healthTone, linePath, ringSegment, seriesPoints, sliceAngles, type Slice } from "./chart-math";

/**
 * Charts are plain SVG that inherit text colour (`currentColor`) for labels and take explicit colours
 * for data, so they drop into any Helix theme without needing its tokens. Every chart carries a
 * role="img" label summarising its values for screen readers.
 *
 * This file must stay free of state/effects and browser APIs: these charts render in Server Components,
 * which also lets callers pass function props such as HBarList's `format`. Interactive charts go in
 * their own "use client" module (see area-chart.tsx).
 */

const MUTED = "color-mix(in srgb, currentColor 55%, transparent)";

const finite = (n: number) => (Number.isFinite(n) ? n : 0);

export function Sparkline({ values, color = DEFAULT_COLORS[0], label, width = 88, height = 30 }: { values: readonly number[]; color?: string; label: string; width?: number; height?: number }) {
  const gid = useId();
  if (values.length < 2) return null;
  const clean = values.map(finite);
  const pts = seriesPoints(clean, width, height, 3, undefined, Math.min(0, ...clean));
  const last = pts[pts.length - 1];
  return (
    <svg viewBox={`0 0 ${width} ${height}`} width={width} height={height} role="img" aria-label={label} style={{ color }}>
      <defs>
        <linearGradient id={gid} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="currentColor" stopOpacity="0.35" />
          <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={areaPath(pts, height)} fill={`url(#${gid})`} />
      <path d={linePath(pts)} fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={last[0]} cy={last[1]} r={2.2} fill="currentColor" />
    </svg>
  );
}

export function EmptyChart({ label, height = 120 }: { label: string; height?: number }) {
  return (
    <div style={{ height, display: "flex", alignItems: "center", justifyContent: "center", border: "1px dashed color-mix(in srgb, currentColor 22%, transparent)", borderRadius: 10, fontSize: 12, color: MUTED }}>
      {label}
    </div>
  );
}

export function Donut({ slices, size = 150, thickness = 26, centerValue, centerLabel, ariaLabel }: { slices: readonly Slice[]; size?: number; thickness?: number; centerValue?: ReactNode; centerLabel?: string; ariaLabel: string }) {
  const arcs = sliceAngles(slices);
  const cx = size / 2;
  const r = size / 2 - 2;
  if (arcs.length === 0) return <EmptyChart label="No data yet" height={size} />;
  return (
    <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 16 }}>
      <div style={{ position: "relative", width: size, height: size, flex: "none" }}>
        <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} role="img" aria-label={ariaLabel}>
          {arcs.map(({ slice, a0, a1 }, i) => (
            <path key={`${slice.label}-${i}`} d={ringSegment(cx, cx, r, r - thickness, a0, arcs.length > 1 && a1 - a0 > 0.05 ? a1 - 0.025 : a1)} fill={slice.color ?? DEFAULT_COLORS[i % DEFAULT_COLORS.length]} />
          ))}
        </svg>
        {centerValue !== undefined ? (
          <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", lineHeight: 1.1 }}>
            <span style={{ fontSize: size / 5, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>{centerValue}</span>
            {centerLabel ? <span style={{ fontSize: 10, color: MUTED, marginTop: 2 }}>{centerLabel}</span> : null}
          </div>
        ) : null}
      </div>
      <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 6, fontSize: 12, minWidth: 0 }}>
        {arcs.map(({ slice, share }, i) => (
          <li key={`${slice.label}-${i}`} style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span aria-hidden style={{ width: 9, height: 9, borderRadius: 3, background: slice.color ?? DEFAULT_COLORS[i % DEFAULT_COLORS.length], flex: "none" }} />
            <span style={{ minWidth: 0 }}>{slice.label}</span>
            <span style={{ marginLeft: "auto", paddingLeft: 10, color: MUTED, fontVariantNumeric: "tabular-nums" }}>
              {compact(slice.value)} · {Math.round(share * 100)}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export type BarItem = { label: string; value: number; color?: string; hint?: string; href?: string };

/** Ranked horizontal bars. `marker` draws a threshold line (e.g. a target or rule) on the same scale. */
export function HBarList({ items, format = (n: number) => compact(n), marker, markerLabel, colorAll }: { items: readonly BarItem[]; format?: (n: number) => string; marker?: number; markerLabel?: string; colorAll?: string }) {
  if (items.length === 0) return <EmptyChart label="No data yet" />;
  const max = Math.max(...items.map((i) => finite(i.value)), finite(marker ?? 0), 1);
  return (
    <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 10 }}>
      {items.map((it, i) => {
        const pct = clamp01(it.value / max) * 100;
        const color = it.color ?? colorAll ?? DEFAULT_COLORS[i % DEFAULT_COLORS.length];
        const label = it.href ? (
          <a href={it.href} style={{ color: "inherit", textDecoration: "none" }}>
            {it.label}
          </a>
        ) : (
          it.label
        );
        return (
          <li key={`${it.label}-${i}`} aria-label={`${it.label}: ${format(it.value)}`}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: 12, marginBottom: 4 }}>
              <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{label}</span>
              <span style={{ fontVariantNumeric: "tabular-nums", color: MUTED, flex: "none" }}>
                {format(it.value)}
                {it.hint ? ` · ${it.hint}` : ""}
              </span>
            </div>
            <div style={{ position: "relative", height: 8, borderRadius: 999, background: "color-mix(in srgb, currentColor 10%, transparent)" }}>
              <div style={{ width: `${pct}%`, height: "100%", borderRadius: 999, background: color, transition: "width .4s ease" }} />
              {marker !== undefined ? <div title={markerLabel} style={{ position: "absolute", left: `${clamp01(marker / max) * 100}%`, top: -3, bottom: -3, width: 2, background: "currentColor", opacity: 0.6 }} /> : null}
            </div>
          </li>
        );
      })}
      {marker !== undefined && markerLabel ? <li style={{ fontSize: 10, color: MUTED }}>│ {markerLabel}</li> : null}
    </ul>
  );
}

export type StackSegment = { label: string; value: number; color: string };

/** A single horizontal bar split into segments, with a legend. Good for risk levels, tiers, statuses. */
export function StackedBar({ segments, ariaLabel }: { segments: readonly StackSegment[]; ariaLabel: string }) {
  const total = segments.reduce((s, x) => s + Math.max(0, finite(x.value)), 0);
  if (total === 0) return <EmptyChart label="No data yet" height={60} />;
  return (
    <div>
      <div role="img" aria-label={ariaLabel} style={{ display: "flex", height: 14, borderRadius: 999, overflow: "hidden", background: "color-mix(in srgb, currentColor 10%, transparent)" }}>
        {segments.map((s, i) =>
          finite(s.value) > 0 ? <div key={`${s.label}-${i}`} title={`${s.label}: ${s.value}`} style={{ width: `${(s.value / total) * 100}%`, background: s.color }} /> : null,
        )}
      </div>
      <ul style={{ listStyle: "none", margin: "10px 0 0", padding: 0, display: "flex", flexWrap: "wrap", gap: "6px 14px", fontSize: 12 }}>
        {segments.map((s, i) => (
          <li key={`${s.label}-${i}`} style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span aria-hidden style={{ width: 8, height: 8, borderRadius: 2, background: s.color }} />
            {s.label} <span style={{ color: MUTED, fontVariantNumeric: "tabular-nums" }}>{s.value}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export type FunnelStep = { label: string; value: number; hint?: string };

/** Funnel with step-to-step conversion. Each bar is sized against the first step. */
export function Funnel({ steps, color = DEFAULT_COLORS[0] }: { steps: readonly FunnelStep[]; color?: string }) {
  if (steps.length === 0 || !(steps[0].value > 0) || !Number.isFinite(steps[0].value)) return <EmptyChart label="No data yet" />;
  const top = steps[0].value;
  return (
    <ol style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 6 }}>
      {steps.map((s, i) => {
        const prev = i ? steps[i - 1].value : null;
        const conv = prev && prev > 0 ? Math.round((s.value / prev) * 100) : null;
        return (
          <li key={`${s.label}-${i}`} aria-label={`${s.label}: ${s.value}${conv !== null ? `, ${conv}% of previous step` : ""}`}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 3 }}>
              <span>{s.label}</span>
              <span style={{ color: MUTED, fontVariantNumeric: "tabular-nums" }}>
                {compact(s.value)}
                {conv !== null ? ` · ${conv}%` : ""}
                {s.hint ? ` · ${s.hint}` : ""}
              </span>
            </div>
            <div style={{ height: 22, width: `${Math.max(4, clamp01(s.value / top) * 100)}%`, borderRadius: 6, background: color, opacity: 1 - i * (0.5 / Math.max(1, steps.length - 1)), transition: "width .4s ease" }} />
          </li>
        );
      })}
    </ol>
  );
}

/** Semicircle gauge. `value` and `max` are on the same scale; `invert` means lower is better (e.g. waste, breaches). */
export function Gauge({ value, max, label, caption, invert = false, size = 150 }: { value: number; max: number; label: string; caption?: string; invert?: boolean; size?: number }) {
  const ratio = clamp01(max > 0 ? value / max : 0);
  const tone = healthTone(invert ? 1 - ratio : ratio);
  const r = size / 2 - 10;
  const cx = size / 2;
  const cy = size / 2 + 6;
  const x = (a: number) => cx + r * Math.cos(Math.PI + a * Math.PI);
  const y = (a: number) => cy + r * Math.sin(Math.PI + a * Math.PI);
  // The arc never sweeps more than 180°, so the large-arc flag is always 0.
  const arc = (to: number) => `M${x(0)},${y(0)} A${r},${r} 0 0 1 ${x(to)},${y(to)}`;
  return (
    <figure style={{ margin: 0, textAlign: "center", width: size }}>
      <svg viewBox={`0 0 ${size} ${size / 2 + 22}`} width={size} height={size / 2 + 22} role="img" aria-label={`${label}: ${value} of ${max}`}>
        <path d={arc(1)} fill="none" stroke="color-mix(in srgb, currentColor 14%, transparent)" strokeWidth={12} strokeLinecap="round" />
        {ratio > 0 ? <path d={arc(Math.max(0.02, ratio))} fill="none" stroke={TONE_COLOR[tone]} strokeWidth={12} strokeLinecap="round" /> : null}
        <text x={cx} y={cy - 4} textAnchor="middle" fontSize={size / 6} fontWeight="700" fill="currentColor" style={{ fontVariantNumeric: "tabular-nums" }}>
          {compact(value)}
        </text>
      </svg>
      <figcaption style={{ fontSize: 12, marginTop: -4 }}>
        {label}
        {caption ? <span style={{ display: "block", fontSize: 10, color: MUTED }}>{caption}</span> : null}
      </figcaption>
    </figure>
  );
}

/** Rows × columns intensity grid (e.g. weekday × hour). Cells with zero stay visible but quiet. */
export function Heatmap({ rows, columns, cells, color = DEFAULT_COLORS[0], ariaLabel }: { rows: readonly string[]; columns: readonly string[]; cells: readonly (readonly number[])[]; color?: string; ariaLabel: string }) {
  if (rows.length === 0 || columns.length === 0) return <EmptyChart label="No data yet" />;
  const max = Math.max(1, ...cells.flat().map(finite));
  return (
    <div role="img" aria-label={ariaLabel} style={{ display: "grid", gridTemplateColumns: `auto repeat(${columns.length}, minmax(0,1fr))`, gap: 3, fontSize: 10, alignItems: "center" }}>
      <span />
      {columns.map((c) => (
        <span key={c} style={{ color: MUTED, textAlign: "center" }}>
          {c}
        </span>
      ))}
      {rows.map((r, ri) => (
        <Row key={r} label={r} values={cells[ri] ?? []} count={columns.length} max={max} color={color} />
      ))}
    </div>
  );
}

function Row({ label, values, count, max, color }: { label: string; values: readonly number[]; count: number; max: number; color: string }) {
  return (
    <>
      <span style={{ color: MUTED, paddingRight: 6 }}>{label}</span>
      {Array.from({ length: count }, (_, i) => {
        const v = finite(values[i] ?? 0);
        return <span key={i} title={`${label} · ${v}`} style={{ height: 18, borderRadius: 4, background: v > 0 ? color : "color-mix(in srgb, currentColor 8%, transparent)", opacity: v > 0 ? 0.25 + 0.75 * (v / max) : 1 }} />;
      })}
    </>
  );
}

/** 0–100 score ring with the number inside. Colour comes from the score, never the only signal: pair it with a text label. */
export function ScoreRing({ score: raw, size = 44, label }: { score: number; size?: number; label?: string }) {
  const score = finite(raw);
  const ratio = clamp01(score / 100);
  const tone = healthTone(ratio);
  const r = size / 2 - 4;
  const c = 2 * Math.PI * r;
  return (
    <span style={{ position: "relative", display: "inline-flex", width: size, height: size }} role="img" aria-label={label ?? `Score ${Math.round(score)} of 100`}>
      <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="color-mix(in srgb, currentColor 14%, transparent)" strokeWidth={4} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={TONE_COLOR[tone]} strokeWidth={4} strokeLinecap="round" strokeDasharray={`${c * ratio} ${c}`} />
      </svg>
      <span style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: size / 3.2, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>{Math.round(score)}</span>
    </span>
  );
}
