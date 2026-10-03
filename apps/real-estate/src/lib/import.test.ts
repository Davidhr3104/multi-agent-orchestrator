import { beforeEach, describe, expect, it, vi } from "vitest";
import { parseCsv } from "./csv";
import { autoMap, fetchSheetCsv, importBuyers, importProperties, parseMoney, sheetCsvUrl } from "./import";
import { currentDeskMode, deskStatus, importRecords, listDrafts, listLeads, listProperties, loadDemoCatalog } from "./store";

const LISTINGS = [
  "MLS #,Address,Neighborhood,Property Type,List Price,Sq Ft,Beds,Baths,Features,Status,Remarks",
  'A1,"12 Pine St, Unit 3",Riverside,Condo,"$410,000",900,2,1,"Balcony; Gym",Active,"Corner unit, quoted ""bright"""',
  "A2,40 Elm Rd,Northgate,Single Family,725k,2100,4,2.5,,Pending,",
  "A3,,Northgate,House,500000,1500,3,2,,,",
  "A4,9 Bay Ave,Downtown,Castle,abc,,two,,,Weird,",
].join("\r\n");

describe("CSV parsing", () => {
  it("handles quotes, escaped quotes, commas, CRLF and a BOM", () => {
    const rows = parseCsv(`\uFEFFa,b\r\n"x, y","say ""hi"""\n\n"multi\nline",2`);
    expect(rows).toEqual([
      ["a", "b"],
      ["x, y", 'say "hi"'],
      ["multi\nline", "2"],
    ]);
  });

  it("reads money in the usual shapes", () => {
    expect(parseMoney("$485,000")).toBe(485_000);
    expect(parseMoney("725k")).toBe(725_000);
    expect(parseMoney("1.2M")).toBe(1_200_000);
    expect(parseMoney("call me")).toBeNull();
  });
});

describe("listing import", () => {
  it("maps common MLS headers automatically", () => {
    const headers = parseCsv(LISTINGS)[0];
    const m = autoMap("properties", headers);
    expect(m.ref).toBe(0);
    expect(m.address).toBe(1);
    expect(m.zone).toBe(2);
    expect(m.kind).toBe(3);
    expect(m.price).toBe(4);
    expect(m.sqft).toBe(5);
    expect(m.sqm).toBeNull();
  });

  it("imports valid rows with the file's own values and reports each bad row", () => {
    const r = importProperties(LISTINGS);
    expect(r.total).toBe(4);
    expect(r.records).toHaveLength(2);
    const [a, b] = r.records;
    expect(a).toMatchObject({ id: "imp-a1", address: "12 Pine St, Unit 3", zone: "Riverside", kind: "apartment", price: 410_000, sqm: 84, beds: 2, baths: 1, status: "active", amenities: ["Balcony", "Gym"] });
    expect(a.description).toBe('Corner unit, quoted "bright"');
    expect(b).toMatchObject({ kind: "house", price: 725_000, baths: 2.5, status: "reserved", amenities: [], description: "" });
    expect(r.errors.map((e) => e.row)).toEqual([4, 5]);
    expect(r.errors[0].messages).toContain("Address is empty");
    const bad = r.errors[1].messages.join(" | ");
    expect(bad).toMatch(/Type "Castle"/);
    expect(bad).toMatch(/Price "abc"/);
    expect(bad).toMatch(/Size is empty/);
    expect(bad).toMatch(/Bedrooms "two"/);
    expect(bad).toMatch(/Bathrooms is empty/);
    expect(bad).toMatch(/Status "Weird"/);
  });

  it("refuses to import when a required column isn't mapped", () => {
    const r = importProperties("address,zone\n1 Main,Riverside");
    expect(r.records).toEqual([]);
    expect(r.errors[0].messages[0]).toMatch(/Map a column for: .*Type.*Price/);
  });

  it("respects a mapping chosen by the agent and flags duplicates", () => {
    const csv = "where,area,what,cost,m2,bd,ba\n1 Main,Riverside,loft,300000,60,1,1\n1 Main,Riverside,loft,310000,60,1,1";
    const r = importProperties(csv, { address: 0, zone: 1, kind: 2, price: 3, sqm: 4, beds: 5, baths: 6 });
    expect(r.records).toHaveLength(1);
    expect(r.errors[0]).toEqual({ row: 3, messages: ["Same listing as row 2"] });
  });
});

describe("buyer import", () => {
  it("validates contact details and normalises financing and stage", () => {
    const csv = [
      "Name,Email,Phone,Budget,Zones,Min Beds,Timeline,Financing,Stage",
      "Ana Ruiz,ana@realmail.com,+1 305 555 0101,$520k,Riverside; Downtown,2,3,Pre-approved,",
      "No Contact,,,,,,,,",
      "Bad Email,not-an-email,,,,,,cash,won",
    ].join("\n");
    const r = importBuyers(csv);
    expect(r.records).toHaveLength(1);
    expect(r.records[0]).toMatchObject({ name: "Ana Ruiz", email: "ana@realmail.com", budget: 520_000, zones: ["Riverside", "Downtown"], bedsMin: 2, timelineMonths: 3, financing: "preapproved", stage: "new", source: "Imported" });
    expect(r.errors[0]).toEqual({ row: 3, messages: ["Needs an email or a phone"] });
    expect(r.errors[1].messages.join(" | ")).toMatch(/Email "not-an-email".*Stage "won"/);
  });
});

describe("Google Sheets links", () => {
  it("turns share and publish links into CSV export URLs, and rejects anything else", () => {
    expect(sheetCsvUrl("https://docs.google.com/spreadsheets/d/1AbCdEfGhIjKlMnOpQrStUvWxYz012345/edit#gid=77")).toBe(
      "https://docs.google.com/spreadsheets/d/1AbCdEfGhIjKlMnOpQrStUvWxYz012345/export?format=csv&gid=77"
    );
    expect(sheetCsvUrl("https://docs.google.com/spreadsheets/d/e/2PACX-1vabc/pubhtml")).toBe("https://docs.google.com/spreadsheets/d/e/2PACX-1vabc/pub?output=csv");
    expect(sheetCsvUrl("https://evil.example.com/spreadsheets/d/1AbCdEfGhIjKlMnOpQrStUvWxYz012345/edit")).toBeNull();
    expect(sheetCsvUrl("http://docs.google.com/spreadsheets/d/1AbCdEfGhIjKlMnOpQrStUvWxYz012345/edit")).toBeNull();
  });

  it("fetches the CSV, and explains a private sheet instead of importing a login page", async () => {
    const ok = vi.fn(async () => new Response("a,b\n1,2", { headers: { "content-type": "text/csv" } }));
    await expect(fetchSheetCsv("https://docs.google.com/spreadsheets/d/1AbCdEfGhIjKlMnOpQrStUvWxYz012345/edit", ok as unknown as typeof fetch)).resolves.toBe("a,b\n1,2");
    expect((ok.mock.calls[0] as unknown[])[0]).toMatch(/export\?format=csv$/);
    const login = vi.fn(async () => new Response("<!DOCTYPE html><html>Sign in</html>", { headers: { "content-type": "text/html" } }));
    await expect(fetchSheetCsv("https://docs.google.com/spreadsheets/d/1AbCdEfGhIjKlMnOpQrStUvWxYz012345/edit", login as unknown as typeof fetch)).rejects.toThrow(/isn't public/);
  });
});

describe("importing switches the desk out of demo", () => {
  beforeEach(async () => {
    await loadDemoCatalog();
  });

  it("removes every sample record, so demo and real data never mix", async () => {
    expect(currentDeskMode()).toBe("demo");
    const { records } = importProperties(LISTINGS);
    const out = await importRecords({ properties: records });
    expect(out).toEqual({ added: 2, updated: 0, clearedDemo: true });
    expect(currentDeskMode()).toBe("live");
    const props = await listProperties();
    expect(props.map((p) => p.id).sort()).toEqual(["imp-a1", "imp-a2"]);
    expect(await listLeads()).toEqual([]);
    expect(await listDrafts()).toEqual([]);
    expect((await deskStatus()).imported).toBe(true);

    const again = await importRecords({ properties: records });
    expect(again).toEqual({ added: 0, updated: 2, clearedDemo: false });
  });
});
