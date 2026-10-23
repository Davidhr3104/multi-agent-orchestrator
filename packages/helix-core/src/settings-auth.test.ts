import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { OPERATOR_COOKIE, operatorToken } from "./operator";
import { getSecret, keysGetResponse, keysPostResponse, resetSecretsCache, setSecrets } from "./secrets";
import { redactDeskStatus, settingsDeskWriteDenied, settingsWriteDenied } from "./settings-auth";

const FIELD = [{ name: "ANTHROPIC_API_KEY", label: "Claude", hint: "Powers drafts." }];
const dir = mkdtempSync(path.join(tmpdir(), "helix-settings-auth-"));
const prevPath = process.env.HELIX_SECRETS_PATH;

beforeEach(() => {
  process.env.HELIX_SECRETS_PATH = path.join(dir, "secrets.json");
  resetSecretsCache();
  setSecrets({ ANTHROPIC_API_KEY: "", HELIX_OPERATOR_KEY: "" });
  delete process.env.ANTHROPIC_API_KEY;
  delete process.env.HELIX_OPERATOR_KEY;
  resetSecretsCache();
});

afterAll(() => {
  setSecrets({ ANTHROPIC_API_KEY: "", HELIX_OPERATOR_KEY: "" });
  delete process.env.ANTHROPIC_API_KEY;
  delete process.env.HELIX_OPERATOR_KEY;
  if (prevPath) process.env.HELIX_SECRETS_PATH = prevPath;
  else delete process.env.HELIX_SECRETS_PATH;
  resetSecretsCache();
  rmSync(dir, { recursive: true, force: true });
});

function post(url: string, body: unknown, headers: Record<string, string> = {}) {
  return new Request(url, {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
}

describe("settings keys", () => {
  it("rejects an unauthenticated write when no operator key is configured", async () => {
    const res = await keysPostResponse(post("http://localhost/api/settings/keys", { ANTHROPIC_API_KEY: "sk-ant-nope" }), FIELD);
    expect(res.status).toBe(403);
    expect(getSecret("ANTHROPIC_API_KEY")).toBe("");
  });

  it("rejects an unauthenticated write, including a lookalike action token, when the operator key is set", async () => {
    setSecrets({ HELIX_OPERATOR_KEY: "ops-secret" });
    const open = await keysPostResponse(
      post("http://localhost/api/settings/keys", { ANTHROPIC_API_KEY: "sk-ant-nope" }),
      FIELD
    );
    expect(open.status).toBe(401);
    const bypass = await keysPostResponse(
      post("http://localhost/api/settings/keys?t=not-a-real.token", { ANTHROPIC_API_KEY: "sk-ant-nope" }),
      FIELD
    );
    expect(bypass.status).toBe(401);
    expect(getSecret("ANTHROPIC_API_KEY")).toBe("");
  });

  it("accepts a write that presents the operator key", async () => {
    setSecrets({ HELIX_OPERATOR_KEY: "ops-secret" });
    const res = await keysPostResponse(
      post(
        "http://localhost/api/settings/keys",
        { ANTHROPIC_API_KEY: "sk-ant-ok" },
        { "x-helix-operator-key": "ops-secret" }
      ),
      FIELD
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { readOnly: boolean; keys: { configured: boolean; masked: string | null }[] };
    expect(body.readOnly).toBe(false);
    expect(body.keys[0]?.configured).toBe(true);
    expect(body.keys[0]?.masked).toBe("••••");
    expect(getSecret("ANTHROPIC_API_KEY")).toBe("sk-ant-ok");
  });

  it("accepts a write from an app session even when no operator key is configured", async () => {
    const res = await keysPostResponse(
      post("http://localhost/api/settings/keys", { ANTHROPIC_API_KEY: "sk-ant-session" }),
      FIELD,
      { session: true }
    );
    expect(res.status).toBe(200);
    expect(getSecret("ANTHROPIC_API_KEY")).toBe("sk-ant-session");
  });

  it("serves a demo-mode read that does not reveal which secrets are configured", async () => {
    setSecrets({ ANTHROPIC_API_KEY: "sk-ant-LEAKCHECK-9876543210", HELIX_OPERATOR_KEY: "" });
    const res = await keysGetResponse(FIELD, new Request("http://localhost/api/settings/keys"));
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).toContain('"readOnly":true');
    expect(text).toContain('"label":"Claude"');
    expect(text).not.toContain('"configured":true');
    expect(text).not.toMatch(/sk-a|LEAKCHECK|3210|••••/);
  });

  it("reveals configured status to the operator cookie", async () => {
    setSecrets({ ANTHROPIC_API_KEY: "sk-ant-visible", HELIX_OPERATOR_KEY: "ops-secret" });
    const res = await keysGetResponse(
      FIELD,
      new Request("http://localhost/api/settings/keys", {
        headers: { cookie: `${OPERATOR_COOKIE}=${operatorToken("ops-secret")}` },
      })
    );
    const body = (await res.json()) as { readOnly: boolean; keys: { configured: boolean }[] };
    expect(body.readOnly).toBe(false);
    expect(body.keys[0]?.configured).toBe(true);
    expect(JSON.stringify(body)).not.toContain("sk-ant-visible");
  });
});

describe("settings desk mutations", () => {
  it("lets the public demo reload through and refuses every other write", () => {
    const req = new Request("http://localhost/api/settings/desk", { method: "POST" });
    expect(settingsDeskWriteDenied(req, "demo")).toBeNull();
    expect(settingsDeskWriteDenied(req, "empty")?.status).toBe(403);
    expect(settingsWriteDenied(req)?.status).toBe(403);
  });

  it("hides integration flags on an unprivileged desk read", () => {
    const hidden = redactDeskStatus(
      { mode: "live", demo: false, empty: false, count: 3, connected: true, store: "supabase", supabase: true },
      false
    );
    expect(hidden.mode).toBe("live");
    expect(hidden.count).toBe(3);
    expect(hidden.connected).toBe(false);
    expect(hidden.store).toBe("memory");
    expect(hidden.supabase).toBe(false);
  });
});
