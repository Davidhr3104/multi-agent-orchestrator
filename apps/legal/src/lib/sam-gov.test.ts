import { describe, expect, it, vi } from "vitest";
import {
  buildSamSearchUrl,
  fetchSamDescription,
  formatSamDate,
  htmlToText,
  searchSamOpportunities,
  validateSamFilters,
  type SamSearchFilters,
} from "./sam-gov";

const KEY = "test-sam-key-123";
const filters: SamSearchFilters = {
  postedFrom: new Date("2026-09-20T12:00:00Z"),
  postedTo: new Date("2026-10-02T12:00:00Z"),
  limit: 5,
  ncode: "541110",
  state: "tx",
  title: "legal services",
};

function jsonResponse(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" }, ...init });
}

describe("SAM.gov request building", () => {
  it("formats dates as MM/dd/yyyy", () => {
    expect(formatSamDate(new Date("2026-01-05T00:00:00Z"))).toBe("01/05/2026");
  });

  it("puts the required and filter params on the v2 search URL", () => {
    const url = buildSamSearchUrl(filters, KEY);
    expect(url.origin + url.pathname).toBe("https://api.sam.gov/opportunities/v2/search");
    expect(url.searchParams.get("api_key")).toBe(KEY);
    expect(url.searchParams.get("postedFrom")).toBe("09/20/2026");
    expect(url.searchParams.get("postedTo")).toBe("10/02/2026");
    expect(url.searchParams.get("limit")).toBe("5");
    expect(url.searchParams.get("ncode")).toBe("541110");
    expect(url.searchParams.get("state")).toBe("TX");
    expect(url.searchParams.get("title")).toBe("legal services");
    expect(url.searchParams.has("ptype")).toBe(false);
  });

  it("rejects ranges over a year, bad NAICS and unknown notice types before calling SAM.gov", () => {
    expect(validateSamFilters({ ...filters, postedFrom: new Date("2025-01-01") })).toMatch(/1 year/);
    expect(validateSamFilters({ ...filters, ncode: "54A" })).toMatch(/NAICS/);
    expect(validateSamFilters({ ...filters, ptype: "z" })).toMatch(/procurement type/);
    expect(validateSamFilters({ ...filters, limit: 0 })).toMatch(/limit/);
    expect(validateSamFilters(filters)).toBeNull();
  });
});

describe("searchSamOpportunities", () => {
  it("returns notices and the remaining quota from a successful search", async () => {
    const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
      expect(String(input)).toContain("api_key=" + KEY);
      return jsonResponse(
        { totalRecords: 12, opportunitiesData: [{ noticeId: "abc", title: "Legal support" }] },
        { headers: { "x-ratelimit-remaining": "7" } }
      );
    });
    const r = await searchSamOpportunities(filters, { apiKey: KEY, fetchImpl: fetchImpl as unknown as typeof fetch });
    expect(fetchImpl).toHaveBeenCalledOnce();
    expect(r).toEqual({ ok: true, totalRecords: 12, opportunities: [{ noticeId: "abc", title: "Legal support" }], rateLimitRemaining: 7 });
  });

  it("treats SAM.gov's 404 'No Data found' as an empty result", async () => {
    const fetchImpl = vi.fn(async () => new Response("No Data found", { status: 404 }));
    const r = await searchSamOpportunities(filters, { apiKey: KEY, fetchImpl: fetchImpl as unknown as typeof fetch });
    expect(r).toMatchObject({ ok: true, totalRecords: 0, opportunities: [] });
  });

  it("reports a rate limit with retry-after and never echoes the key", async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse(
        { error: { code: "OVER_RATE_LIMIT", message: `You have exceeded your rate limit for ${KEY}` } },
        { status: 429, headers: { "retry-after": "3600" } }
      )
    );
    const r = await searchSamOpportunities(filters, { apiKey: KEY, fetchImpl: fetchImpl as unknown as typeof fetch });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error.kind).toBe("rate_limited");
    expect(r.error.status).toBe(429);
    expect(r.error.retryAfterSeconds).toBe(3600);
    expect(r.error.message).not.toContain(KEY);
    expect(r.error.message).toContain("[redacted]");
  });

  it("detects the api.data.gov rate-limit code even without a 429 status", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ error: { code: "OVER_RATE_LIMIT", message: "slow down" } }, { status: 403 }));
    const r = await searchSamOpportunities(filters, { apiKey: KEY, fetchImpl: fetchImpl as unknown as typeof fetch });
    expect(!r.ok && r.error.kind).toBe("rate_limited");
  });

  it("maps an invalid key to unauthorized and a bad search to bad_request", async () => {
    const unauthorized = await searchSamOpportunities(filters, {
      apiKey: KEY,
      fetchImpl: (async () => jsonResponse({ error: { code: "API_KEY_INVALID", message: "An invalid api_key was supplied" } }, { status: 403 })) as typeof fetch,
    });
    expect(!unauthorized.ok && unauthorized.error.kind).toBe("unauthorized");

    const bad = await searchSamOpportunities(filters, {
      apiKey: KEY,
      fetchImpl: (async () => jsonResponse({ errorMessage: "PostedFrom and PostedTo are mandatory" }, { status: 400 })) as typeof fetch,
    });
    expect(!bad.ok && bad.error).toMatchObject({ kind: "bad_request", message: expect.stringContaining("mandatory") });
  });

  it("maps 5xx, network failures and non-JSON bodies to visible errors", async () => {
    const upstream = await searchSamOpportunities(filters, {
      apiKey: KEY,
      fetchImpl: (async () => new Response("oops", { status: 503 })) as typeof fetch,
    });
    expect(!upstream.ok && upstream.error.kind).toBe("upstream");

    const network = await searchSamOpportunities(filters, {
      apiKey: KEY,
      fetchImpl: (async () => {
        throw new Error(`connect ECONNREFUSED ?api_key=${KEY}`);
      }) as typeof fetch,
    });
    expect(!network.ok && network.error.kind).toBe("network");
    expect(!network.ok && network.error.message).not.toContain(KEY);

    const notJson = await searchSamOpportunities(filters, {
      apiKey: KEY,
      fetchImpl: (async () => new Response("<html>", { status: 200 })) as typeof fetch,
    });
    expect(!notJson.ok && notJson.error.kind).toBe("invalid_response");
  });

  it("does not call SAM.gov without a key or with invalid filters", async () => {
    const fetchImpl = vi.fn();
    const noKey = await searchSamOpportunities(filters, { apiKey: "", fetchImpl: fetchImpl as unknown as typeof fetch });
    expect(!noKey.ok && noKey.error.kind).toBe("not_configured");
    const invalid = await searchSamOpportunities({ ...filters, limit: 5000 }, { apiKey: KEY, fetchImpl: fetchImpl as unknown as typeof fetch });
    expect(!invalid.ok && invalid.error.kind).toBe("invalid_filters");
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});

describe("fetchSamDescription", () => {
  it("reads the notice description from api.sam.gov and strips HTML", async () => {
    const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(String(input));
      expect(url.hostname).toBe("api.sam.gov");
      expect(url.searchParams.get("api_key")).toBe(KEY);
      return jsonResponse({ description: "<p>Provide legal services&nbsp;to the VA.</p><p>Due 30 days.</p>" });
    });
    const r = await fetchSamDescription(
      { description: "https://api.sam.gov/prod/opportunities/v1/noticedesc?noticeid=abc" },
      { apiKey: KEY, fetchImpl: fetchImpl as unknown as typeof fetch }
    );
    expect(r).toEqual({ status: "fetched", text: "Provide legal services to the VA.\nDue 30 days." });
  });

  it("never sends the key to a host other than api.sam.gov", async () => {
    const fetchImpl = vi.fn();
    const r = await fetchSamDescription(
      { description: "https://evil.example.com/noticedesc?noticeid=abc" },
      { apiKey: KEY, fetchImpl: fetchImpl as unknown as typeof fetch }
    );
    expect(r.status).toBe("unavailable");
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("reports missing descriptions and rate limits", async () => {
    const missing = await fetchSamDescription(
      { description: "https://api.sam.gov/prod/opportunities/v1/noticedesc?noticeid=abc" },
      { apiKey: KEY, fetchImpl: (async () => jsonResponse({ description: "Description Not Found" })) as typeof fetch }
    );
    expect(missing.status).toBe("unavailable");

    const limited = await fetchSamDescription(
      { description: "https://api.sam.gov/prod/opportunities/v1/noticedesc?noticeid=abc" },
      { apiKey: KEY, fetchImpl: (async () => new Response("{}", { status: 429 })) as typeof fetch }
    );
    expect(limited.status === "failed" && limited.error.kind).toBe("rate_limited");
  });

  it("converts common entities and block tags", () => {
    expect(htmlToText("<div>A &amp; B</div><br/>C&#39;s")).toBe("A & B\n\nC's");
  });
});
