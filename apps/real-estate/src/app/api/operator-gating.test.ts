import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { OPERATOR_COOKIE, operatorToken } from "@helix/core/operator";
import { POST as askAi } from "./ask-ai/route";
import { POST as execute } from "./ask-ai/execute/route";
import { POST as importRoute } from "./import/route";
import { POST as hubspot } from "./leads/[id]/hubspot/route";
import { POST as unlock } from "./operator/route";
import { POST as send } from "./outreach/[id]/send/route";
import { POST as listingCopy } from "./properties/[id]/listing-copy/route";
import { listProperties } from "@/lib/store";

const KEY = "test-operator-key";
const ENV = ["HELIX_OPERATOR_KEY", "HELIX_DESK_SEED", "ANTHROPIC_API_KEY", "HELIX_SECRETS_PATH"] as const;
let saved: Record<string, string | undefined> = {};

beforeEach(() => {
  saved = Object.fromEntries(ENV.map((k) => [k, process.env[k]]));
  for (const k of ENV) delete process.env[k];
  process.env.HELIX_SECRETS_PATH = "./.data/__no-secrets-in-tests__.json";
  const g = globalThis as { __helixSecretsLoaded?: boolean; __helixSecrets?: Record<string, string>; __helixRealEstate?: unknown };
  g.__helixSecretsLoaded = true;
  g.__helixSecrets = {};
  delete g.__helixRealEstate;
  process.env.HELIX_OPERATOR_KEY = KEY;
});
afterEach(() => {
  for (const k of ENV) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
  vi.unstubAllGlobals();
});

function req(path: string, body: unknown, headers: Record<string, string> = {}) {
  return new Request(`http://localhost${path}`, { method: "POST", headers: { "content-type": "application/json", ...headers }, body: JSON.stringify(body) });
}
const params = (id: string) => ({ params: Promise.resolve({ id }) });
const live = () => {
  process.env.HELIX_DESK_SEED = "off";
};

describe("desk actions: open on the demo desk, gated on a live desk", () => {
  it("ask-ai/execute runs on the demo desk without a cookie", async () => {
    const res = await execute(req("/api/ask-ai/execute", {}));
    expect(res.status).not.toBe(401);
  });

  it("ask-ai/execute needs the operator on a live desk", async () => {
    live();
    const res = await execute(req("/api/ask-ai/execute", {}));
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "Operator unlock required." });
  });

  it("a valid x-helix-operator-key header unlocks a live desk", async () => {
    live();
    expect((await execute(req("/api/ask-ai/execute", {}, { "x-helix-operator-key": KEY }))).status).not.toBe(401);
  });

  it("the operator cookie unlocks a live desk", async () => {
    live();
    expect((await execute(req("/api/ask-ai/execute", {}, { cookie: `${OPERATOR_COOKIE}=${operatorToken(KEY)}` }))).status).not.toBe(401);
  });
});

describe("real providers need the operator on any desk", () => {
  for (const mode of ["demo", "live"] as const) {
    it(`outreach send, HubSpot push and import return 401 without a cookie (${mode})`, async () => {
      if (mode === "live") live();
      expect((await send(req("/api/outreach/d-1/send", { channel: "email", confirm: true }), params("d-1"))).status).toBe(401);
      expect((await hubspot(req("/api/leads/l-1/hubspot", { confirm: true }), params("l-1"))).status).toBe(401);
      expect((await importRoute(req("/api/import", { kind: "buyers", csv: "name\nA" }))).status).toBe(401);
    });
  }

  it("the operator header gets past the gate", async () => {
    const h = { "x-helix-operator-key": KEY };
    expect((await send(req("/api/outreach/d-1/send", {}, h), params("d-1"))).status).toBe(400);
    expect((await hubspot(req("/api/leads/l-1/hubspot", {}, h), params("l-1"))).status).toBe(400);
    expect((await importRoute(req("/api/import", {}, h))).status).toBe(400);
  });
});

describe("paid Claude calls fall back without the operator", () => {
  beforeEach(() => {
    process.env.ANTHROPIC_API_KEY = "sk-test";
    vi.stubGlobal("fetch", vi.fn(() => Promise.reject(new Error("Claude must not be called"))));
  });

  it("listing copy returns the template", async () => {
    const [p] = await listProperties();
    const res = await listingCopy(req(`/api/properties/${p.id}/listing-copy`, { action: "generate" }), params(p.id));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.engine).toBe("template");
    expect(body.note).toBe("Operator unlock required.");
    expect(fetch).not.toHaveBeenCalled();
  });

  it("Ask AI answers with the deterministic assistant", async () => {
    const res = await askAi(req("/api/ask-ai", { mode: "drawer", history: [{ role: "user", content: "Who are my hot buyers?" }] }));
    expect(res.status).toBe(200);
    expect((await res.json()).engine).toBe("fallback");
    expect(fetch).not.toHaveBeenCalled();
  });
});

describe("/api/operator", () => {
  it("sets the httpOnly cookie for the right key", async () => {
    const res = await unlock(req("/api/operator", { key: KEY }));
    expect(res.status).toBe(200);
    const cookie = res.headers.get("set-cookie") ?? "";
    expect(cookie).toContain(`${OPERATOR_COOKIE}=${operatorToken(KEY)}`);
    expect(cookie).toContain("HttpOnly");
  });

  it("rejects a wrong key", async () => {
    const res = await unlock(req("/api/operator", { key: "wrong" }));
    expect(res.status).toBe(401);
    expect(res.headers.get("set-cookie")).toBeNull();
  });
});
