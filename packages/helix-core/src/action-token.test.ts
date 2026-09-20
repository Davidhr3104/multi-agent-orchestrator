import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { resetSecretsCache, setSecrets } from "./secrets";
import { signActionToken, verifyActionToken, type ActionTokenPayload } from "./action-token";

beforeEach(() => {
  delete process.env.HELIX_OPERATOR_KEY;
  resetSecretsCache();
});

afterEach(() => {
  setSecrets({ HELIX_OPERATOR_KEY: "" });
  delete process.env.HELIX_OPERATOR_KEY;
  resetSecretsCache();
});

function payload(overrides: Partial<ActionTokenPayload> = {}): ActionTokenPayload {
  return {
    orgId: "org-1",
    leadId: "lead-1",
    action: "review",
    exp: Date.now() + 60_000,
    ...overrides,
  };
}

describe("action-token", () => {
  it("round-trips a valid token", () => {
    setSecrets({ HELIX_OPERATOR_KEY: "ops-secret" });
    const token = signActionToken(payload());
    const result = verifyActionToken(token);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.payload.orgId).toBe("org-1");
      expect(result.payload.leadId).toBe("lead-1");
      expect(result.payload.action).toBe("review");
    }
  });

  it("rejects a tampered payload", () => {
    setSecrets({ HELIX_OPERATOR_KEY: "ops-secret" });
    const token = signActionToken(payload());
    const [payloadB64, sig] = token.split(".");
    const tamperedPayload = Buffer.from(JSON.stringify(payload({ leadId: "lead-2" })), "utf8").toString(
      "base64url"
    );
    const tampered = `${tamperedPayload}.${sig}`;
    const result = verifyActionToken(tampered);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("tampered");
    expect(payloadB64).not.toBe(tamperedPayload);
  });

  it("rejects an expired token", () => {
    setSecrets({ HELIX_OPERATOR_KEY: "ops-secret" });
    const token = signActionToken(payload({ exp: Date.now() - 1000 }));
    const result = verifyActionToken(token);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("expired");
  });

  it("rejects a malformed token", () => {
    setSecrets({ HELIX_OPERATOR_KEY: "ops-secret" });
    const result = verifyActionToken("not-a-valid-token");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("malformed");
  });

  it("rejects when no signing key is configured", () => {
    const token = signActionToken(payload());
    const result = verifyActionToken(token);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("unconfigured");
  });

  it("rejects a signature produced with a different key", () => {
    setSecrets({ HELIX_OPERATOR_KEY: "key-a" });
    const token = signActionToken(payload());
    setSecrets({ HELIX_OPERATOR_KEY: "key-b" });
    const result = verifyActionToken(token);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("tampered");
  });
});
