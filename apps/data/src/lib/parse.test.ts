import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import { parseWorkbook } from "@/lib/parse";
import { MAX_ROWS } from "@/lib/types";

describe("row cap", () => {
  it("keeps at most 5000 data rows", () => {
    const headers = ["Name", "Email"];
    const rows = Array.from({ length: MAX_ROWS + 12 }, (_, i) => [`n${i}`, `n${i}@example.com`]);
    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
    const buf = Buffer.from(XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer);
    const parsed = parseWorkbook(new Uint8Array(buf), "big.xlsx");
    if (typeof parsed === "string") throw new Error(parsed);
    expect(parsed.truncated).toBe(true);
    expect(parsed.grid.rows.length).toBe(MAX_ROWS);
    expect(parsed.rawRowCount).toBe(MAX_ROWS + 12);
  });

  it("keeps ISO dates from CSV as written", () => {
    const csv = "Date,Amount\n2026-04-03,765.74\n";
    const parsed = parseWorkbook(Buffer.from(csv, "utf8"), "expenses-sample.csv");
    if (typeof parsed === "string") throw new Error(parsed);
    expect(parsed.grid.rows[0][0]).toBe("2026-04-03");
    expect(parsed.grid.rows[0][1]).toBe("765.74");
  });
});
