import { afterEach, describe, expect, it } from "vitest";
import { matchesSingleTenantIntakeToken, parseIntakeRequest } from "./intake";
import { isolateSecrets } from "./test-env";

let restore: () => void;

afterEach(() => restore?.());

describe("parseIntakeRequest", () => {
  it("reads JSON and joins first/last name", async () => {
    const req = new Request("https://x.test", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ first_name: "Ana", last_name: "Ruiz", email: "ana@acme.co", message: "Need a quote" }),
    });
    const res = await parseIntakeRequest(req);
    expect(res).toMatchObject({ ok: true, input: { name: "Ana Ruiz", email: "ana@acme.co", message: "Need a quote" } });
  });

  it("reads a plain HTML form post", async () => {
    const req = new Request("https://x.test", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ name: "Ana", email: "ana@acme.co", budget: "5000" }).toString(),
    });
    const res = await parseIntakeRequest(req);
    expect(res).toMatchObject({ ok: true, input: { name: "Ana", budget: "5000" } });
  });

  it("drops honeypot submissions and rejects missing email", async () => {
    const bot = new Request("https://x.test", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "Bot", email: "b@b.co", _gotcha: "http://spam" }),
    });
    expect(await parseIntakeRequest(bot)).toEqual({ ok: false, honeypot: true });
    const bad = new Request("https://x.test", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "No Email" }),
    });
    expect(await parseIntakeRequest(bad)).toMatchObject({ ok: false, error: "email is required." });
  });
});

describe("matchesSingleTenantIntakeToken", () => {
  it("is closed when HELIX_INTAKE_TOKEN is unset and exact-match otherwise", () => {
    restore = isolateSecrets();
    expect(matchesSingleTenantIntakeToken("")).toBe(false);
    expect(matchesSingleTenantIntakeToken("abc")).toBe(false);
    restore();
    restore = isolateSecrets({ HELIX_INTAKE_TOKEN: "tok-123" });
    expect(matchesSingleTenantIntakeToken("tok-123")).toBe(true);
    expect(matchesSingleTenantIntakeToken("tok-124")).toBe(false);
  });
});
