import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "@/app/api/cron/triage/route";
import { checkCronAuth } from "./cron-auth";
import { loadDemoCatalog } from "./store";

const req = (auth?: string) => new Request("http://localhost/api/cron/triage", { headers: auth ? { authorization: auth } : {} });

beforeEach(async () => {
  vi.stubEnv("HELIX_SECRETS_PATH", "./.no-secrets-in-tests.json");
  vi.stubEnv("ANTHROPIC_API_KEY", "");
  vi.stubEnv("CRON_SECRET", "");
  await loadDemoCatalog();
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("cron auth", () => {
  it("stays off when CRON_SECRET is not configured", async () => {
    expect(checkCronAuth(req("Bearer anything"))).toMatchObject({ ok: false, status: 503 });
    const res = await GET(req("Bearer anything"));
    expect(res.status).toBe(503);
  });

  it("rejects a missing or wrong bearer token", async () => {
    vi.stubEnv("CRON_SECRET", "s3cret");
    expect((await GET(req())).status).toBe(401);
    expect((await GET(req("Bearer wrong"))).status).toBe(401);
    expect((await GET(req("s3cret"))).status).toBe(401);
  });

  it("accepts Vercel's bearer token, and on a demo desk triages nothing and sends nothing", async () => {
    vi.stubEnv("CRON_SECRET", "s3cret");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const res = await GET(req("Bearer s3cret"));
    expect(res.status).toBe(200);
    const body = (await res.json()) as { skipped?: string; sent: number };
    expect(body.skipped).toMatch(/demo/);
    expect(body.sent).toBe(0);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
