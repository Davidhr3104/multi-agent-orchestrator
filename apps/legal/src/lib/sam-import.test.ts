import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { LegalRfp } from "./legal-rfp";
import { importSamOpportunities, parseImportFilters, type SamImportFilters } from "./sam-import";
import { deskStatus, listRfps } from "./store";

const KEY = "test-sam-key-xyz";
const filters: SamImportFilters = { ncode: "541110", daysBack: 7, limit: 5 };
const now = new Date("2026-10-02T12:00:00Z");

const notices = [
  {
    noticeId: "n-001",
    title: "Legal Services - Medical Record Review",
    fullParentPathName: "VETERANS AFFAIRS, DEPARTMENT OF.NETWORK CONTRACT OFFICE 17",
    postedDate: "2026-09-30",
    type: "Solicitation",
    responseDeadLine: "2026-10-20T16:00:00-05:00",
    naicsCode: "541110",
    description: "https://api.sam.gov/prod/opportunities/v1/noticedesc?noticeid=n-001",
    uiLink: "https://sam.gov/opp/n-001/view",
  },
  {
    noticeId: "n-002",
    title: "Paralegal Support Services",
    fullParentPathName: "JUSTICE, DEPARTMENT OF.EXECUTIVE OFFICE FOR US ATTORNEYS",
    postedDate: "2026-09-29",
    type: "Combined Synopsis/Solicitation",
    naicsCode: "541110",
    description: "https://api.sam.gov/prod/opportunities/v1/noticedesc?noticeid=n-002",
    uiLink: "https://sam.gov/opp/n-002/view",
  },
];

function samFetch(mode: "ok" | "rate_limited" = "ok") {
  return vi.fn(async (input: RequestInfo | URL) => {
    const url = new URL(String(input));
    expect(url.hostname).toBe("api.sam.gov");
    if (mode === "rate_limited") {
      return new Response(JSON.stringify({ error: { code: "OVER_RATE_LIMIT", message: "limit" } }), { status: 429 });
    }
    if (url.pathname.endsWith("/opportunities/v2/search")) {
      return new Response(JSON.stringify({ totalRecords: 2, opportunitiesData: notices }), { status: 200 });
    }
    const id = url.searchParams.get("noticeid");
    return new Response(JSON.stringify({ description: `<p>Notice ${id}: independent medical record review for tort claims.</p>` }), { status: 200 });
  });
}

beforeAll(() => {
  process.env.SAM_GOV_API_KEY = KEY;
  delete process.env.ANTHROPIC_API_KEY;
  vi.stubGlobal("fetch", vi.fn(async () => {
    throw new Error("unexpected network call");
  }));
});
afterAll(() => {
  delete process.env.SAM_GOV_API_KEY;
  vi.unstubAllGlobals();
});

describe("importSamOpportunities", () => {
  it("validates import filters", () => {
    expect(parseImportFilters({ daysBack: 0 })).toMatch(/daysBack/);
    expect(parseImportFilters({ limit: 99 })).toMatch(/limit/);
    expect(parseImportFilters({ ncode: " 541110 ", daysBack: 7, limit: 5 })).toEqual({
      ncode: "541110",
      ptype: undefined,
      title: undefined,
      state: undefined,
      daysBack: 7,
      limit: 5,
    });
  });

  it("never brings real data into a demo desk from the cron, nor without explicit confirmation", async () => {
    expect((await deskStatus()).mode).toBe("demo");
    const fetchImpl = samFetch();
    const cron = await importSamOpportunities({ filters, via: "cron", fetchImpl: fetchImpl as unknown as typeof fetch, now });
    expect(cron.status).toBe("desk_in_demo");
    const manual = await importSamOpportunities({ filters, via: "manual", fetchImpl: fetchImpl as unknown as typeof fetch, now });
    expect(manual.status).toBe("desk_in_demo");
    expect(fetchImpl).not.toHaveBeenCalled();
    expect((await listRfps()).every((r) => r.id.startsWith("seed-"))).toBe(true);
  });

  it("surfaces a rate limit and leaves the demo desk untouched", async () => {
    const r = await importSamOpportunities({
      filters,
      via: "manual",
      leaveDemo: true,
      fetchImpl: samFetch("rate_limited") as unknown as typeof fetch,
      now,
    });
    expect(r).toMatchObject({ ok: false, status: "error", error: { kind: "rate_limited" } });
    expect((await deskStatus()).mode).toBe("demo");
  });

  it("imports real notices as proposed for review, with no partner decision and no demo rows", async () => {
    const r = await importSamOpportunities({
      filters,
      via: "manual",
      leaveDemo: true,
      fetchImpl: samFetch() as unknown as typeof fetch,
      now,
    });
    expect(r.status).toBe("imported");
    expect(r.imported.map((i) => i.id)).toEqual(["sam-n-001", "sam-n-002"]);
    expect(r.descriptionsFetched).toBe(2);
    expect(r.claudeConfigured).toBe(false);
    expect(r.estimatedUsd).toBe(0);

    const rfps = (await listRfps()) as LegalRfp[];
    expect(rfps.some((x) => x.id.startsWith("seed-"))).toBe(false);
    const first = rfps.find((x) => x.id === "sam-n-001");
    expect(first).toBeDefined();
    expect(first?.partnerDecision).toBeUndefined();
    expect(first?.needsReview).toBe(true);
    expect(first?.source).toMatchObject({ noticeId: "n-001", uiLink: "https://sam.gov/opp/n-001/view", naics: "541110", importedVia: "manual" });
    expect(first?.body).toContain("independent medical record review");
    expect(first?.extraction?.engine).toBe("heuristic");
    expect(first?.goNoGoProposal?.engine).toBe("heuristic");
    expect(["GO", "CONDITIONAL", "NO-GO"]).toContain(first?.goNoGoProposal?.recommendation);
  });

  it("dedupes by notice ID on the next run, which is what the daily cron relies on", async () => {
    const r = await importSamOpportunities({ filters, via: "cron", fetchImpl: samFetch() as unknown as typeof fetch, now });
    expect(r.status).toBe("imported");
    expect(r.imported).toEqual([]);
    expect(r.skippedExisting).toBe(2);
    expect(((await listRfps()) as LegalRfp[]).every((x) => !x.partnerDecision)).toBe(true);
  });
});
