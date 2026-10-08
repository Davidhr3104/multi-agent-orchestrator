import * as XLSX from "xlsx";
import { MAX_ROWS, type SheetGrid } from "@/lib/types";

export type ParseResult = {
  grid: SheetGrid;
  sheetName: string;
  truncated: boolean;
  rawRowCount: number;
};

export function parseWorkbook(bytes: Uint8Array, filename: string): ParseResult | string {
  const name = filename.toLowerCase();
  if (!name.endsWith(".xlsx") && !name.endsWith(".xls") && !name.endsWith(".csv")) {
    return "Upload an .xlsx or .csv file.";
  }
  if (name.endsWith(".csv")) return parseCsv(bytes);
  return parseExcel(bytes);
}

function parseExcel(bytes: Uint8Array): ParseResult | string {
  let workbook: XLSX.WorkBook;
  try {
    workbook = XLSX.read(bytes, { type: "array", raw: true, cellDates: true, codepage: 65001 });
  } catch {
    return "The file could not be parsed.";
  }
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) return "The workbook has no sheets.";
  const sheet = workbook.Sheets[sheetName];
  const aoa = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    defval: "",
    raw: true,
    blankrows: false,
  });
  return gridFromAoa(aoa, sheetName);
}

function parseCsv(bytes: Uint8Array): ParseResult | string {
  const text = new TextDecoder("utf-8").decode(bytes).replace(/^\uFEFF/, "");
  const aoa = parseCsvText(text);
  return gridFromAoa(aoa, "CSV");
}

/** RFC-style CSV. Cell text is kept as written — ISO dates stay ISO. */
export function parseCsvText(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let i = 0;
  let inQuotes = false;
  const src = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  while (i < src.length) {
    const ch = src[i];
    if (inQuotes) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          cell += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i += 1;
        continue;
      }
      cell += ch;
      i += 1;
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
      i += 1;
      continue;
    }
    if (ch === ",") {
      row.push(cell);
      cell = "";
      i += 1;
      continue;
    }
    if (ch === "\n") {
      row.push(cell);
      cell = "";
      if (row.some((c) => c.trim() !== "")) rows.push(row);
      row = [];
      i += 1;
      continue;
    }
    cell += ch;
    i += 1;
  }
  row.push(cell);
  if (row.some((c) => c.trim() !== "")) rows.push(row);
  return rows;
}

function gridFromAoa(aoa: unknown[][], sheetName: string): ParseResult | string {
  if (aoa.length < 2) return "The sheet needs a header row and at least one data row.";
  const headers = (aoa[0] ?? []).map((h, i) => {
    const text = String(h ?? "").trim();
    return text || `Column ${i + 1}`;
  });
  const dataRows = aoa.slice(1).filter((r) => r.some((c) => String(c ?? "").trim() !== ""));
  const width = Math.max(headers.length, ...dataRows.map((r) => r.length));
  while (headers.length < width) headers.push(`Column ${headers.length + 1}`);
  const truncated = dataRows.length > MAX_ROWS;
  const kept = dataRows.slice(0, MAX_ROWS);
  const rows = kept.map((r) => {
    const out: string[] = [];
    for (let i = 0; i < headers.length; i += 1) out.push(cellToOriginalString(r[i]));
    return out;
  });
  return {
    grid: { headers, rows },
    sheetName,
    truncated,
    rawRowCount: dataRows.length,
  };
}

function cellToOriginalString(value: unknown): string {
  if (value == null || value === "") return "";
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    const y = value.getUTCFullYear();
    const m = String(value.getUTCMonth() + 1).padStart(2, "0");
    const d = String(value.getUTCDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  return String(value);
}

export function gridToCsv(grid: SheetGrid): string {
  const lines = [grid.headers, ...grid.rows].map((row) =>
    row.map((cell) => csvEscape(String(cell ?? ""))).join(",")
  );
  return lines.join("\n") + "\n";
}

function csvEscape(value: string): string {
  if (/[",\n\r]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}
