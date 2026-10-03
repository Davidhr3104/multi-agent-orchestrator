import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "@/app/api/cron/nightly-match/route";
import { importBuyers, importProperties } from "./import";
import { isCronAuthorized, runNightlyMatching } from "./nightly";
import { getProperty, importRecords, listDrafts, loadDemoCatalog, putProperty } from "./store";

const LISTINGS = "ref,address,zone,type,price,sqm,beds,baths\nL1,1 River Rd,Riverside,loft,450000,90,2,2\nL2,2 Hill St,Northgate,house,900000,200,4,3";
const BUYERS = "name,email,budget,zones,beds_min,financing\nAna Ruiz,ana@realmail.test,500000,Riverside,2,preapproved\nBo Chen,bo@realmail.test,300000,Eastfield,1,cash";

const cronReq = (auth?: string) => new Request("http://localhost/api/cron/nightly-match", { headers: auth ? { authorization: auth } : {} });

beforeEach(async () => {
  process.env.HELIX_SECRETS_PATH = "__no_such_file__.json";
  delete process.env.CRON_SECRET;
  delete process.env.ANTHROPIC_API_KEY;
  await loadDemoCatalog();
});
afterEach(() => {
  delete process.env.CRON_SECRET;
  vi.unstubAllGlobals();
});

describe("cron auth", () => {
  it("accepts only the exact bearer secret", () => {
    expect(isCronAuthorized("Bearer s3cret", "s3cret")).toBe(true);
    expect(isCronAuthorized("Bearer wrong", "s3cret")).toBe(false);
    expect(isCronAuthorized("s3cret", "s3cret")).toBe(false);
    expect(isCronAuthorized(null, "s3cret")).toBe(false);
    expect(isCronAuthorized("Bearer ", "")).toBe(false);
  });

  it("the route refuses without CRON_SECRET, rejects a wrong secret, and runs with the right one", async () => {
    expect((await GET(cronReq("Bearer anything"))).status).toBe(503);
    process.env.CRON_SECRET = "s3cret";
    expect((await GET(cronReq())).status).toBe(401);
    expect((await GET(cronReq("Bearer nope"))).status).toBe(401);
    const ok = await GET(cronReq("Bearer s3cret"));
    expect(ok.status).toBe(200);
    expect(await ok.json()).toMatchObject({ sent: 0, skipped: expect.stringMatching(/sample data/) });
  });
});

describe("nightly matching", () => {
  it("queues drafts for new listings only once, re-matches changed ones, and never sends", async () => {
    await importRecords({ properties: importProperties(LISTINGS).records, leads: importBuyers(BUYERS).records });
    const f = vi.fn();
    vi.stubGlobal("fetch", f);

    const first = await runNightlyMatching();
    expect(first).toMatchObject({ checked: 2, changed: 2, drafted: 1, sent: 0 });
    const drafts = await listDrafts();
    expect(drafts).toHaveLength(1);
    expect(drafts[0]).toMatchObject({ kind: "new_match", status: "pending", queuedBy: "nightly", leadId: "imp-lead-ana-realmail-test", propertyIds: ["imp-l1"] });

    const second = await runNightlyMatching();
    expect(second).toMatchObject({ changed: 0, drafted: 0 });

    const l2 = (await getProperty("imp-l2"))!;
    await putProperty({ ...l2, price: 290_000, zone: "Eastfield", beds: 2 });
    const third = await runNightlyMatching();
    expect(third).toMatchObject({ changed: 1, drafted: 1, sent: 0 });
    expect((await listDrafts()).every((d) => d.status === "pending" && !d.deliveries)).toBe(true);
    expect(f).not.toHaveBeenCalled();
  });
});
