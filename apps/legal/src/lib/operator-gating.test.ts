import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mode = vi.hoisted(() => ({ current: "demo" as "demo" | "live" }));

vi.mock("@/lib/store", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/store")>()),
  currentDeskMode: () => mode.current,
  getRfp: async () => null,
}));

import { deskWriteDenied, mayChangeDesk } from "./ai-desk";
import { POST as createNoBidRule } from "@/app/api/no-bid-rules/route";
import { POST as aiReview } from "@/app/api/rfps/[id]/ai-review/route";

const KEY = "operator-key-for-tests-0123456789";

function req(url: string, headers: Record<string, string> = {}): Request {
  return new Request(url, { method: "POST", headers: { "content-type": "application/json", ...headers }, body: "{}" });
}

const ruleReq = (headers?: Record<string, string>) => req("http://localhost/api/no-bid-rules", headers);
const reviewReq = (headers?: Record<string, string>) => req("http://localhost/api/rfps/missing/ai-review", headers);
const reviewParams = { params: Promise.resolve({ id: "missing" }) };

describe("operator gating", () => {
  beforeEach(() => {
    process.env.HELIX_OPERATOR_KEY = KEY;
    mode.current = "demo";
  });
  afterEach(() => {
    delete process.env.HELIX_OPERATOR_KEY;
  });

  it("lets a demo visitor change the desk without the operator key", async () => {
    expect(mayChangeDesk(ruleReq())).toBe(true);
    expect(deskWriteDenied(ruleReq())).toBeNull();
    expect((await createNoBidRule(ruleReq())).status).toBe(400);
  });

  it("requires the operator key for desk changes on a live desk", async () => {
    mode.current = "live";
    const res = await createNoBidRule(ruleReq());
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "Operator unlock required." });
  });

  it("always requires the operator key for Claude calls, in demo or live", async () => {
    for (const m of ["demo", "live"] as const) {
      mode.current = m;
      const res = await aiReview(reviewReq(), reviewParams);
      expect(res.status).toBe(401);
      expect(await res.json()).toEqual({ error: "Operator unlock required." });
    }
  });

  it("accepts a valid x-helix-operator-key header on both kinds of route", async () => {
    mode.current = "live";
    const header = { "x-helix-operator-key": KEY };
    expect(deskWriteDenied(ruleReq(header))).toBeNull();
    expect((await createNoBidRule(ruleReq(header))).status).toBe(400);
    expect((await aiReview(reviewReq(header), reviewParams)).status).toBe(404);
  });

  it("rejects a wrong operator key", async () => {
    mode.current = "live";
    expect((await createNoBidRule(ruleReq({ "x-helix-operator-key": "wrong" }))).status).toBe(401);
  });
});
