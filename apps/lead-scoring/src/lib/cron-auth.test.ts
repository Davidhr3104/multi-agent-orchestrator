import { afterEach, describe, expect, it } from "vitest";
import { checkCronAuth } from "./cron-auth";
import { isolateSecrets } from "./test-env";

let restore: () => void;

afterEach(() => restore?.());

function req(auth?: string): Request {
  return new Request("https://helix.test/api/cron/triage", {
    headers: auth ? { authorization: auth } : {},
  });
}

describe("checkCronAuth", () => {
  it("keeps the route closed when CRON_SECRET is not configured", () => {
    restore = isolateSecrets();
    expect(checkCronAuth(req("Bearer anything"))?.status).toBe(503);
  });

  it("rejects a missing or wrong bearer token", () => {
    restore = isolateSecrets({ CRON_SECRET: "s3cret-value" });
    expect(checkCronAuth(req())?.status).toBe(401);
    expect(checkCronAuth(req("Bearer wrong"))?.status).toBe(401);
    expect(checkCronAuth(req("s3cret-value"))?.status).toBe(401);
  });

  it("lets Vercel Cron's Authorization header through", () => {
    restore = isolateSecrets({ CRON_SECRET: "s3cret-value" });
    expect(checkCronAuth(req("Bearer s3cret-value"))).toBeNull();
  });
});
