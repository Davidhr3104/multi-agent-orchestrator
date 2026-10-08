import { useId, type CSSProperties, type ReactNode } from "react";
import { NODE_H, NODE_W, edgePath, layoutFlow } from "./flow-layout";

/**
 * A read-only "workflow canvas" in the style of Zapier / Make: a card per step with an icon, a title, a
 * subtitle and status chips, joined by curves. Pure SVG + HTML, no dependency, and theme-agnostic (it
 * inherits the text colour). Columns and curves are computed by `layoutFlow`; this file only draws them.
 */

export type FlowChip = { label: string; tone?: "ok" | "bad" | "warn" | "muted" };

export type FlowNode = {
  id: string;
  /** Small uppercase label above the title: Trigger, Data, Send... */
  kind: string;
  title: string;
  subtitle?: string;
  icon?: ReactNode;
  /** warn/bad tint the card border and icon, e.g. a tool that is not connected yet. */
  tone?: "default" | "ok" | "warn" | "bad";
  chips?: FlowChip[];
  /** A button or link shown on the card, e.g. Connect. */
  action?: ReactNode;
  col?: number;
  row?: number;
};

export type FlowEdge = { from: string; to: string; tone?: "default" | "bad" };

const MUTED = "color-mix(in srgb, currentColor 58%, transparent)";
const BORDER = "color-mix(in srgb, currentColor 16%, transparent)";
const TONE: Record<NonNullable<FlowNode["tone"]>, string> = { default: "#8b8bf5", ok: "#34d399", warn: "#fbbf24", bad: "#f87171" };
const CHIP: Record<NonNullable<FlowChip["tone"]>, { fg: string; dot: string }> = {
  ok: { fg: "#34d399", dot: "#34d399" },
  bad: { fg: "#f87171", dot: "#f87171" },
  warn: { fg: "#fbbf24", dot: "#fbbf24" },
  muted: { fg: MUTED, dot: MUTED },
};

export function FlowCanvas({
  nodes,
  edges,
  ariaLabel,
  from = "#f97316",
  to = "#3b82f6",
  style,
}: {
  nodes: readonly FlowNode[];
  edges: readonly FlowEdge[];
  ariaLabel: string;
  /** Gradient of the connecting curves, start to end. */
  from?: string;
  to?: string;
  style?: CSSProperties;
}) {
  const uid = useId().replace(/:/g, "");
  if (nodes.length === 0) {
    return (
      <div role="group" aria-label={ariaLabel} style={{ border: `1px dashed ${BORDER}`, borderRadius: 16, padding: 24, textAlign: "center", fontSize: 12, color: MUTED, ...style }}>
        No steps yet
      </div>
    );
  }

  const layout = layoutFlow(nodes, edges);
  const drawn = edges.flatMap((e) => {
    const a = layout.positions.get(e.from);
    const b = layout.positions.get(e.to);
    return a && b ? [{ e, a, b }] : [];
  });

  return (
    <div
      role="group"
      aria-label={ariaLabel}
      style={{
        overflowX: "auto",
        border: `1px solid ${BORDER}`,
        borderRadius: 16,
        backgroundImage: `radial-gradient(color-mix(in srgb, currentColor 13%, transparent) 1px, transparent 1px)`,
        backgroundSize: "20px 20px",
        ...style,
      }}
    >
      <div style={{ position: "relative", width: layout.width, height: layout.height, minWidth: "100%" }}>
        <svg width={layout.width} height={layout.height} aria-hidden style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
          <defs>
            {drawn
              .filter(({ e }) => e.tone !== "bad")
              .map(({ a, b }, i) => (
                <linearGradient key={i} id={`${uid}-g${i}`} gradientUnits="userSpaceOnUse" x1={a.x + NODE_W} y1={0} x2={b.x} y2={0}>
                  <stop offset="0%" stopColor={from} />
                  <stop offset="100%" stopColor={to} />
                </linearGradient>
              ))}
          </defs>
          {(() => {
            let g = -1;
            return drawn.map(({ e, a, b }, i) => {
              const bad = e.tone === "bad";
              if (!bad) g += 1;
              const stroke = bad ? "#f87171" : `url(#${uid}-g${g})`;
              const end = bad ? "#f87171" : to;
              return (
                <g key={i}>
                  <path d={edgePath(a, b)} fill="none" stroke={stroke} strokeWidth={2} strokeLinecap="round" strokeDasharray={bad ? "5 5" : undefined} opacity={bad ? 0.7 : 0.95} />
                  <circle cx={b.x > a.x ? b.x : b.x + NODE_W / 2} cy={b.x > a.x ? b.y + NODE_H / 2 : b.y} r={3.5} fill={end} />
                </g>
              );
            });
          })()}
        </svg>
        {nodes.map((n) => {
          const p = layout.positions.get(n.id);
          if (!p) return null;
          const tone = TONE[n.tone ?? "default"];
          return (
            <article
              key={n.id}
              aria-label={`${n.kind}: ${n.title}`}
              style={{
                position: "absolute",
                left: p.x,
                top: p.y,
                width: NODE_W,
                height: NODE_H,
                boxSizing: "border-box",
                padding: 12,
                borderRadius: 16,
                border: `1px solid ${n.tone && n.tone !== "default" ? tone : BORDER}`,
                background: "color-mix(in srgb, currentColor 5%, transparent)",
                backdropFilter: "blur(6px)",
                boxShadow: "0 8px 24px -12px rgba(0,0,0,.55)",
                display: "flex",
                flexDirection: "column",
                gap: 6,
                overflow: "hidden",
              }}
            >
              <header style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                <span aria-hidden style={{ display: "inline-flex", width: 28, height: 28, flex: "none", alignItems: "center", justifyContent: "center", borderRadius: 8, color: tone, background: `color-mix(in srgb, ${tone} 16%, transparent)` }}>
                  {n.icon}
                </span>
                <div style={{ minWidth: 0 }}>
                  <p style={{ margin: 0, fontSize: 9, fontWeight: 700, letterSpacing: ".12em", textTransform: "uppercase", color: MUTED }}>{n.kind}</p>
                  <h3 style={{ margin: 0, fontSize: 13, fontWeight: 600, lineHeight: 1.2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }} title={n.title}>
                    {n.title}
                  </h3>
                </div>
              </header>
              {n.subtitle ? (
                <p style={{ margin: 0, fontSize: 11, lineHeight: 1.3, color: MUTED, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }} title={n.subtitle}>
                  {n.subtitle}
                </p>
              ) : null}
              {n.chips?.length || n.action ? (
                <footer style={{ marginTop: "auto", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6, flexWrap: "wrap" }}>
                  <span style={{ display: "inline-flex", flexWrap: "wrap", gap: 4 }}>
                    {n.chips?.map((c) => {
                      const t = CHIP[c.tone ?? "muted"];
                      return (
                        <span key={c.label} style={{ display: "inline-flex", alignItems: "center", gap: 4, borderRadius: 999, border: `1px solid ${BORDER}`, padding: "1px 8px", fontSize: 10, fontWeight: 600, color: t.fg, background: "color-mix(in srgb, currentColor 6%, transparent)" }}>
                          <span aria-hidden style={{ width: 5, height: 5, borderRadius: "50%", background: t.dot }} />
                          {c.label}
                        </span>
                      );
                    })}
                  </span>
                  {n.action ? <span style={{ fontSize: 11, fontWeight: 600 }}>{n.action}</span> : null}
                </footer>
              ) : null}
            </article>
          );
        })}
      </div>
    </div>
  );
}
