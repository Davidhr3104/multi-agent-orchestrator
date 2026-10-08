import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { HELIX_AVATAR_DESKS, HelixAvatar, nextAvatarState, nextPhase } from "./helix-avatar";

const html = (el: React.ReactElement) => renderToStaticMarkup(el);

describe("HelixAvatar renders the cloud logo with a state class", () => {
  it("defaults to idle and exposes an accessible label", () => {
    const out = html(<HelixAvatar desk="leads" />);
    expect(out).toContain("helix-avatar is-idle");
    expect(out).toContain('aria-label="Helix AI assistant"');
    expect(out).toContain('role="img"');
  });

  it("is hidden from assistive tech when decorative (the heading already names the dialog)", () => {
    const out = html(<HelixAvatar desk="leads" decorative />);
    expect(out).toContain('aria-hidden="true"');
    expect(out).not.toContain('role="img"');
  });

  it("maps every state to its class", () => {
    for (const state of ["idle", "thinking", "speaking", "unsure", "done", "error"] as const) {
      expect(html(<HelixAvatar desk="leads" state={state} />)).toContain(`helix-avatar is-${state}`);
    }
  });

  it("sizes the wrapper from the size prop", () => {
    const out = html(<HelixAvatar desk="leads" size={56} />);
    expect(out).toContain("width:56px");
    expect(out).toContain("height:56px");
  });

  it("draws the cloud body (the part Stitch's hidden-defs version lost)", () => {
    const out = html(<HelixAvatar desk="leads" />);
    expect((out.match(/<circle/g) ?? []).length).toBeGreaterThanOrEqual(8);
    expect(out).toContain("<defs>");
    expect(out).not.toContain('class="hidden"');
  });
});

describe("each desk gets its own logo palette", () => {
  it("knows all eight desks", () => {
    expect([...HELIX_AVATAR_DESKS].sort()).toEqual(
      ["commerce", "data", "inbox", "leads", "legal", "marketing", "real-estate", "social"].sort(),
    );
  });

  it("leads is blue, legal is silver and does not leak the blue palette", () => {
    const leads = html(<HelixAvatar desk="leads" />);
    const legal = html(<HelixAvatar desk="legal" />);
    expect(leads).toContain("#38bdf8");
    expect(legal).toContain("#cbd5e1");
    expect(legal).not.toContain("#2563eb");
    expect(legal).not.toContain("#38bdf8");
  });

  it("an unknown desk falls back to the leads palette and says so", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    // @ts-expect-error deliberately wrong desk to prove the fallback is visible, not silent
    const out = html(<HelixAvatar desk="nope" />);
    expect(out).toContain("#38bdf8");
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('unknown desk "nope"'));
    warn.mockRestore();
  });
});

describe("several avatars can share a page", () => {
  it("never repeats an id, so one hidden avatar cannot break another one's gradients", () => {
    const out = html(
      <div>
        <HelixAvatar desk="leads" size={56} />
        <HelixAvatar desk="leads" size={44} state="thinking" />
        <HelixAvatar desk="legal" size={44} />
      </div>,
    );
    const ids = [...out.matchAll(/ id="([^"]+)"/g)].map((m) => m[1]);
    expect(ids.length).toBeGreaterThan(0);
    expect(new Set(ids).size).toBe(ids.length);
    // every url(#...) reference points at an id that exists in the same markup
    for (const ref of out.matchAll(/url\(#([^)]+)\)/g)) expect(ids).toContain(ref[1]);
  });
});

describe("nextAvatarState picks the face from real chat state", () => {
  const base = { busy: false, error: false, needsHuman: false, phase: "idle" as const };

  it("error wins over everything", () => {
    expect(nextAvatarState({ ...base, busy: true, error: true, needsHuman: true, phase: "speaking" })).toBe("error");
  });
  it("a request in flight means thinking", () => {
    expect(nextAvatarState({ ...base, busy: true })).toBe("thinking");
  });
  it("a reply that waits for a human OK keeps the face unsure, even while it would be speaking", () => {
    expect(nextAvatarState({ ...base, needsHuman: true, phase: "speaking" })).toBe("unsure");
    expect(nextAvatarState({ ...base, needsHuman: true })).toBe("unsure");
  });
  it("a fresh reply is spoken, then flashes done", () => {
    expect(nextAvatarState({ ...base, phase: "speaking" })).toBe("speaking");
    expect(nextAvatarState({ ...base, phase: "done" })).toBe("done");
  });
  it("otherwise idle", () => {
    expect(nextAvatarState(base)).toBe("idle");
  });

  describe("a finished task keeps the done face until something new happens", () => {
    it("stays done with no timer once the task is complete", () => {
      expect(nextAvatarState({ ...base, taskDone: true })).toBe("done");
    });
    it("still speaks the reply first, then rests on done", () => {
      expect(nextAvatarState({ ...base, taskDone: true, phase: "speaking" })).toBe("speaking");
      expect(nextAvatarState({ ...base, taskDone: true, phase: "done" })).toBe("done");
    });
    it("a new request, a failure or a human hold all override it", () => {
      expect(nextAvatarState({ ...base, taskDone: true, busy: true })).toBe("thinking");
      expect(nextAvatarState({ ...base, taskDone: true, error: true })).toBe("error");
      expect(nextAvatarState({ ...base, taskDone: true, needsHuman: true })).toBe("unsure");
    });
    it("without a finished task the done flash still ends in idle", () => {
      expect(nextAvatarState({ ...base, taskDone: false, phase: "idle" })).toBe("idle");
    });
  });
});

describe("the reply phase runs speaking -> done -> idle and never sticks", () => {
  it("a clean reply starts speaking and then walks to done and idle", () => {
    let p = nextPhase("idle", "reply");
    expect(p).toBe("speaking");
    p = nextPhase(p, "speakEnd");
    expect(p).toBe("done");
    p = nextPhase(p, "doneEnd");
    expect(p).toBe("idle");
  });
  it("a new request or a failure cancels any speaking/done flash", () => {
    expect(nextPhase("speaking", "start")).toBe("idle");
    expect(nextPhase("done", "fail")).toBe("idle");
  });
  it("a late timer for a phase we already left does nothing", () => {
    expect(nextPhase("idle", "speakEnd")).toBe("idle");
    expect(nextPhase("speaking", "doneEnd")).toBe("speaking");
  });
});

describe("small avatars exaggerate their cues so states stay readable", () => {
  it("is compact below 72px and regular from 72px up", () => {
    expect(html(<HelixAvatar desk="leads" size={36} />)).toContain('class="helix-avatar is-idle is-compact"');
    // always look at the svg's class attribute: "is-compact" also appears inside the shipped CSS text
    expect(html(<HelixAvatar desk="leads" size={44} />)).toContain('class="helix-avatar is-idle is-compact"');
    expect(html(<HelixAvatar desk="leads" size={64} />)).toContain('class="helix-avatar is-idle is-compact"');
    expect(html(<HelixAvatar desk="leads" size={72} />)).toContain('class="helix-avatar is-idle"');
    expect(html(<HelixAvatar desk="leads" size={120} />)).not.toContain('class="helix-avatar is-idle is-compact"');
  });
  it("can be forced either way", () => {
    expect(html(<HelixAvatar desk="leads" size={120} compact />)).toContain('class="helix-avatar is-idle is-compact"');
    expect(html(<HelixAvatar desk="leads" size={36} compact={false} />)).not.toContain('class="helix-avatar is-idle is-compact"');
  });
  it("lets the state halo spill out of the svg box instead of being cut into a square", () => {
    expect(html(<HelixAvatar desk="leads" size={36} />)).toContain(".helix-avatar { overflow: visible; }");
  });
  it("ships the compact rules: a big question badge, tilted eyes, and a speaking halo", () => {
    const out = html(<HelixAvatar desk="leads" size={36} />);
    expect(out).toContain(".helix-avatar.is-compact .badge-unsure");
    expect(out).toContain(".helix-avatar.is-compact.is-unsure .eye-left");
    expect(out).toContain(".helix-avatar.is-compact.is-speaking .ambient-glow");
  });
});

describe("a changed stylesheet always reaches already-open pages", () => {
  it("keys the shared style by a hash of its content, so hot reload cannot keep the old CSS", () => {
    // React de-duplicates <style href> by href: a constant href would freeze the first CSS a tab ever loaded
    expect(html(<HelixAvatar desk="leads" />)).toMatch(/data-href="helix-avatar-[a-z0-9]+"/);
  });
});

describe("older messages keep a calm avatar", () => {
  it("animated={false} freezes it; the default stays animated", () => {
    // look at the svg's class attribute: the word also appears inside the shipped CSS text
    expect(html(<HelixAvatar desk="leads" size={96} animated={false} />)).toContain('class="helix-avatar is-idle is-static"');
    expect(html(<HelixAvatar desk="leads" size={96} />)).toContain('class="helix-avatar is-idle"');
  });
  it("ships the rule that actually stops the motion", () => {
    expect(html(<HelixAvatar desk="leads" />)).toContain(".helix-avatar.is-static");
  });
});
