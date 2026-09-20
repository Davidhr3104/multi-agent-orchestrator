import { afterEach, describe, expect, it } from "vitest";
import { autoSeedEnabled } from "./desk-mode";
import { OPERATOR_COOKIE, operatorActor, operatorToken, requireOperator } from "./operator";
import { resetSecretsCache, setSecrets } from "./secrets";

afterEach(() => {
  setSecrets({ HELIX_OPERATOR_KEY: "" });
  delete process.env.HELIX_OPERATOR_KEY;
  delete process.env.HELIX_DESK_SEED;
  resetSecretsCache();
});

describe("autoSeedEnabled", () => {
  it("is off unless HELIX_DESK_SEED=demo", () => {
    expect(autoSeedEnabled()).toBe(false);
    process.env.HELIX_DESK_SEED = "empty";
    expect(autoSeedEnabled()).toBe(false);
    process.env.HELIX_DESK_SEED = "demo";
    expect(autoSeedEnabled()).toBe(true);
  });
});

describe("requireOperator", () => {
  it("allows all requests when no operator key is set", () => {
    const denied = requireOperator(new Request("http://localhost/api/review", { method: "POST" }));
    expect(denied).toBeNull();
  });

  it("denies when a key is set and nothing authenticates", async () => {
    setSecrets({ HELIX_OPERATOR_KEY: "ops-secret" });
    const denied = requireOperator(new Request("http://localhost/api/review", { method: "POST" }));
    expect(denied).not.toBeNull();
    expect(denied?.status).toBe(401);
  });

  it("allows cookie, header, or Slack ops query", () => {
    setSecrets({ HELIX_OPERATOR_KEY: "ops-secret" });
    const token = operatorToken("ops-secret");
    expect(
      requireOperator(
        new Request("http://localhost/api/review", {
          headers: { cookie: `${OPERATOR_COOKIE}=${token}` },
        })
      )
    ).toBeNull();
    expect(
      requireOperator(
        new Request("http://localhost/api/review", {
          headers: { "x-helix-operator-key": "ops-secret" },
        })
      )
    ).toBeNull();
    expect(requireOperator(new Request(`http://localhost/api/review?ops=${token}`))).toBeNull();
  });

  it("names the actor local, operator, or slack", () => {
    expect(operatorActor(new Request("http://localhost/api/review"))).toBe("local");
    setSecrets({ HELIX_OPERATOR_KEY: "ops-secret" });
    const token = operatorToken("ops-secret");
    expect(
      operatorActor(
        new Request("http://localhost/api/review", {
          headers: { cookie: `${OPERATOR_COOKIE}=${token}` },
        })
      )
    ).toBe("operator");
    expect(operatorActor(new Request(`http://localhost/api/review?ops=${token}`))).toBe("slack");
  });
});
