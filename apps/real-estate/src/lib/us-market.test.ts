import { describe, expect, it } from "vitest";
import { monthLabel, parseRealtorStates } from "./us-market";

const HEADER =
  "month_date_yyyymm,state,state_id,median_listing_price,median_listing_price_yy,active_listing_count,active_listing_count_yy,median_days_on_market,median_days_on_market_yy,new_listing_count,new_listing_count_yy,price_reduced_share,pending_listing_count,pending_ratio";

const CSV = [
  "# fetched 2026-10-02T05:00:00.000Z from somewhere",
  HEADER,
  "202609,Texas,TX,350000,0.01,120000,0.2,55,0.05,40000,0.03,0.25,50000,0.41",
  "202608,Texas,TX,352000,,110000,,52,,39000,,0.24,51000,0.46",
  "202609,Delaware,DE,485000,-0.001,3556,0.137,60,0.026,1384,0.053,0.19,1771,0.498",
  "202609,Bad,,1,,1,,1,,1,,1,1,1",
].join("\n");

describe("parseRealtorStates", () => {
  it("keeps the latest month per state with history oldest first", () => {
    const { latestMonth, states, fetchedNote } = parseRealtorStates(CSV);
    expect(latestMonth).toBe("202609");
    expect(fetchedNote).toBe("2026-10-02T05:00:00.000Z");
    expect(states.map((s) => s.id)).toEqual(["DE", "TX"]);
    const tx = states.find((s) => s.id === "TX")!;
    expect(tx.latest.active).toBe(120000);
    expect(tx.latest.activeYy).toBe(0.2);
    expect(tx.history.map((m) => m.month)).toEqual(["202608", "202609"]);
  });

  it("treats empty cells as missing, not zero", () => {
    const tx = parseRealtorStates(CSV).states.find((s) => s.id === "TX")!;
    expect(tx.history[0]).toMatchObject({ month: "202608", active: 110000 });
    expect(parseRealtorStates(CSV.replace("0.01,120000", ",120000")).states.find((s) => s.id === "TX")!.latest.priceYy).toBeNull();
  });

  it("parses the saved snapshot into all 50 states plus DC", async () => {
    const { readFile } = await import("node:fs/promises");
    const { states } = parseRealtorStates(await readFile(new URL("../data/rdc-state-snapshot.csv", import.meta.url), "utf8"));
    expect(states).toHaveLength(51);
    expect(states.every((s) => s.history.length === 13)).toBe(true);
  });

  it("rejects files without the expected columns", () => {
    expect(() => parseRealtorStates("a,b\n1,2")).toThrow(/missing column/);
  });
});

describe("monthLabel", () => {
  it("formats yyyymm", () => expect(monthLabel("202609")).toBe("Sep 2026"));
});
