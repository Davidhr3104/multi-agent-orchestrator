import type { CSSProperties, ReactNode } from "react";
import { Sparkline } from "./charts";

const MUTED = "color-mix(in srgb, currentColor 55%, transparent)";
const BORDER = "color-mix(in srgb, currentColor 14%, transparent)";

/** Honest labelling for sample data. Every chart fed by the demo seed should carry one of these. */
export function DemoChip({ kind = "demo" }: { kind?: "demo" | "illustrative" }) {
  return (
    <span
      title={kind === "demo" ? "Sample data from the demo desk" : "Illustrative only: not computed from this desk's data"}
      style={{ display: "inline-flex", alignItems: "center", borderRadius: 999, padding: "1px 8px", fontSize: 10, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", background: "rgba(245,158,11,.12)", color: "#fbbf24", border: "1px solid rgba(245,158,11,.3)" }}
    >
      {kind === "demo" ? "Demo data" : "Illustrative"}
    </span>
  );
}

/** Card frame for a chart: title, optional demo chip, the chart, and a one-line "where this number comes from". */
export function ChartCard({ title, subtitle, demo, illustrative, source, action, children, style }: { title: string; subtitle?: string; demo?: boolean; illustrative?: boolean; source?: string; action?: ReactNode; children: ReactNode; style?: CSSProperties }) {
  return (
    <section style={{ border: `1px solid ${BORDER}`, borderRadius: 14, padding: 16, background: "color-mix(in srgb, currentColor 3%, transparent)", minWidth: 0, ...style }}>
      <header style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10, marginBottom: 12 }}>
        <div style={{ minWidth: 0 }}>
          <h3 style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>{title}</h3>
          {subtitle ? <p style={{ margin: "2px 0 0", fontSize: 12, color: MUTED }}>{subtitle}</p> : null}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flex: "none" }}>
          {illustrative ? <DemoChip kind="illustrative" /> : demo ? <DemoChip /> : null}
          {action}
        </div>
      </header>
      {children}
      {source ? <p style={{ margin: "12px 0 0", fontSize: 11, color: MUTED }}>{source}</p> : null}
    </section>
  );
}

export type Delta = { value: number; label?: string; goodWhen?: "up" | "down" };

/** KPI tile: label, big tabular value, optional sparkline and delta, and a provenance hint. */
export function KpiCard({ label, value, hint, icon, accent = "#c9a24b", spark, delta }: { label: string; value: ReactNode; hint?: string; icon?: ReactNode; accent?: string; spark?: readonly number[]; delta?: Delta }) {
  const up = delta ? delta.value >= 0 : false;
  const good = delta ? (delta.goodWhen === "down" ? !up : up) : false;
  return (
    <div style={{ position: "relative", overflow: "hidden", border: `1px solid ${BORDER}`, borderRadius: 14, padding: 16, background: "color-mix(in srgb, currentColor 3%, transparent)", minWidth: 0 }}>
      <div aria-hidden style={{ position: "absolute", top: -34, right: -34, width: 110, height: 110, borderRadius: "50%", background: accent, opacity: 0.12, filter: "blur(22px)" }} />
      <div style={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <p style={{ margin: 0, fontSize: 11, fontWeight: 600, letterSpacing: ".14em", textTransform: "uppercase", color: MUTED }}>{label}</p>
        {icon ? <span style={{ color: accent, display: "inline-flex" }}>{icon}</span> : null}
      </div>
      <div style={{ position: "relative", display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 10, marginTop: 8 }}>
        <p style={{ margin: 0, fontSize: 30, fontWeight: 700, lineHeight: 1.05, fontVariantNumeric: "tabular-nums" }}>{value}</p>
        {spark && spark.length > 1 ? <Sparkline values={spark} color={accent} label={`${label} trend`} /> : null}
      </div>
      <p style={{ position: "relative", margin: "6px 0 0", fontSize: 12, color: MUTED, display: "flex", flexWrap: "wrap", gap: "2px 8px" }}>
        {delta && Number.isFinite(delta.value) ? (
          <span style={{ color: delta.value === 0 ? MUTED : good ? "#34d399" : "#f87171", fontWeight: 600 }}>
            {delta.value === 0 ? "=" : up ? "▲" : "▼"} {Math.abs(delta.value)}%{delta.label ? ` ${delta.label}` : ""}
          </span>
        ) : null}
        {hint ? <span>{hint}</span> : null}
      </p>
    </div>
  );
}

/** Initials avatar with a colour that is stable for a given name. */
const AVATAR_TONES = ["#d97706", "#4f46e5", "#0d9488", "#e11d48", "#7c3aed", "#475569"];
export function Avatar({ name, size = 36 }: { name: string; size?: number }) {
  const initials = name.split(/\s+/).filter(Boolean).map((w) => w[0]).slice(0, 2).join("").toUpperCase() || "?";
  const tone = AVATAR_TONES[[...name].reduce((s, c) => s + c.charCodeAt(0), 0) % AVATAR_TONES.length];
  return (
    <span aria-hidden style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: size, height: size, borderRadius: "50%", background: `linear-gradient(135deg, ${tone}, ${tone}99)`, color: "#fff", fontSize: size / 3, fontWeight: 600, flex: "none", boxShadow: "inset 0 0 0 1px rgba(255,255,255,.18)" }}>
      {initials}
    </span>
  );
}

/** Generative cover: a two-colour gradient with a soft grid, for records that have no photo. Never passed off as the real image. */
export function CoverArt({ colors, height = 120, children, label }: { colors: readonly [string, string]; height?: number; children?: ReactNode; label?: string }) {
  return (
    <div role={label ? "img" : undefined} aria-label={label} style={{ position: "relative", height, overflow: "hidden", borderRadius: 12, background: `linear-gradient(135deg, ${colors[0]}, ${colors[1]})` }}>
      <div aria-hidden style={{ position: "absolute", inset: 0, backgroundImage: "linear-gradient(rgba(255,255,255,.07) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.07) 1px, transparent 1px)", backgroundSize: "22px 22px" }} />
      <div style={{ position: "relative", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "rgba(255,255,255,.85)" }}>{children}</div>
    </div>
  );
}
