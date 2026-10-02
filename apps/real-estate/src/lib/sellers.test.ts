import { beforeEach, describe, expect, it } from "vitest";
import { handleExecuteBody, runWithPolicy } from "@helix/core";
import { realEstateActions } from "./ai-actions";
import { listingCopy } from "./listing-copy";
import { buyersForSeller, deskComps } from "./sellers";
import { getProperty, getSeller, listLeads, listProperties, loadDemoCatalog } from "./store";

const ctx = { actor: "You" };

beforeEach(async () => {
  await loadDemoCatalog();
});

describe("sellers", () => {
  it("prices a prospect only from the desk's own listings in the zone", async () => {
    const s = (await getSeller("seller-peter-novak"))!;
    const c = deskComps(s, await listProperties())!;
    expect(c.basis.every((p) => p.zone === "Riverside" && p.status !== "draft")).toBe(true);
    expect(c.low).toBeLessThanOrEqual(c.high);
  });

  it("finds buyers whose brief the seller's property fits", async () => {
    const s = (await getSeller("seller-peter-novak"))!;
    const fits = buyersForSeller(s, await listLeads());
    expect(fits.length).toBeGreaterThan(0);
    for (const l of fits) {
      expect(l.budget).toBeGreaterThanOrEqual(470_000 * 0.95);
      expect(l.bedsMin).toBeLessThanOrEqual(2);
    }
  });

  it("adds a seller and Undo removes it", async () => {
    const id = "seller-test-1234";
    const r = await handleExecuteBody(realEstateActions, { action: "add_seller", targetIds: [id], params: { name: "Test Owner", address: "1 Test St", zone: "Riverside", kind: "loft", sqm: 60, beds: 1, askingPrice: null } }, ctx);
    expect(r.body.done).toEqual([id]);
    expect((await getSeller(id))?.stage).toBe("prospect");
    await handleExecuteBody(realEstateActions, { action: "restore", entries: r.body.undo as unknown[] }, ctx);
    expect(await getSeller(id)).toBeNull();
  });

  it("asks a person before marking a seller lost", async () => {
    const out = await runWithPolicy(realEstateActions, { action: "move_seller_stage", summary: "", targets: [{ id: "seller-peter-novak", label: "Peter" }], params: { stage: "lost" } }, ctx, { canAutoRun: true });
    expect("proposal" in out).toBe(true);
  });

  it("drafts a listing from an agreed seller, never published, and Undo removes it", async () => {
    const r = await handleExecuteBody(realEstateActions, { action: "create_listing_from_seller", targetIds: ["seller-henrik-larsen"] }, ctx);
    const s = (await getSeller("seller-henrik-larsen"))!;
    expect(s.stage).toBe("listed");
    expect((await getProperty(s.propertyId!))?.status).toBe("draft");
    await handleExecuteBody(realEstateActions, { action: "restore", entries: r.body.undo as unknown[] }, ctx);
    expect((await getSeller("seller-henrik-larsen"))?.propertyId).toBeUndefined();
    expect(await getProperty("prop-henrik-larsen")).toBeNull();
  });

  it("refuses to draft a listing without an agreed price", async () => {
    const r = await handleExecuteBody(realEstateActions, { action: "create_listing_from_seller", targetIds: ["seller-aisha-bello"] }, ctx);
    expect((r.body.failed as { error: string }[])[0].error).toMatch(/Agree a price/);
  });
});

describe("listing copy", () => {
  it("uses only the listing's own facts", async () => {
    const p = (await getProperty("prop-riverside-loft"))!;
    const copy = listingCopy(p);
    expect(copy.map((c) => c.key)).toEqual(["portal", "social", "message"]);
    for (const c of copy) expect(c.text).toContain("$485,000");
    expect(copy[0].text).toContain(p.description);
  });
});
