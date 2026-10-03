import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const desk = vi.hoisted(() => ({ mode: "demo" as "demo" | "live" }));

vi.mock("@/lib/store", () => ({
  currentDeskMode: () => desk.mode,
  applyDeskPatches: () => undefined,
  getMessage: async () => null,
  getThread: async () => null,
  patchMessage: async () => null,
  regenerateSmartReply: async () => null,
  snoozeThread: async () => null,
}));

vi.mock("@/lib/mail-sync", () => ({
  syncMailboxes: async () => ({ ok: true, imported: 0, scanned: 0, accountsSynced: 0, errors: [] }),
}));

const KEY = "test-operator-key";

function request(path: string, headers: Record<string, string> = {}) {
  return new Request(`http://localhost${path}`, { method: "POST", headers });
}

const unblock = async (headers?: Record<string, string>) => {
  const { POST } = await import("@/app/api/threads/[id]/unblock/route");
  return POST(request("/api/threads/thr-1/unblock", headers), { params: Promise.resolve({ id: "thr-1" }) });
};

const sync = async (headers?: Record<string, string>) => {
  const { POST } = await import("@/app/api/messages/sync/route");
  return POST(request("/api/messages/sync", headers));
};

beforeEach(() => {
  vi.stubEnv("HELIX_SECRETS_PATH", "./.no-secrets-in-tests.json");
  vi.stubEnv("HELIX_OPERATOR_KEY", KEY);
  desk.mode = "demo";
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("operator gating", () => {
  it("lets a demo visitor change the desk without the operator cookie", async () => {
    const { deskWriteDenied } = await import("@/lib/ai-desk");
    expect(deskWriteDenied(request("/api/messages/bulk"))).toBeNull();
    const res = await unblock();
    expect(res.status).not.toBe(401);
  });

  it("requires the operator unlock to change a live desk", async () => {
    desk.mode = "live";
    const res = await unblock();
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "Operator unlock required." });
  });

  it("keeps real-provider routes locked in demo and live", async () => {
    const { POST: agent } = await import("@/app/api/ask-ai/agent/route");
    for (const mode of ["demo", "live"] as const) {
      desk.mode = mode;
      expect((await sync()).status).toBe(401);
      expect((await agent(request("/api/ask-ai/agent"))).status).toBe(401);
    }
    const { mayUseClaude } = await import("@/lib/ai-desk");
    expect(mayUseClaude(request("/api/ask-ai"))).toBe(false);
  });

  it("accepts a valid x-helix-operator-key header everywhere", async () => {
    desk.mode = "live";
    const headers = { "x-helix-operator-key": KEY };
    expect((await unblock(headers)).status).not.toBe(401);
    expect((await sync(headers)).status).toBe(200);
    const { mayUseClaude } = await import("@/lib/ai-desk");
    expect(mayUseClaude(request("/api/ask-ai", headers))).toBe(true);
  });

  it("rejects a wrong operator key header", async () => {
    desk.mode = "live";
    expect((await unblock({ "x-helix-operator-key": "nope" })).status).toBe(401);
  });
});
