import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { isolateSecrets } from "./test-env";

const KEY = "test-operator-key";
let restore: () => void = () => undefined;
let savedKey: string | undefined;

function setup(env: Parameters<typeof isolateSecrets>[0] = {}, operatorKey: string | null = KEY) {
  if (operatorKey) process.env.HELIX_OPERATOR_KEY = operatorKey;
  else delete process.env.HELIX_OPERATOR_KEY;
  restore = isolateSecrets(env);
}

beforeEach(() => {
  savedKey = process.env.HELIX_OPERATOR_KEY;
  vi.resetModules();
});

afterEach(() => {
  restore();
  if (savedKey === undefined) delete process.env.HELIX_OPERATOR_KEY;
  else process.env.HELIX_OPERATOR_KEY = savedKey;
});

const visitor = () => new Request("http://localhost/api/leads/bulk", { method: "POST" });
const operator = () =>
  new Request("http://localhost/api/leads/bulk", { method: "POST", headers: { "x-helix-operator-key": KEY } });

describe("deskWriteDenied", () => {
  it("is open when no operator key is configured", async () => {
    setup({ HUBSPOT_TOKEN: "pat-test" }, null);
    const { deskWriteDenied } = await import("./org-auth");
    expect(await deskWriteDenied(visitor())).toBeNull();
  });

  it("lets visitors change a demo desk even with the operator key set", async () => {
    setup();
    const { deskWriteDenied, mayChangeDesk } = await import("./org-auth");
    expect(await mayChangeDesk(visitor())).toBe(true);
    expect(await deskWriteDenied(visitor())).toBeNull();
  });

  it("requires the operator on a live desk", async () => {
    setup({ HUBSPOT_TOKEN: "pat-test" });
    const { deskWriteDenied } = await import("./org-auth");
    const denied = await deskWriteDenied(visitor());
    expect(denied?.status).toBe(401);
    expect(await denied?.json()).toEqual({ error: "Operator unlock required." });
    expect(await deskWriteDenied(operator())).toBeNull();
  });

  it("treats a demo-disabled deployment as live", async () => {
    setup({ HELIX_DESK_SEED: "off" });
    const { deskWriteDenied } = await import("./org-auth");
    expect((await deskWriteDenied(visitor()))?.status).toBe(401);
  });
});
