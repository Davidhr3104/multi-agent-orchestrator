import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { HELIX_AVATAR_DESKS } from "./helix-avatar";
import { HANDOFF_DEMOS, HelixHandoffDemo, handoffFrameAt, handoffTotalMs } from "./helix-handoff-demo";

const html = (el: React.ReactElement) => renderToStaticMarkup(el);

describe("every desk has a handoff demo script", () => {
  it("covers all eight desks and keys each script by the desk that asks", () => {
    expect(Object.keys(HANDOFF_DEMOS).sort()).toEqual([...HELIX_AVATAR_DESKS].sort());
    for (const desk of HELIX_AVATAR_DESKS) expect(HANDOFF_DEMOS[desk].from).toBe(desk);
  });

  it("each script contacts other desks only, with real desk keys, and ends with a result", () => {
    for (const desk of HELIX_AVATAR_DESKS) {
      const s = HANDOFF_DEMOS[desk];
      expect(s.steps.length).toBeGreaterThanOrEqual(1);
      for (const step of s.steps) {
        expect(HELIX_AVATAR_DESKS).toContain(step.desk);
        expect(step.desk).not.toBe(desk);
        expect(step.working.length).toBeGreaterThan(0);
        expect(step.outcome === "held" ? step.hold : step.done).toBeTruthy();
      }
      expect(s.result.text.length).toBeGreaterThan(0);
    }
  });

  it("at least one script shows the human brake, so the demo shows both kinds of ending", () => {
    const kinds = new Set(Object.values(HANDOFF_DEMOS).flatMap((s) => s.steps.map((st) => st.outcome ?? "done")));
    expect(kinds.has("held")).toBe(true);
    expect(kinds.has("done")).toBe(true);
  });
});

describe("handoffFrameAt says exactly what is on screen at a given time", () => {
  const s = HANDOFF_DEMOS.commerce;

  it("starts with only the request: no rows yet and no result", () => {
    const f = handoffFrameAt(s, 0);
    expect(f.steps).toEqual([]);
    expect(f.result).toBeUndefined();
    expect(f.finished).toBe(false);
  });

  it("a contacted desk appears working, then settles", () => {
    const first = s.steps[0];
    const during = handoffFrameAt(s, first.startMs + 10);
    expect(during.steps[0]).toMatchObject({ desk: first.desk, status: "working", text: first.working });
    const after = handoffFrameAt(s, first.endMs + 10);
    expect(after.steps[0].status).toBe(first.outcome === "held" ? "held" : "done");
    expect(after.steps[0].text).toBe(first.outcome === "held" ? first.hold : first.done);
  });

  it("rows keep their order and never disappear once shown", () => {
    let prev = 0;
    for (let t = 0; t <= handoffTotalMs(s) + 500; t += 100) {
      const n = handoffFrameAt(s, t).steps.length;
      expect(n).toBeGreaterThanOrEqual(prev);
      prev = n;
    }
    expect(prev).toBe(s.steps.length);
  });

  it("the result lands after the last step and then the run is finished", () => {
    const total = handoffTotalMs(s);
    expect(handoffFrameAt(s, total - 1).finished).toBe(false);
    const end = handoffFrameAt(s, total);
    expect(end.finished).toBe(true);
    expect(end.result).toMatchObject({ desk: s.result.desk, text: s.result.text });
    expect(end.steps.every((st) => st.status !== "working")).toBe(true);
  });

  it("any time past the end is the same final frame (so reduced motion can jump there)", () => {
    expect(handoffFrameAt(s, Infinity)).toEqual(handoffFrameAt(s, handoffTotalMs(s)));
  });
});

describe("every held step comes with an approval to decide on", () => {
  it("a script has an approval exactly when it has a held step", () => {
    for (const desk of HELIX_AVATAR_DESKS) {
      const s = HANDOFF_DEMOS[desk];
      const held = s.steps.filter((st) => st.outcome === "held").length;
      expect(held <= 1).toBe(true);
      expect(Boolean(s.approval)).toBe(held === 1);
    }
  });

  it("both outcomes are fully written", () => {
    for (const desk of HELIX_AVATAR_DESKS) {
      const a = HANDOFF_DEMOS[desk].approval;
      if (!a) continue;
      expect(a.ask.length).toBeGreaterThan(0);
      expect(a.approved.text.length).toBeGreaterThan(0);
      expect(a.approved.result.text.length).toBeGreaterThan(0);
      expect(a.declined.text.length).toBeGreaterThan(0);
      expect(a.declined.result.text.length).toBeGreaterThan(0);
    }
  });

  it("both outcomes say the demo is simulated or that nothing happened, never that something real was sent", () => {
    for (const desk of HELIX_AVATAR_DESKS) {
      const a = HANDOFF_DEMOS[desk].approval;
      if (!a) continue;
      expect(a.approved.text + a.approved.result.text).toMatch(/simulated/i);
      expect(a.declined.text + a.declined.result.text).toMatch(/nothing|not|stays/i);
    }
  });
});

describe("a decision changes how the run ends", () => {
  const s = HANDOFF_DEMOS.commerce;
  const heldIndex = s.steps.findIndex((st) => st.outcome === "held");

  it("with no decision the finished run is waiting for approval", () => {
    const f = handoffFrameAt(s, Infinity);
    expect(f.awaitingApproval).toBe(true);
    expect(f.steps[heldIndex].status).toBe("held");
    expect(f.result).toEqual(s.result);
  });

  it("approving finishes the held step and replaces the result", () => {
    const f = handoffFrameAt(s, Infinity, "approved");
    expect(f.awaitingApproval).toBe(false);
    expect(f.steps[heldIndex]).toMatchObject({ status: "done", text: s.approval!.approved.text });
    expect(f.result).toEqual(s.approval!.approved.result);
  });

  it("declining marks the step declined and replaces the result", () => {
    const f = handoffFrameAt(s, Infinity, "declined");
    expect(f.awaitingApproval).toBe(false);
    expect(f.steps[heldIndex]).toMatchObject({ status: "declined", text: s.approval!.declined.text });
    expect(f.result).toEqual(s.approval!.declined.result);
  });

  it("a decision before the run has finished changes nothing", () => {
    expect(handoffFrameAt(s, 500, "approved")).toEqual(handoffFrameAt(s, 500));
    expect(handoffFrameAt(s, handoffTotalMs(s) - 1, "declined")).toEqual(handoffFrameAt(s, handoffTotalMs(s) - 1));
  });

  it("a script with nothing held never waits and ignores a stray decision", () => {
    const plain = HANDOFF_DEMOS.inbox;
    expect(handoffFrameAt(plain, Infinity).awaitingApproval).toBe(false);
    expect(handoffFrameAt(plain, Infinity, "approved")).toEqual(handoffFrameAt(plain, Infinity));
  });
});

describe("the approval box inside the chat", () => {
  it("is not shown while the run is still going", () => {
    const out = html(<HelixHandoffDemo from="commerce" onClose={() => {}} />);
    expect(out).not.toContain("Needs your OK");
  });

  it("appears when the run ends with a held step: what is asked, Approve and Deny, and a simulated label", () => {
    const out = html(<HelixHandoffDemo from="commerce" onClose={() => {}} initialElapsedMs={Infinity} />);
    expect(out).toContain("Needs your OK");
    expect(out).toContain(HANDOFF_DEMOS.commerce.approval!.ask);
    expect(out).toContain(">Approve<");
    expect(out).toContain(">Deny<");
    expect(out).toMatch(/simulat/i);
  });

  it("is a labelled group so assistive tech announces what is being asked", () => {
    const out = html(<HelixHandoffDemo from="commerce" onClose={() => {}} initialElapsedMs={Infinity} />);
    expect(out).toContain('role="group"');
    expect(out).toContain('aria-label="Approval needed"');
  });

  it("after approving it shows the outcome and no buttons to decide again", () => {
    const out = html(<HelixHandoffDemo from="commerce" onClose={() => {}} initialElapsedMs={Infinity} initialDecision="approved" />);
    expect(out).toContain(HANDOFF_DEMOS.commerce.approval!.approved.text);
    expect(out).not.toContain(">Approve<");
    expect(out).not.toContain(">Deny<");
  });

  it("after denying it shows the declined outcome", () => {
    const out = html(<HelixHandoffDemo from="commerce" onClose={() => {}} initialElapsedMs={Infinity} initialDecision="declined" />);
    expect(out).toContain(HANDOFF_DEMOS.commerce.approval!.declined.text);
    expect(out).not.toContain(">Approve<");
  });

  it("a script with nothing held never shows the box", () => {
    const out = html(<HelixHandoffDemo from="inbox" onClose={() => {}} initialElapsedMs={Infinity} />);
    expect(out).not.toContain("Needs your OK");
  });
});

describe("HelixHandoffDemo renders the simulation honestly", () => {
  it("shows the request, a clear 'simulated' label, and the replay and close controls", () => {
    const out = html(<HelixHandoffDemo from="commerce" onClose={() => {}} />);
    expect(out).toContain(HANDOFF_DEMOS.commerce.request);
    expect(out).toMatch(/Simulated demo/i);
    expect(out).toMatch(/nothing is sent/i);
    expect(out).toContain(">Replay<");
    expect(out).toContain(">Close<");
  });

  it("an unknown desk falls back to a script and says so instead of rendering nothing", () => {
    // @ts-expect-error deliberately wrong desk
    const out = html(<HelixHandoffDemo from="nope" onClose={() => {}} />);
    expect(out).toMatch(/Simulated demo/i);
  });
});
