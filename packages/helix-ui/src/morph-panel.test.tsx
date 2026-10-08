import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { MorphPanel } from "./morph-panel";

const html = (el: React.ReactElement) => renderToStaticMarkup(el);
const noop = () => {};

describe("MorphPanel mark", () => {
  it("keeps the official logo image when no avatar desk is given (backwards compatible)", () => {
    const out = html(<MorphPanel logoSrc="/logo-icon.png" onAsk={noop} />);
    expect(out).toContain('src="/logo-icon.png"');
    expect(out).not.toContain("helix-avatar");
  });

  it("shows the animated desk avatar instead of the logo when avatarDesk is set", () => {
    const out = html(<MorphPanel logoSrc="/logo-icon.png" avatarDesk="commerce" onAsk={noop} />);
    expect(out).toContain("helix-avatar is-idle");
    expect(out).not.toContain('src="/logo-icon.png"');
    expect(out).toContain("#34d399"); // commerce green, not the leads blue
  });

  it("the avatar thinks while a question is in flight", () => {
    const out = html(<MorphPanel avatarDesk="legal" busy onAsk={noop} />);
    expect(out).toContain("helix-avatar is-thinking");
  });

  it("the avatar is decorative: the input already carries the accessible name", () => {
    const out = html(<MorphPanel avatarDesk="leads" onAsk={noop} />);
    expect(out).not.toContain('role="img"');
  });
});
