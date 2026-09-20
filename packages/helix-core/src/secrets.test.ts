import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { getSecret, listSecretStatus, maskSecret, resetSecretsCache, setSecrets } from "./secrets";

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
  it("masks without returning the full key", () => {
    expect(maskSecret("sk-ant-1234567890abcd")).toBe("sk-a…abcd");
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
