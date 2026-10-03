import { mkdtempSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { utcDay, type AttributedLead } from "@helix/core";
import { GET as cronGET } from "@/app/api/cron/marketing-refresh/route";
import { getSourceStatus, resetSourceState } from "./ad-sources";
import { cronAuth, runMarketingRefresh } from "./marketing-refresh";
import { getDecision, getSnapshot, upsertAttributedLeads } from "./store";

process.env.HELIX_MARKETING_DATA_DIR = mkdtempSync(path.join(os.tmpdir(), "helix-mkt-cron-"));

const GOOGLE_ENV = {
  GOOGLE_ADS_DEVELOPER_TOKEN: "dev-token-test",
  GOOGLE_ADS_CLIENT_ID: "client-id-test",
  GOOGLE_ADS_CLIENT_SECRET: "client-secret-test",
  GOOGLE_ADS_REFRESH_TOKEN: "refresh-test",
  GOOGLE_ADS_CUSTOMER_ID: "1234567890",
};

const today = utcDay();
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
const req = (auth?: string) => new Request("http://localhost/api/cron/marketing-refresh", { headers: auth ? { authorization: auth } : {} });

function googleFetch(opts: { oauthFails?: boolean } = {}) {
  return vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
    const u = String(url);
    if (u.includes("oauth2.googleapis.com")) {
      return opts.oauthFails ? json({ error: "invalid_grant", error_description: "Bad refresh token" }, 400) : json({ access_token: "ya29.test" });
    }
    if (u.includes("googleads.googleapis.com")) {
      return json([
        {
          results: [
            { campaign: { id: "9001", name: "Search · Broad" }, segments: { date: today }, metrics: { costMicros: "500000000", clicks: "80", conversions: 10 } },
          ],
        },
      ]);
    }
    if (u.includes("hooks.slack.test")) return new Response(init?.body ? "ok" : "no body", { status: init?.body ? 200 : 400 });
    throw new Error(`Unexpected network call in test: ${u}`);
  });
}

const leads: AttributedLead[] = Array.from({ length: 10 }, (_, i) => ({
  id: `lead-${i}`,
  campaignId: "9001",
  name: `L${i}`,
  email: `l${i}@example.com`,
  classification: i < 6 ? "spam" : "lead",
  score: i < 6 ? 5 : 40,
  tier: "cold",
  confidence: 0.9,
  createdAt: `${today}T10:00:00.000Z`,
}));

beforeEach(async () => {
  for (const [k, v] of Object.entries(GOOGLE_ENV)) vi.stubEnv(k, v);
  vi.stubEnv("ANTHROPIC_API_KEY", "");
  vi.stubEnv("SLACK_WEBHOOK_URL", "");
  vi.stubEnv("CRON_SECRET", "cron-secret-test");
  resetSourceState();
  await upsertAttributedLeads(leads);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("cron auth", () => {
  it("fails closed without CRON_SECRET", async () => {
    vi.stubEnv("CRON_SECRET", "");
    expect(cronAuth(req("Bearer anything"))).toMatchObject({ ok: false, status: 503 });
    expect((await cronGET(req("Bearer anything"))).status).toBe(503);
  });

  it("rejects a missing or wrong bearer token", async () => {
    expect(cronAuth(req())).toMatchObject({ ok: false, status: 401 });
    expect((await cronGET(req("Bearer nope"))).status).toBe(401);
    expect(cronAuth(req("Bearer cron-secret-test"))).toEqual({ ok: true });
  });
});

describe("daily refresh", () => {
  it("refreshes Google spend, builds the report and proposals, and changes nothing by itself", async () => {
    const fetchMock = googleFetch();
    vi.stubGlobal("fetch", fetchMock);

    const res = await cronGET(req("Bearer cron-secret-test"));
    expect(res.status).toBe(200);
    const out = (await res.json()) as Awaited<ReturnType<typeof runMarketingRefresh>>;

    expect(out.mode).toBe("live");
    expect(out.syncs).toEqual([{ source: "google", ok: true, imported: 1, accountId: "1234567890" }]);
    expect(out.appliedChanges).toBe(0);
    expect(out.report?.engine).toBe("deterministic");
    expect(out.report?.metrics.totalSpend).toBe(500);
    expect(out.report?.metrics.spendOnSpam).toBe(300);
    expect(out.report?.proposals).toEqual([expect.objectContaining({ action: "pause_campaign", campaignId: "9001", risk: "confirm" })]);

    expect(await getDecision("9001")).toBeNull();
    const camp = (await getSnapshot("7d")).campaigns.find((c) => c.campaignId === "9001");
    expect(camp?.status).not.toBe("paused");
    expect(getSourceStatus("google").verified).toBe(true);

    const hosts = fetchMock.mock.calls.map((c) => new URL(String(c[0])).host);
    expect(hosts.every((h) => h === "oauth2.googleapis.com" || h === "googleads.googleapis.com")).toBe(true);
  });

  it("re-syncing the same window replaces rows instead of double-counting spend", async () => {
    vi.stubGlobal("fetch", googleFetch());
    await runMarketingRefresh({ slack: false });
    const again = await runMarketingRefresh({ slack: false });
    expect(again.report?.metrics.totalSpend).toBe(500);
  });

  it("marks Google as not connected when the real read fails, and still reports", async () => {
    vi.stubGlobal("fetch", googleFetch({ oauthFails: true }));
    const out = await runMarketingRefresh({ slack: false });
    expect(out.syncs[0]).toMatchObject({ source: "google", ok: false });
    expect(out.syncs[0].error).toMatch(/Bad refresh token/);
    const status = getSourceStatus("google");
    expect(status.configured).toBe(true);
    expect(status.verified).toBe(false);
    expect(status.lastError).toMatch(/Bad refresh token/);
    expect(out.report).not.toBeNull();
  });

  it("posts to Slack saying nothing was paused or scaled", async () => {
    vi.stubEnv("SLACK_WEBHOOK_URL", "https://hooks.slack.test/services/T/B/X");
    const fetchMock = googleFetch();
    vi.stubGlobal("fetch", fetchMock);
    const out = await runMarketingRefresh();
    expect(out.postedToSlack).toBe(true);
    const slackCall = fetchMock.mock.calls.find((c) => String(c[0]).includes("hooks.slack.test"));
    const text = JSON.parse(String((slackCall?.[1] as RequestInit).body)).text as string;
    expect(text).toContain("Nothing was paused or scaled automatically");
    expect(text).toContain("Google Ads: 1 spend rows refreshed.");
  });
});
