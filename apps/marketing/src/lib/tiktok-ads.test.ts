import { mkdtempSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { campaignSource, getSourceStatus, resetSourceState, syncAdSource } from "./ad-sources";
import { fetchTikTokCampaignSpend, isTikTokAdsConfigured, mapTikTokRows, splitDateRange } from "./tiktok-ads";

process.env.HELIX_MARKETING_DATA_DIR = mkdtempSync(path.join(os.tmpdir(), "helix-mkt-tiktok-"));

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

const row = (id: string, day: string, spend: string) => ({
  dimensions: { campaign_id: id, stat_time_day: `${day} 00:00:00` },
  metrics: { campaign_name: `Spark ${id}`, spend, clicks: "12", impressions: "3400", conversion: "2" },
});

beforeEach(() => {
  vi.stubEnv("TIKTOK_ADS_ACCESS_TOKEN", "tt-token-test");
  vi.stubEnv("TIKTOK_ADS_ADVERTISER_ID", "7000000000001");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("TikTok Ads read adapter", () => {
  it("needs both the access token and the advertiser id", () => {
    expect(isTikTokAdsConfigured()).toBe(true);
    vi.stubEnv("TIKTOK_ADS_ADVERTISER_ID", "");
    expect(isTikTokAdsConfigured()).toBe(false);
  });

  it("splits long windows into ranges TikTok accepts (max 30 days)", () => {
    expect(splitDateRange("2026-07-05", "2026-10-02")).toEqual([
      { start: "2026-07-05", end: "2026-08-03" },
      { start: "2026-08-04", end: "2026-09-02" },
      { start: "2026-09-03", end: "2026-10-02" },
    ]);
    expect(splitDateRange("2026-09-26", "2026-10-02")).toEqual([{ start: "2026-09-26", end: "2026-10-02" }]);
  });

  it("maps report rows to spend rows with platform 'tiktok'", () => {
    expect(mapTikTokRows([row("1801", "2026-09-30", "45.678"), { dimensions: {}, metrics: { spend: "9" } }])).toEqual([
      { campaignId: "1801", name: "Spark 1801", platform: "tiktok", spend: 45.68, impressions: 3400, clicks: 12, formLeads: 2, occurredAt: "2026-09-30" },
    ]);
  });

  it("sends the Access-Token header and follows pagination", async () => {
    const fetchMock = vi.fn(async (url: string | URL | Request) => {
      const page = new URL(String(url)).searchParams.get("page");
      return json({
        code: 0,
        message: "OK",
        data: { list: [row(page === "1" ? "1801" : "1802", "2026-09-30", "10")], page_info: { page: Number(page), total_page: 2 } },
      });
    });
    const { rows, accountId } = await fetchTikTokCampaignSpend({ since: "2026-09-26", until: "2026-10-02" }, fetchMock as unknown as typeof fetch);
    expect(accountId).toBe("7000000000001");
    expect(rows.map((r) => r.campaignId)).toEqual(["1801", "1802"]);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    const params = new URL(url).searchParams;
    expect(url).toContain("/open_api/v1.3/report/integrated/get/");
    expect(params.get("advertiser_id")).toBe("7000000000001");
    expect(params.get("data_level")).toBe("AUCTION_CAMPAIGN");
    expect(JSON.parse(params.get("metrics") ?? "[]")).toEqual(expect.arrayContaining(["spend", "clicks", "conversion"]));
    expect((init.headers as Record<string, string>)["Access-Token"]).toBe("tt-token-test");
  });

  it("treats a non-zero code on HTTP 200 as an auth error", async () => {
    const fetchMock = vi.fn(async () => json({ code: 40105, message: "Access token is invalid or has expired.", data: {} }));
    await expect(
      fetchTikTokCampaignSpend({ since: "2026-09-26", until: "2026-10-02" }, fetchMock as unknown as typeof fetch)
    ).rejects.toThrow(/Access token is invalid or has expired\. \(code 40105\)/);
  });

  it("labels synced TikTok campaigns as TikTok and only then counts the source as connected", async () => {
    resetSourceState();
    expect(getSourceStatus("tiktok")).toMatchObject({ configured: true, verified: false });
    vi.stubGlobal("fetch", vi.fn(async () => json({ code: 0, message: "OK", data: { list: [row("1801", "2026-09-30", "10")], page_info: { total_page: 1 } } })));
    const ingest = vi.fn(async () => undefined);
    const r = await syncAdSource("tiktok", { since: "2026-09-26", until: "2026-10-02" }, ingest);
    vi.unstubAllGlobals();
    expect(r).toMatchObject({ source: "tiktok", ok: true, imported: 1 });
    expect(ingest).toHaveBeenCalledWith("tiktok", [expect.objectContaining({ campaignId: "1801", platform: "tiktok" })]);
    expect(campaignSource("1801", "tiktok")).toBe("tiktok");
    // Rows synced before core had "tiktok" were stored as "other"; the registry still labels them.
    expect(campaignSource("1801", "other")).toBe("tiktok");
    expect(campaignSource("other-id", "other")).toBe("other");
    expect(getSourceStatus("tiktok").verified).toBe(true);
  });

  it("refuses to run without credentials (no network call)", async () => {
    vi.stubEnv("TIKTOK_ADS_ACCESS_TOKEN", "");
    const fetchMock = vi.fn();
    await expect(
      fetchTikTokCampaignSpend({ since: "2026-09-26", until: "2026-10-02" }, fetchMock as unknown as typeof fetch)
    ).rejects.toThrow(/TIKTOK_ADS_ACCESS_TOKEN/);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
