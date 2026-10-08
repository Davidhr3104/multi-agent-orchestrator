import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { HELIX_DESK_NAMES, HelixHandoffPanel, handoffOverallState, type HandoffStep } from "./helix-handoff";

const html = (el: React.ReactElement) => renderToStaticMarkup(el);

const steps: HandoffStep[] = [
  { desk: "social", text: "Drafting the launch post", status: "working" },
  { desk: "marketing", text: "Checking the ad budget", status: "done" },
];

describe("HelixHandoffPanel shows one Helix contacting others", () => {
  it("shows the request and the requesting desk's avatar", () => {
    const out = html(<HelixHandoffPanel from="commerce" request="Promote the low-stock bundle" steps={steps} />);
    expect(out).toContain("Promote the low-stock bundle");
    expect(out).toContain("#34d399"); // commerce green is the requester
  });

  it("lists every contacted desk by its product name, with its own palette", () => {
    const out = html(<HelixHandoffPanel from="commerce" request="x" steps={steps} />);
    expect(out).toContain("Helix for Social");
    expect(out).toContain("Helix for Marketing");
    expect(out).toContain("Drafting the launch post");
    expect(out).toContain("#f472b6"); // social pink
    expect(out).toContain("#fb923c"); // marketing orange
  });

  it("names every desk, including Helix Data which has no 'for'", () => {
    expect(HELIX_DESK_NAMES.data).toBe("Helix Data");
    expect(HELIX_DESK_NAMES["real-estate"]).toBe("Helix for Real Estate");
  });

  it("ends the request bar with a decorative send arrow, hidden from assistive tech and not a real control", () => {
    const out = html(<HelixHandoffPanel from="commerce" request="Promote the bundle" steps={steps} />);
    expect(out).toMatch(/<span[^>]*data-handoff-send="true"[^>]*aria-hidden="true"/);
    expect(out).not.toContain("<button");
  });

  it("is a polite live region so screen readers hear progress", () => {
    const out = html(<HelixHandoffPanel from="commerce" request="x" steps={steps} />);
    expect(out).toContain('role="status"');
    expect(out).toContain('aria-live="polite"');
    expect(out).toContain("<ol");
  });
});

describe("the handoff stylesheet also reaches already-open pages", () => {
  it("keys its shared style by a hash of the content", () => {
    expect(html(<HelixHandoffPanel from="commerce" request="x" steps={steps} />)).toMatch(/data-href="[^"]*helix-handoff-[a-z0-9]+/); // React merges same-precedence styles into one tag
  });
});

describe("every step status is readable without color", () => {
  const one = (status: HandoffStep["status"]) =>
    html(<HelixHandoffPanel from="commerce" request="x" steps={[{ desk: "social", text: "t", status }]} />);

  it("working animates dots and the desk thinks", () => {
    const out = one("working");
    expect(out).toContain("hxho-dot");
    expect(out).toContain("helix-avatar is-thinking");
  });
  it("done gets a labelled check and no dots", () => {
    const out = one("done");
    expect(out).toContain('aria-label="done"');
    expect(out).not.toContain('class="hxho-dot"');
  });
  it("held is a labelled pause and the desk is unsure (human brake)", () => {
    const out = one("held");
    expect(out).toContain('aria-label="held for a human"');
    expect(out).toContain("helix-avatar is-unsure");
  });
  it("declined is a labelled cross but a calm face: refusing is a decision, not a failure", () => {
    const out = one("declined");
    expect(out).toContain('aria-label="declined"');
    expect(out).toContain("helix-avatar is-idle");
    expect(out).not.toContain("helix-avatar is-error");
  });
  it("error is a labelled cross, in the error face, and never silent", () => {
    const out = one("error");
    expect(out).toContain('aria-label="failed"');
    expect(out).toContain("helix-avatar is-error");
  });
});

describe("the final result line", () => {
  it("appears only when there is a result", () => {
    const withResult = html(<HelixHandoffPanel from="commerce" request="x" steps={steps} result={{ desk: "commerce", text: "Post queued for approval." }} />);
    const without = html(<HelixHandoffPanel from="commerce" request="x" steps={steps} />);
    expect(withResult).toContain("Post queued for approval.");
    expect(withResult).toContain("<hr");
    expect(without).not.toContain("<hr");
  });
});

describe("handoffOverallState summarises the requester's face from the steps", () => {
  const s = (status: HandoffStep["status"]): HandoffStep => ({ desk: "social", text: "t", status });
  it("error beats everything", () => expect(handoffOverallState([s("working"), s("error"), s("held")], true)).toBe("error"));
  it("anything still working means thinking", () => expect(handoffOverallState([s("done"), s("working")], false)).toBe("thinking"));
  it("a held step means the whole thing waits on a human", () => expect(handoffOverallState([s("done"), s("held")], false)).toBe("unsure"));
  it("a declined step settles to a calm face once nothing else is pending", () => {
    expect(handoffOverallState([s("done"), s("declined")], true)).toBe("idle");
    expect(handoffOverallState([s("declined"), s("held")], true)).toBe("unsure");
    expect(handoffOverallState([s("declined"), s("working")], false)).toBe("thinking");
  });
  it("all done with a result is done", () => expect(handoffOverallState([s("done")], true)).toBe("done"));
  it("all done but no result yet stays calm", () => expect(handoffOverallState([s("done")], false)).toBe("idle"));
  it("no steps is idle", () => expect(handoffOverallState([], false)).toBe("idle"));
});
