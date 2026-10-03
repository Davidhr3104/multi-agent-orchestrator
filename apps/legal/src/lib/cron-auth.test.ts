import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { verifyCronRequest } from "./cron-auth";
import { GET } from "@/app/api/cron/sam-sync/route";

const SECRET = "cron-secret-for-tests-0123456789";

function req(auth?: string): Request {
  return new Request("http://localhost/api/cron/sam-sync", { headers: auth ? { authorization: auth } : {} });
}

describe("verifyCronRequest", () => {
  it("keeps the job closed when CRON_SECRET is not configured", () => {
    expect(verifyCronRequest(req(`Bearer ${SECRET}`), "")).toEqual({
      ok: false,
      status: 503,
      error: expect.stringMatching(/CRON_SECRET/),
    });
  });

  it("rejects a missing or wrong bearer token", () => {
    expect(verifyCronRequest(req(), SECRET)).toMatchObject({ ok: false, status: 401 });
    expect(verifyCronRequest(req("Bearer nope"), SECRET)).toMatchObject({ ok: false, status: 401 });
    expect(verifyCronRequest(req(SECRET), SECRET)).toMatchObject({ ok: false, status: 401 });
  });

  it("accepts the exact Vercel Cron header", () => {
    expect(verifyCronRequest(req(`Bearer ${SECRET}`), SECRET)).toEqual({ ok: true });
  });
});

describe("GET /api/cron/sam-sync", () => {
  beforeEach(() => {
    delete process.env.CRON_SECRET;
    delete process.env.SAM_GOV_API_KEY;
  });
  afterEach(() => {
    delete process.env.CRON_SECRET;
    delete process.env.SAM_GOV_API_KEY;
  });

  it("returns 503 without CRON_SECRET and 401 with a wrong token", async () => {
    expect((await GET(req(`Bearer ${SECRET}`))).status).toBe(503);
    process.env.CRON_SECRET = SECRET;
    const denied = await GET(req("Bearer wrong"));
    expect(denied.status).toBe(401);
    expect(await denied.json()).toEqual({ error: "Unauthorized." });
  });

  it("runs when authorized and reports honestly that SAM.gov is not configured", async () => {
    process.env.CRON_SECRET = SECRET;
    const res = await GET(req(`Bearer ${SECRET}`));
    expect(res.status).toBe(200);
    const body = (await res.json()) as { status: string; via: string; imported: unknown[] };
    expect(body).toMatchObject({ status: "not_configured", via: "cron", imported: [] });
  });
});
