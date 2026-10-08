"use client";

import { useEffect, useState } from "react";
import { HelixAvatar, type HelixAvatarDesk } from "./helix-avatar";
import { HELIX_DESK_NAMES, HelixHandoffPanel, type HandoffResult, type HandoffStep } from "./helix-handoff";

/**
 * A scripted, clearly-labelled simulation of one Helix handing work to others. Nothing here talks to
 * another app (there is no inter-app event layer yet); it exists so people can see the animation and
 * how the desks answer, including the human brake: when a desk holds for a person's OK, an approval box
 * appears and what you choose changes how the run ends. What is on screen at any moment is a pure
 * function of elapsed time and that decision, so it is testable without timers.
 */

export type HandoffDecision = "approved" | "declined";

export type HandoffDemoStep = {
  desk: HelixAvatarDesk;
  /** what the desk says while it works */
  working: string;
  /** how it ends: finished, or held for a person's OK */
  outcome: "done" | "held";
  done?: string;
  hold?: string;
  startMs: number;
  endMs: number;
};

/** What the person is asked to allow, and exactly how the run ends for each answer. */
export type HandoffApproval = {
  ask: string;
  approved: { text: string; result: HandoffResult };
  declined: { text: string; result: HandoffResult };
};

export type HandoffScenario = {
  from: HelixAvatarDesk;
  request: string;
  steps: HandoffDemoStep[];
  result: HandoffResult;
  /** present exactly when one step is held */
  approval?: HandoffApproval;
};

type Spec = { desk: HelixAvatarDesk; working: string; text: string; held?: boolean };

/** Steps appear one after another; each one works for about two seconds. */
function build(from: HelixAvatarDesk, request: string, specs: Spec[], result: HandoffResult, approval?: HandoffApproval): HandoffScenario {
  return {
    from,
    request,
    steps: specs.map((s, i) => {
      const startMs = 700 + i * 1100;
      const endMs = startMs + 1900 + (i % 2) * 500;
      return s.held
        ? { desk: s.desk, working: s.working, outcome: "held" as const, hold: s.text, startMs, endMs }
        : { desk: s.desk, working: s.working, outcome: "done" as const, done: s.text, startMs, endMs };
    }),
    result,
    approval,
  };
}

// All rows are invented. Each script has the asking desk contact one or two others; most end with one
// desk holding for a person's OK, because that is the point of Helix. Approving says "(simulated)":
// nothing real happens.
export const HANDOFF_DEMOS: Record<HelixAvatarDesk, HandoffScenario> = {
  leads: build(
    "leads",
    "Follow up with today's three hot leads",
    [
      { desk: "inbox", working: "Drafting follow-ups for Maya, Luis and Ana", text: "3 drafts ready. Sending needs your OK", held: true },
      { desk: "marketing", working: "Checking which campaign each lead came from", text: "All three came from Ad B (quality HVAC)" },
    ],
    { desk: "leads", text: "The drafts wait for your approval in Inbox. Nothing was sent.", state: "unsure" },
    {
      ask: "Send 3 follow-up emails to Maya, Luis and Ana",
      approved: { text: "Approved. 3 emails sent (simulated)", result: { desk: "leads", text: "Done. The 3 follow-ups went out (simulated).", state: "done" } },
      declined: { text: "Declined. Nothing was sent", result: { desk: "leads", text: "Understood. Nothing was sent.", state: "idle" } },
    },
  ),
  commerce: build(
    "commerce",
    "Promote the low-stock bundle this weekend",
    [
      { desk: "marketing", working: "Checking the ad budget for the bundle", text: "Budget approved: $120 within the weekly cap" },
      { desk: "social", working: "Drafting the launch post", text: "Post drafted. Publishing needs your OK", held: true },
    ],
    { desk: "commerce", text: "The post waits in Social for your approval. Nothing is published yet.", state: "unsure" },
    {
      ask: "Publish the launch post for the low-stock bundle",
      approved: { text: "Approved. Post published (simulated)", result: { desk: "commerce", text: "Done. The post is live (simulated).", state: "done" } },
      declined: { text: "Declined. Nothing was published", result: { desk: "commerce", text: "Understood. Nothing was published.", state: "idle" } },
    },
  ),
  inbox: build(
    "inbox",
    "Send Maya Chen's pricing request to the Leads desk",
    [{ desk: "leads", working: "Scoring the inquiry", text: "Score 86 · sure · added as a hot lead" }],
    { desk: "inbox", text: "Delivered. Maya Chen is now a hot lead in Leads.", state: "done" },
  ),
  legal: build(
    "legal",
    "Warn the partner about the Clinical NLP RFP deadline",
    [
      { desk: "data", working: "Pulling the RFP deadlines", text: "Deadline is 2026-10-21, 13 days left" },
      { desk: "inbox", working: "Drafting the partner email", text: "Draft ready. Sending needs your OK", held: true },
    ],
    { desk: "legal", text: "The email waits in Inbox for your approval.", state: "unsure" },
    {
      ask: "Send the deadline warning to the partner",
      approved: { text: "Approved. Email sent (simulated)", result: { desk: "legal", text: "Done. The partner was notified (simulated).", state: "done" } },
      declined: { text: "Declined. Nothing was sent", result: { desk: "legal", text: "Understood. The partner was not emailed.", state: "idle" } },
    },
  ),
  marketing: build(
    "marketing",
    "Ad B brings quality HVAC leads: tell Leads and Social",
    [
      { desk: "leads", working: "Tagging the 14 leads from Ad B", text: "14 leads tagged 'Ad B · quality'" },
      { desk: "social", working: "Preparing a post about Ad B's offer", text: "Post drafted. Publishing needs your OK", held: true },
    ],
    { desk: "marketing", text: "Leads are tagged. The post waits for your OK.", state: "unsure" },
    {
      ask: "Publish the post about Ad B's offer",
      approved: { text: "Approved. Post published (simulated)", result: { desk: "marketing", text: "Done. Leads are tagged and the post is live (simulated).", state: "done" } },
      declined: { text: "Declined. Nothing was published", result: { desk: "marketing", text: "Understood. Leads stay tagged; the post was not published.", state: "idle" } },
    },
  ),
  "real-estate": build(
    "real-estate",
    "Announce the new listing on Maple Court",
    [
      { desk: "social", working: "Drafting the listing post", text: "Post drafted. Publishing needs your OK", held: true },
      { desk: "inbox", working: "Drafting the email to the buyer list", text: "Email drafted and ready for review" },
    ],
    { desk: "real-estate", text: "Both drafts wait for your review. Nothing was sent.", state: "unsure" },
    {
      ask: "Publish the Maple Court listing post",
      approved: { text: "Approved. Post published (simulated)", result: { desk: "real-estate", text: "Done. The listing post is live and the buyer email is ready (simulated).", state: "done" } },
      declined: { text: "Declined. Nothing was published", result: { desk: "real-estate", text: "Understood. The post was not published.", state: "idle" } },
    },
  ),
  social: build(
    "social",
    "A DM looks like a lead: send it to Leads",
    [{ desk: "leads", working: "Scoring the DM from @maple_homes", text: "Score 48 · unsure. Held for a human", held: true }],
    { desk: "social", text: "Leads is not sure about this one, so a person decides.", state: "unsure" },
    {
      ask: "Treat the DM from @maple_homes as a lead",
      approved: { text: "Approved. Added to Leads as a lead (simulated)", result: { desk: "social", text: "Done. The DM is now a lead in Leads (simulated).", state: "done" } },
      declined: { text: "Declined. Left as a regular DM", result: { desk: "social", text: "Understood. The DM stays out of Leads.", state: "idle" } },
    },
  ),
  data: build(
    "data",
    "Share the cleaned contact list with Leads and Marketing",
    [
      { desk: "leads", working: "Importing 120 clean rows", text: "120 rows imported, 0 duplicates" },
      { desk: "marketing", working: "Matching rows to campaigns", text: "118 matched, 2 need a look" },
    ],
    { desk: "data", text: "Shared. 2 rows are flagged for review.", state: "done" },
  ),
};

/** When the whole script is over: the last step ends, plus a beat before the result. */
export function handoffTotalMs(s: HandoffScenario): number {
  return Math.max(...s.steps.map((st) => st.endMs)) + 600;
}

/**
 * Exactly what is on screen at `ms`, given the person's decision once the run has finished. A pure
 * function, so the animation and its two endings can be tested without timers. A decision made before
 * the end, or for a script with nothing held, changes nothing.
 */
export function handoffFrameAt(
  s: HandoffScenario,
  ms: number,
  decision?: HandoffDecision,
): { steps: HandoffStep[]; result?: HandoffResult; finished: boolean; awaitingApproval: boolean } {
  const finished = ms >= handoffTotalMs(s);
  const heldIndex = s.steps.findIndex((st) => st.outcome === "held");
  const decided = finished && s.approval && heldIndex >= 0 ? decision : undefined;

  const steps: HandoffStep[] = [];
  s.steps.forEach((st) => {
    if (ms < st.startMs) return;
    if (ms < st.endMs) {
      steps.push({ desk: st.desk, text: st.working, status: "working" });
    } else if (st.outcome === "held") {
      if (decided === "approved") steps.push({ desk: st.desk, text: s.approval!.approved.text, status: "done" });
      else if (decided === "declined") steps.push({ desk: st.desk, text: s.approval!.declined.text, status: "declined" });
      else steps.push({ desk: st.desk, text: st.hold ?? "", status: "held" });
    } else {
      steps.push({ desk: st.desk, text: st.done ?? "", status: "done" });
    }
  });

  const result = !finished ? undefined : decided ? s.approval![decided].result : s.result;
  return { steps, result, finished, awaitingApproval: finished && Boolean(s.approval) && heldIndex >= 0 && !decided };
}

const TICK_MS = 100;
const warned = new Set<string>();

function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

const smallButton = {
  padding: "4px 12px",
  borderRadius: 999,
  border: "1px solid rgba(255,255,255,0.18)",
  background: "rgba(255,255,255,0.05)",
  color: "inherit",
  font: "inherit",
  fontSize: 12,
  cursor: "pointer",
} as const;

const decideButton = {
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
  minHeight: 40,
  padding: "0 18px",
  borderRadius: 10,
  font: "inherit",
  fontSize: 14,
  fontWeight: 600,
  cursor: "pointer",
} as const;

function Check() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M3.5 8.4l3 3 6-6.4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function Cross() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

/** The box that asks a person to approve or deny what a desk is holding. Still a simulation, and says so. */
function ApprovalBox({
  desk,
  approval,
  decision,
  onDecide,
}: {
  desk: HelixAvatarDesk;
  approval: HandoffApproval;
  decision?: HandoffDecision;
  onDecide: (d: HandoffDecision) => void;
}) {
  const answered = decision !== undefined;
  return (
    <div
      role="group"
      aria-label="Approval needed"
      style={{
        display: "grid",
        gap: 12,
        padding: 14,
        borderRadius: 14,
        border: `1px solid ${answered ? "rgba(255,255,255,0.14)" : "rgba(245,158,11,0.4)"}`,
        background: answered ? "rgba(255,255,255,0.03)" : "rgba(245,158,11,0.07)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <HelixAvatar desk={desk} state={decision === "approved" ? "done" : decision === "declined" ? "idle" : "unsure"} size={44} decorative />
        <div style={{ minWidth: 0 }}>
          <p style={{ margin: 0, fontWeight: 600, color: answered ? "inherit" : "#fbbf24" }}>
            {decision === "approved" ? "Approved" : decision === "declined" ? "Declined" : "Needs your OK"}
          </p>
          <p style={{ margin: "2px 0 0", fontSize: 13, opacity: 0.78 }}>
            {HELIX_DESK_NAMES[desk]} wants to: {approval.ask}
          </p>
        </div>
      </div>

      {answered ? (
        <p style={{ margin: 0, fontSize: 13, display: "flex", alignItems: "center", gap: 8, color: decision === "approved" ? "#4ade80" : "rgba(255,255,255,0.6)" }}>
          {decision === "approved" ? <Check /> : <Cross />}
          {decision === "approved" ? approval.approved.text : approval.declined.text}
        </p>
      ) : (
        <>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
            <button
              type="button"
              onClick={() => onDecide("approved")}
              style={{ ...decideButton, border: "1px solid transparent", background: "#22c55e", color: "#052e16" }}
            >
              <Check />Approve
            </button>
            <button
              type="button"
              onClick={() => onDecide("declined")}
              style={{ ...decideButton, border: "1px solid rgba(248,113,113,0.6)", background: "rgba(248,113,113,0.12)", color: "#fecaca" }}
            >
              <Cross />Deny
            </button>
          </div>
          <p style={{ margin: 0, fontSize: 12, opacity: 0.55 }}>Simulated: choosing here does not send or publish anything.</p>
        </>
      )}
    </div>
  );
}

export function HelixHandoffDemo({
  from,
  onClose,
  className,
  initialElapsedMs,
  initialDecision,
}: {
  from: HelixAvatarDesk;
  onClose: () => void;
  className?: string;
  /** start the run already this far in (Infinity = finished); used for reduced motion and for tests */
  initialElapsedMs?: number;
  /** start with this decision already made; used for tests */
  initialDecision?: HandoffDecision;
}) {
  let scenario = HANDOFF_DEMOS[from];
  if (!scenario) {
    if (!warned.has(String(from))) {
      warned.add(String(from));
      console.warn(`HelixHandoffDemo: no script for desk "${String(from)}", using the Commerce one.`);
    }
    scenario = HANDOFF_DEMOS.commerce;
  }

  // With reduced motion the run is shown finished straight away instead of animating.
  const [elapsed, setElapsed] = useState(() => initialElapsedMs ?? (prefersReducedMotion() ? Infinity : 0));
  const [decision, setDecision] = useState<HandoffDecision | undefined>(initialDecision);
  const frame = handoffFrameAt(scenario, elapsed, decision);
  const heldStep = scenario.steps.find((st) => st.outcome === "held");

  useEffect(() => {
    if (frame.finished) return;
    const t = setInterval(() => setElapsed((e) => e + TICK_MS), TICK_MS);
    return () => clearInterval(t);
  }, [frame.finished]);

  function replay() {
    setDecision(undefined);
    setElapsed(prefersReducedMotion() ? Infinity : 0);
  }

  return (
    <section className={className} aria-label="Helix handoff demo" style={{ display: "grid", gap: 14, width: "100%" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <p style={{ margin: 0, fontSize: 12, opacity: 0.6 }}>Simulated demo with invented data. Nothing is sent to other desks.</p>
        <div style={{ display: "flex", gap: 8 }}>
          <button type="button" style={smallButton} onClick={replay}>
            Replay
          </button>
          <button type="button" style={smallButton} onClick={onClose}>
            Close
          </button>
        </div>
      </div>
      <HelixHandoffPanel from={scenario.from} request={scenario.request} steps={frame.steps} result={frame.result} />
      {scenario.approval && heldStep && frame.finished ? (
        <div aria-live="polite">
          <ApprovalBox desk={heldStep.desk} approval={scenario.approval} decision={decision} onDecide={setDecision} />
        </div>
      ) : null}
    </section>
  );
}
