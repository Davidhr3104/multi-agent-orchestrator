import { describe, expect, it } from "vitest";
import { DEFAULT_STRUCTURED } from "./client-profile";
import { agencyFromOpportunity, mapSamOpportunity, samFiltersFromProfile, samRfpId, stateCodeFor } from "./sam-mapping";
import type { SamOpportunity } from "./sam-gov";

const op: SamOpportunity = {
  noticeId: "5b345bbb7127b91a3ad577b203fc6f68",
  title: "Legal Services - Medical Record Review",
  solicitationNumber: "36C25726Q0001",
  fullParentPathName: "VETERANS AFFAIRS, DEPARTMENT OF.VETERANS AFFAIRS, DEPARTMENT OF.257-NETWORK CONTRACT OFFICE 17",
  postedDate: "2026-09-29",
  type: "Combined Synopsis/Solicitation",
  typeOfSetAsideDescription: "Total Small Business Set-Aside (FAR 19.5)",
  responseDeadLine: "2026-10-20T16:00:00-05:00",
  naicsCode: "541110",
  description: "https://api.sam.gov/prod/opportunities/v1/noticedesc?noticeid=5b345bbb7127b91a3ad577b203fc6f68",
  uiLink: "https://sam.gov/opp/5b345bbb7127b91a3ad577b203fc6f68/view",
  resourceLinks: ["https://sam.gov/api/prod/opps/v3/opportunities/resources/files/x/download", "javascript:alert(1)"],
  placeOfPerformance: { city: { name: "Temple" }, state: { code: "TX" }, country: { code: "USA" } },
};

describe("mapSamOpportunity", () => {
  it("keeps the SAM.gov source fields and builds the body from SAM.gov text only", () => {
    const mapped = mapSamOpportunity(op, {
      importedVia: "manual",
      importedAt: "2026-10-02T12:00:00.000Z",
      description: { status: "fetched", text: "The VA requires independent medical record review for tort claims." },
    });
    expect(mapped).not.toBeNull();
    if (!mapped) return;
    expect(mapped.id).toBe("sam-5b345bbb7127b91a3ad577b203fc6f68");
    expect(mapped.input.title).toBe(op.title);
    expect(mapped.input.issuer).toBe(
      "VETERANS AFFAIRS, DEPARTMENT OF / VETERANS AFFAIRS, DEPARTMENT OF / 257-NETWORK CONTRACT OFFICE 17"
    );
    expect(mapped.source).toMatchObject({
      kind: "sam.gov",
      noticeId: op.noticeId,
      solicitationNumber: "36C25726Q0001",
      uiLink: op.uiLink,
      publicUrl: "https://sam.gov/opp/5b345bbb7127b91a3ad577b203fc6f68/view",
      postedDate: "2026-09-29",
      responseDeadline: "2026-10-20T16:00:00-05:00",
      naics: "541110",
      setAside: "Total Small Business Set-Aside (FAR 19.5)",
      noticeType: "Combined Synopsis/Solicitation",
      placeOfPerformance: "Temple, TX, USA",
      descriptionStatus: "fetched",
      importedVia: "manual",
    });
    expect(mapped.source.resourceLinks).toEqual([op.resourceLinks![0]]);
    expect(mapped.input.body).toContain("Response deadline: 2026-10-20T16:00:00-05:00");
    expect(mapped.input.body).toContain("Set-aside: Total Small Business Set-Aside (FAR 19.5)");
    expect(mapped.input.body).toContain("The VA requires independent medical record review for tort claims.");
  });

  it("says plainly when the description was not read", () => {
    const mapped = mapSamOpportunity(
      { ...op, responseDeadLine: null, uiLink: "null" },
      { importedVia: "cron", description: { status: "unavailable", reason: "SAM.gov: Description Not Found." } }
    );
    expect(mapped?.source.descriptionStatus).toBe("unavailable");
    expect(mapped?.source.uiLink).toBe(mapped?.source.publicUrl);
    expect(mapped?.input.body).toContain("Response deadline: not stated on SAM.gov");
    expect(mapped?.input.body).toContain("Description: not available (SAM.gov: Description Not Found.)");
  });

  it("skips notices without an ID or title", () => {
    expect(mapSamOpportunity({ ...op, noticeId: "" }, { importedVia: "manual" })).toBeNull();
    expect(mapSamOpportunity({ ...op, title: undefined }, { importedVia: "manual" })).toBeNull();
  });

  it("builds safe ids and falls back to the deprecated agency fields", () => {
    expect(samRfpId("ab/../c d")).toBe("sam-abcd");
    expect(agencyFromOpportunity({ department: "DOJ", subTier: "EOUSA", office: null })).toBe("DOJ / EOUSA");
  });
});

describe("samFiltersFromProfile", () => {
  it("derives NAICS and the state from the firm profile", () => {
    const f = samFiltersFromProfile(DEFAULT_STRUCTURED);
    expect(f.ncode).toBe("541110");
    expect(f.state).toBe("TX");
    expect(f.suggestedKeywords).toContain("medical record review");
    expect(f.title).toBeUndefined();
  });

  it("applies no state filter for multi-state or federal practices", () => {
    expect(samFiltersFromProfile({ ...DEFAULT_STRUCTURED, jurisdiction: "Federal" }).state).toBeUndefined();
    expect(stateCodeFor("New York")).toBe("NY");
    expect(stateCodeFor("ca")).toBe("CA");
    expect(stateCodeFor("Multi-state US")).toBeUndefined();
  });
});
