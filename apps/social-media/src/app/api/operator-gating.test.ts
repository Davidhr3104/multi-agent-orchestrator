import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { OPERATOR_COOKIE, operatorToken } from "@helix/core/operator";
import { POST as askAi } from "./ask-ai/route";
import { POST as execute } from "./ask-ai/execute/route";
import { POST as unlock } from "./operator/route";
import { POST as publish } from "./posts/[id]/publish/route";
import { POST as review } from "./posts/[id]/review/route";
import { POST as social } from "./social/route";
import { saveEnv } from "@/lib/social/test-helpers";

const KEY = "test-operator-key";
let restore: () => void;

beforeEach(() => {
  restore = saveEnv();
  const g = globalThis as { __helixSecretsLoaded?: boolean; __helixSecrets?: Record<string, string>; __helixSocialDesk?: unknown };
  g.__helixSecretsLoaded = true;
  g.__helixSecrets = {};
  delete g.__helixSocialDesk;
  process.env.HELIX_OPERATOR_KEY = KEY;
  delete process.env.HELIX_DESK_SEED;
});
afterEach(() => {
  restore();
  delete process.env.HELIX_OPERATOR_KEY;
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

  it("post review follows the same rule", async () => {
    expect((await review(req("/api/posts/x/review", { decision: "nope" }), params("x"))).status).toBe(400);
    live();
    expect((await review(req("/api/posts/x/review", { decision: "nope" }), params("x"))).status).toBe(401);
  });

  it("a valid x-helix-operator-key header unlocks a live desk", async () => {
    live();
    const res = await execute(req("/api/ask-ai/execute", {}, { "x-helix-operator-key": KEY }));
    expect(res.status).not.toBe(401);
  });

  it("the cookie set by /api/operator unlocks a live desk", async () => {
    live();
    const res = await execute(req("/api/ask-ai/execute", {}, { cookie: `${OPERATOR_COOKIE}=${operatorToken(KEY)}` }));
    expect(res.status).not.toBe(401);
  });
});

describe("real and paid actions need the operator on any desk", () => {
  for (const mode of ["demo", "live"] as const) {
    it(`publish and real-data actions return 401 without a cookie (${mode})`, async () => {
      if (mode === "live") live();
      expect((await publish(req("/api/posts/p-1/publish", { confirm: true }), params("p-1"))).status).toBe(401);
      expect((await social(req("/api/social", { action: "drafts" }))).status).toBe(401);
    });
  }

  it("the operator header gets past the gate", async () => {
    const res = await publish(req("/api/posts/p-1/publish", {}, { "x-helix-operator-key": KEY }), params("p-1"));
    expect(res.status).toBe(400);
  });

  it("Ask AI answers with the deterministic assistant instead of calling Claude when not unlocked", async () => {
    process.env.ANTHROPIC_API_KEY = "sk-test";
    const fetchSpy = vi.fn(() => Promise.reject(new Error("Claude must not be called")));
    vi.stubGlobal("fetch", fetchSpy);
    const res = await askAi(req("/api/ask-ai", { mode: "drawer", history: [{ role: "user", content: "What needs review?" }] }));
    expect(res.status).toBe(200);
    expect((await res.json()).engine).toBe("fallback");
    expect(fetchSpy).not.toHaveBeenCalled();
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
