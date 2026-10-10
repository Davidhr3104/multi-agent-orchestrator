import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { getSecret, keysGetResponse, keysPostResponse, listSecretStatus, maskSecret, resetSecretsCache, setSecrets } from "./secrets";

const prevPath = process.env.HELIX_SECRETS_PATH;
const dir = mkdtempSync(path.join(tmpdir(), "helix-secrets-"));
process.env.HELIX_SECRETS_PATH = path.join(dir, "secrets.json");

afterAll(() => {
  setSecrets({ ANTHROPIC_API_KEY: "" });
  if (prevPath) process.env.HELIX_SECRETS_PATH = prevPath;
  else delete process.env.HELIX_SECRETS_PATH;
  resetSecretsCache();
  rmSync(dir, { recursive: true, force: true });
});

describe("secrets", () => {
  it("masks without returning any character of the key", () => {
    expect(maskSecret("sk-ant-1234567890abcd")).toBe("••••");
    expect(maskSecret("short")).toBe("••••");
    expect(maskSecret("   ")).toBeNull();
    // A fragment of a short secret is most of the secret, so no fragment is ever shown.
    const masked = maskSecret("operatorkey12") ?? "";
    expect(masked).not.toMatch(/oper|key1|2/);
  });

  it("the public status response never carries a character of a stored secret or which keys are set", async () => {
    setSecrets({ ANTHROPIC_API_KEY: "sk-ant-LEAKCHECK-9876543210" });
    const res = await keysGetResponse([{ name: "ANTHROPIC_API_KEY", label: "Claude", hint: "" }]);
    const text = await res.text();
    expect(res.status).toBe(200);
    expect(text).toContain('"configured":false');
    expect(text).toContain('"readOnly":true');
    expect(text).not.toContain('"configured":true');
    expect(text).not.toMatch(/sk-a|LEAKCHECK|3210/);
  });

  it("refuses to save keys when no operator key is configured, including off Vercel", async () => {
    const prevVercel = process.env.VERCEL;
    delete process.env.VERCEL;
    setSecrets({ HELIX_OPERATOR_KEY: "" });
    try {
      const req = new Request("http://localhost/api/settings/keys", {
        method: "POST",
        body: JSON.stringify({ ANTHROPIC_API_KEY: "sk-ant-attacker" }),
      });
      const res = await keysPostResponse(req, [{ name: "ANTHROPIC_API_KEY", label: "Claude", hint: "" }]);
      expect(res.status).toBe(403);
      expect(getSecret("ANTHROPIC_API_KEY")).not.toBe("sk-ant-attacker");
    } finally {
      if (prevVercel === undefined) delete process.env.VERCEL;
      else process.env.VERCEL = prevVercel;
    }
  });

  it("stores a pasted key and reports configured", () => {
    setSecrets({ ANTHROPIC_API_KEY: " sk-ant-helix-test-key " });
    expect(getSecret("ANTHROPIC_API_KEY")).toBe("sk-ant-helix-test-key");
    const row = listSecretStatus([
      { name: "ANTHROPIC_API_KEY", label: "Claude", hint: "" },
    ])[0];
    expect(row.configured).toBe(true);
    expect(row.masked).not.toContain("helix-test-key");
  });

  it("ignores unknown env names", () => {
    setSecrets({ NOT_A_KEY: "nope" } as Record<string, string>);
    expect(getSecret("NOT_A_KEY")).toBe("");
  });
});
