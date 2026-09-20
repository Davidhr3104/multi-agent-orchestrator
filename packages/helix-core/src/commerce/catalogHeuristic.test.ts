import { describe, it, expect } from "vitest";
import { parseCatalogCsv } from "./catalogCsv";
import { enrichCatalogHeuristic } from "./catalogHeuristic";

describe("parseCatalogCsv", () => {
  it("parses a headered catalog with quoted cells", () => {
    const csv = `sku,title,price,inventory,description
TEE-001,"Organic Cotton Tee",32.25,240,"Soft tee, everyday wear"
BAD-ROW,,0,,
`;
    const rows = parseCatalogCsv(csv);
    expect(Array.isArray(rows)).toBe(true);
    if (!Array.isArray(rows)) return;
    expect(rows).toHaveLength(2);
    expect(rows[0].sku).toBe("TEE-001");
    expect(rows[0].title).toBe("Organic Cotton Tee");
    expect(rows[0].price).toBe(32.25);
    expect(rows[1].sku).toBe("BAD-ROW");
    expect(rows[1].title).toBe("");
  });
});

describe("enrichCatalogHeuristic", () => {
  it("flags incomplete rows for HITL and does not treat them as publishable", () => {
    const result = enrichCatalogHeuristic({ sku: "", title: "", price: 0 });
    expect(result.needsReview).toBe(true);
    expect(result.completeness).toBeLessThan(0.8);
    expect(result.issues.some((i) => i.field === "sku")).toBe(true);
  });

  it("accepts a complete row with optional review only if description is thin", () => {
    const result = enrichCatalogHeuristic({
      sku: "BAG-014",
      title: "Leather Weekend Bag",
      price: 189,
      inventory: 18,
      description: "Full-grain leather duffel for overnight trips.",
      vendor: "Northwind",
    });
    expect(result.needsReview).toBe(false);
    expect(result.seoTitle).toContain("Leather");
    expect(result.tags.length).toBeGreaterThan(0);
  });
});
