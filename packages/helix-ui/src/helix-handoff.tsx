"use client";

import { HelixAvatar, type HelixAvatarDesk, type HelixAvatarState } from "./helix-avatar";
import { cssVersion } from "./css-version";

/**
 * "One Helix contacts others": the requester's avatar and request on top, one row per contacted desk
 * with its own avatar and what it is doing, and an optional result line. It is presentational on
 * purpose: the rows must come from real events (an inter-app event layer does not exist yet), so
 * nothing here invents progress.
 */

export const HELIX_DESK_NAMES: Record<HelixAvatarDesk, string> = {
  leads: "Helix for Leads",
  data: "Helix Data",
  legal: "Helix for Legal",
  commerce: "Helix for Commerce",
  marketing: "Helix for Marketing",
  "real-estate": "Helix for Real Estate",
  social: "Helix for Social",
  inbox: "Helix for Inbox",
};

/** declined = a person said no: a decision, not a failure, so it keeps a calm face */
export type HandoffStatus = "working" | "done" | "held" | "declined" | "error";
export type HandoffStep = { desk: HelixAvatarDesk; text: string; status: HandoffStatus };
export type HandoffResult = { desk: HelixAvatarDesk; text: string; state?: HelixAvatarState };

const STEP_FACE: Record<HandoffStatus, HelixAvatarState> = { working: "thinking", done: "idle", held: "unsure", declined: "idle", error: "error" };

/** The requester's face summarises the steps: a failure, then work in flight, then a human hold. */
export function handoffOverallState(steps: HandoffStep[], hasResult: boolean): HelixAvatarState {
  if (steps.some((s) => s.status === "error")) return "error";
  if (steps.some((s) => s.status === "working")) return "thinking";
  if (steps.some((s) => s.status === "held")) return "unsure";
  if (steps.some((s) => s.status === "declined")) return "idle";
  if (steps.length > 0 && hasResult) return "done";
  return "idle";
}

const CSS = `
@keyframes hxho-dot { 0%, 80%, 100% { opacity: .3; transform: scale(.8); } 40% { opacity: 1; transform: scale(1.2); } }
.hxho-dot { display: inline-block; width: 4px; height: 4px; border-radius: 50%; background: currentColor; animation: hxho-dot 1.2s ease-in-out infinite; }
.hxho-dot:nth-child(2) { animation-delay: .15s; }
.hxho-dot:nth-child(3) { animation-delay: .3s; }
@media (prefers-reduced-motion: reduce) { .hxho-dot { animation: none; opacity: .7; } }
`;

const HANDOFF_STYLE_HREF = `helix-handoff-${cssVersion(CSS)}`;

function StatusMark({ status }: { status: Exclude<HandoffStatus, "working"> }) {
  const common = { width: 16, height: 16, viewBox: "0 0 16 16", fill: "none", role: "img", style: { flex: "none" } } as const;
  if (status === "done")
    return (
      <svg {...common} aria-label="done">
        <circle cx="8" cy="8" r="7" stroke="#4ade80" strokeWidth="1.4" />
        <path d="M5 8.2l2 2 4-4.4" stroke="#4ade80" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  if (status === "held")
    return (
      <svg {...common} aria-label="held for a human">
        <circle cx="8" cy="8" r="7" stroke="#f59e0b" strokeWidth="1.4" />
        <path d="M6.3 5.5v5M9.7 5.5v5" stroke="#f59e0b" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    );
  if (status === "declined")
    return (
      <svg {...common} aria-label="declined">
        <circle cx="8" cy="8" r="7" stroke="#9a9aa8" strokeWidth="1.4" />
        <path d="M5.5 5.5l5 5M10.5 5.5l-5 5" stroke="#9a9aa8" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
    );
  return (
    <svg {...common} aria-label="failed">
      <circle cx="8" cy="8" r="7" stroke="#f87171" strokeWidth="1.4" />
      <path d="M5.5 5.5l5 5M10.5 5.5l-5 5" stroke="#f87171" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

const TEXT_COLOR: Record<HandoffStatus, string> = {
  working: "rgba(255,255,255,0.62)",
  done: "rgba(255,255,255,0.72)",
  held: "#f59e0b",
  declined: "rgba(255,255,255,0.5)",
  error: "#f87171",
};

export function HelixHandoffPanel({
  from,
  request,
  steps,
  result,
  className,
}: {
  /** the desk that started the request */
  from: HelixAvatarDesk;
  request: string;
  steps: HandoffStep[];
  result?: HandoffResult;
  className?: string;
}) {
  return (
    <section role="status" aria-live="polite" aria-label={`${HELIX_DESK_NAMES[from]} is contacting other Helix desks`} className={className} style={{ color: "#f1f1f5" }}>
      <style href={HANDOFF_STYLE_HREF} precedence="default">
        {CSS}
      </style>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 14,
          padding: "10px 16px 10px 12px",
          border: "1px solid rgba(255,255,255,0.12)",
          borderRadius: 20,
          background: "rgba(255,255,255,0.03)",
        }}
      >
        <HelixAvatar desk={from} state={handoffOverallState(steps, Boolean(result))} size={48} decorative />
        <span style={{ fontSize: 16, lineHeight: 1.4, flex: 1, minWidth: 0 }}>{request}</span>
        {/* decorative, like the send button of the chat bar this mirrors; it is not a control */}
        <span
          data-handoff-send="true"
          aria-hidden="true"
          style={{ display: "grid", placeItems: "center", width: 36, height: 36, flex: "none", borderRadius: 999, background: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.55)" }}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M8 13V3M8 3L3.5 7.5M8 3l4.5 4.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
      </div>

      <ol style={{ listStyle: "none", margin: "14px 4px 0", padding: 0, display: "grid", gap: 2 }}>
        {steps.map((step, i) => (
          <li key={`${step.desk}-${i}`} style={{ display: "flex", alignItems: "center", gap: 12, padding: "6px 0" }}>
            <HelixAvatar desk={step.desk} state={STEP_FACE[step.status]} animated={step.status !== "done"} size={34} decorative />
            <strong style={{ fontWeight: 600, whiteSpace: "nowrap" }}>{HELIX_DESK_NAMES[step.desk]}</strong>
            <span style={{ color: TEXT_COLOR[step.status], minWidth: 0 }}>{step.text}</span>
            {step.status === "working" ? (
              <span aria-hidden="true" style={{ display: "inline-flex", gap: 4, color: "rgba(255,255,255,0.62)" }}>
                <i className="hxho-dot" />
                <i className="hxho-dot" />
                <i className="hxho-dot" />
              </span>
            ) : (
              <StatusMark status={step.status} />
            )}
          </li>
        ))}
      </ol>

      {result ? (
        <>
          <hr style={{ border: 0, borderTop: "1px solid rgba(255,255,255,0.1)", margin: "12px 4px" }} />
          <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "0 4px" }}>
            <HelixAvatar desk={result.desk} state={result.state ?? "done"} size={34} decorative />
            <span>{result.text}</span>
          </div>
        </>
      ) : null}
    </section>
  );
}
