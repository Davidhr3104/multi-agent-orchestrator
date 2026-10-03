import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildCampaignSpendQuery,
  fetchGoogleAdsCampaignSpend,
  isGoogleAdsConfigured,
  mapGoogleAdsRows,
  normalizeCustomerId,
} from "./google-ads";

const ENV = {
  GOOGLE_ADS_DEVELOPER_TOKEN: "dev-token-test",
  GOOGLE_ADS_CLIENT_ID: "client-id-test",
  GOOGLE_ADS_CLIENT_SECRET: "client-secret-test",
  GOOGLE_ADS_REFRESH_TOKEN: "refresh-test",
  GOOGLE_ADS_CUSTOMER_ID: "123-456-7890",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

const streamOk = [
  {
    results: [
      {
        campaign: { resourceName: "customers/1234567890/campaigns/111", id: "111", name: "Search · Brand" },
        segments: { date: "2026-09-28" },
        metrics: { costMicros: "12345678", clicks: "40", impressions: "900", conversions: 3.6 },
      },
      {
        campaign: { id: "222", name: "PMax · Leads" },
        segments: { date: "2026-09-28" },
        metrics: { costMicros: "0", clicks: "0", impressions: "10" },
      },
    ],
    fieldMask: "campaign.id,campaign.name,segments.date,metrics.costMicros",
  },
];

beforeEach(() => {
  for (const [k, v] of Object.entries(ENV)) vi.stubEnv(k, v);
  vi.stubEnv("GOOGLE_ADS_LOGIN_CUSTOMER_ID", "");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("Google Ads read adapter", () => {
  it("is configured only with all five credentials", () => {
    expect(isGoogleAdsConfigured()).toBe(true);
    vi.stubEnv("GOOGLE_ADS_REFRESH_TOKEN", "");
    expect(isGoogleAdsConfigured()).toBe(false);
  });

  it("builds a date-bounded GAQL query and rejects malformed dates", () => {
    expect(buildCampaignSpendQuery("2026-09-01", "2026-09-07")).toContain("segments.date BETWEEN '2026-09-01' AND '2026-09-07'");
    expect(() => buildCampaignSpendQuery("2026-09-01' OR 1=1 --", "2026-09-07")).toThrow();
    expect(normalizeCustomerId("123-456-7890")).toBe("1234567890");
  });

  it("maps micros to dollars and conversions to form leads", () => {
    const rows = mapGoogleAdsRows(streamOk);
    expect(rows).toEqual([
      { campaignId: "111", name: "Search · Brand", platform: "google", spend: 12.35, impressions: 900, clicks: 40, formLeads: 4, occurredAt: "2026-09-28" },
      { campaignId: "222", name: "PMax · Leads", platform: "google", spend: 0, impressions: 10, clicks: 0, formLeads: undefined, occurredAt: "2026-09-28" },
    ]);
  });

  it("exchanges the refresh token, then calls searchStream with the right headers", async () => {
    vi.stubEnv("GOOGLE_ADS_LOGIN_CUSTOMER_ID", "999-888-7777");
    const fetchMock = vi.fn(async (url: string | URL | Request) => {
      const u = String(url);
      if (u.startsWith("https://oauth2.googleapis.com/token")) return json({ access_token: "ya29.test", expires_in: 3599 });
      return json(streamOk);
    });
    const { rows, accountId } = await fetchGoogleAdsCampaignSpend({ since: "2026-09-22", until: "2026-09-28" }, fetchMock as unknown as typeof fetch);
    expect(accountId).toBe("1234567890");
    expect(rows).toHaveLength(2);

    const [tokenUrl, tokenInit] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(tokenUrl).toBe("https://oauth2.googleapis.com/token");
    expect(String(tokenInit.body)).toContain("grant_type=refresh_token");

    const [adsUrl, adsInit] = fetchMock.mock.calls[1] as unknown as [string, RequestInit];
    expect(adsUrl).toMatch(/\/customers\/1234567890\/googleAds:searchStream$/);
    const headers = adsInit.headers as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer ya29.test");
    expect(headers["developer-token"]).toBe("dev-token-test");
    expect(headers["login-customer-id"]).toBe("9998887777");
    expect(JSON.parse(String(adsInit.body)).query).toContain("FROM campaign");
  });

  it("surfaces an OAuth failure (expired/revoked refresh token) and never calls the Ads API", async () => {
    const fetchMock = vi.fn(async () => json({ error: "invalid_grant", error_description: "Token has been expired or revoked." }, 400));
    await expect(
      fetchGoogleAdsCampaignSpend({ since: "2026-09-22", until: "2026-09-28" }, fetchMock as unknown as typeof fetch)
    ).rejects.toThrow(/Google OAuth refresh failed: Token has been expired or revoked/);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("surfaces Google Ads API errors such as an unapproved developer token", async () => {
    const fetchMock = vi.fn(async (url: string | URL | Request) => {
      if (String(url).includes("oauth2")) return json({ access_token: "ya29.test" });
      return json(
        [
          {
            error: {
              code: 403,
              message: "The caller does not have permission",
              status: "PERMISSION_DENIED",
              details: [
                {
                  "@type": "type.googleapis.com/google.ads.googleads.v22.errors.GoogleAdsFailure",
                  errors: [
                    {
                      errorCode: { authorizationError: "DEVELOPER_TOKEN_NOT_APPROVED" },
                      message: "The developer token is only approved for use with test accounts.",
                    },
                  ],
                },
              ],
            },
          },
        ],
        403
      );
    });
    await expect(
      fetchGoogleAdsCampaignSpend({ since: "2026-09-22", until: "2026-09-28" }, fetchMock as unknown as typeof fetch)
    ).rejects.toThrow(/test accounts.*DEVELOPER_TOKEN_NOT_APPROVED/);
  });

  it("refuses to run without credentials (no network call)", async () => {
    vi.stubEnv("GOOGLE_ADS_DEVELOPER_TOKEN", "");
    const fetchMock = vi.fn();
    await expect(
      fetchGoogleAdsCampaignSpend({ since: "2026-09-22", until: "2026-09-28" }, fetchMock as unknown as typeof fetch)
    ).rejects.toThrow(/GOOGLE_ADS_DEVELOPER_TOKEN/);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
