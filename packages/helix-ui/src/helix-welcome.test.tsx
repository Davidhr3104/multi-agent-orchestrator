import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { HelixWelcome, displayNameFromEmail, greetingFor } from "./helix-welcome";

const html = (el: React.ReactElement) => renderToStaticMarkup(el);

describe("HelixWelcome opens a fresh chat", () => {
  it("centers a big avatar above the greeting and the question", () => {
    const out = html(<HelixWelcome desk="inbox" name="Deveku" title="What should we triage?" hour={20} />);
    expect(out).toContain("helix-avatar is-idle");
    expect(out).toContain("width:120px");
    // 120px is large enough for the full-detail logo (check the class attribute: the CSS text also says "is-compact")
    expect(out).toContain('class="helix-avatar is-idle"');
    expect(out).toContain("Good evening, Deveku");
    expect(out).toContain("What should we triage?");
  });

  it("never invents a name: without one it simply welcomes back", () => {
    const out = html(<HelixWelcome desk="commerce" title="What should we check?" hour={9} />);
    expect(out).toContain("Welcome back");
    expect(out).not.toContain("undefined");
    expect(out).not.toContain("null");
    expect(out).not.toContain("Good morning,");
  });

  it("an empty or whitespace name counts as no name", () => {
    expect(html(<HelixWelcome desk="legal" name="   " title="t" hour={9} />)).toContain("Welcome back");
    expect(html(<HelixWelcome desk="legal" name={null} title="t" hour={9} />)).toContain("Welcome back");
  });

  it("keeps whatever hint or demo button the app already showed, below the question", () => {
    const out = html(
      <HelixWelcome desk="leads" title="What shall we look at?">
        <button type="button">Watch Helix work</button>
      </HelixWelcome>,
    );
    expect(out).toContain("Watch Helix work");
    expect(out.indexOf("What shall we look at?")).toBeLessThan(out.indexOf("Watch Helix work"));
  });

  it("uses the desk's own palette", () => {
    expect(html(<HelixWelcome desk="legal" title="t" />)).toContain("#cbd5e1");
  });

  it("the avatar is decorative; the question is a heading screen readers can find", () => {
    const out = html(<HelixWelcome desk="leads" title="What shall we look at?" />);
    expect(out).not.toContain('role="img"');
    expect(out).toMatch(/<h3[^>]*>What shall we look at\?<\/h3>/);
  });
});

describe("greetingFor follows the hour", () => {
  it("morning, afternoon, evening", () => {
    expect(greetingFor(5)).toBe("Good morning");
    expect(greetingFor(11)).toBe("Good morning");
    expect(greetingFor(12)).toBe("Good afternoon");
    expect(greetingFor(17)).toBe("Good afternoon");
    expect(greetingFor(18)).toBe("Good evening");
    expect(greetingFor(23)).toBe("Good evening");
    expect(greetingFor(2)).toBe("Good evening");
  });
});

describe("displayNameFromEmail turns a session email into a friendly first name", () => {
  it("uses the first word of the local part, capitalised", () => {
    expect(displayNameFromEmail("deveku@helix.test")).toBe("Deveku");
    expect(displayNameFromEmail("john.smith@acme.com")).toBe("John");
    expect(displayNameFromEmail("maria_lopez@acme.com")).toBe("Maria");
    expect(displayNameFromEmail("ANA-GOMEZ@acme.com")).toBe("Ana");
  });
  it("returns undefined instead of guessing when there is nothing usable", () => {
    expect(displayNameFromEmail(null)).toBeUndefined();
    expect(displayNameFromEmail(undefined)).toBeUndefined();
    expect(displayNameFromEmail("")).toBeUndefined();
    expect(displayNameFromEmail("@acme.com")).toBeUndefined();
    expect(displayNameFromEmail("1234567@acme.com")).toBeUndefined();
  });
});
