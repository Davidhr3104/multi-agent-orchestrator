import type { CatalogRowInput } from "./types";

function unquote(cell: string): string {
  const trimmed = cell.trim();
  if (trimmed.startsWith('"') && trimmed.endsWith('"') && trimmed.length >= 2) {
    return trimmed.slice(1, -1).replace(/""/g, '"').trim();
  }
  return trimmed;
}

function splitCsvLine(line: string): string[] {
  const cells: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
      current += ch;
      continue;
    }
    if (ch === "," && !inQuotes) {
      cells.push(unquote(current));
      current = "";
      continue;
    }
    current += ch;
  }
  cells.push(unquote(current));
  return cells;
}

function headerKey(raw: string): string {
  return raw.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

/**
 * Minimal RFC4180-ish parser for catalog uploads. No extra CSV dependency —
 * vendor files in this MVP are small and header-based.
 */
export function parseCatalogCsv(text: string): CatalogRowInput[] | string {
  const lines = text
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length < 2) return "CSV needs a header row and at least one product row.";

  const headers = splitCsvLine(lines[0]).map(headerKey);
  const skuIdx = headers.findIndex((h) => h === "sku" || h === "skucode");
  const titleIdx = headers.findIndex((h) => h === "title" || h === "name" || h === "product");
  const priceIdx = headers.findIndex((h) => h === "price");
  const invIdx = headers.findIndex((h) => h === "inventory" || h === "qty" || h === "quantity" || h === "stock");
  const descIdx = headers.findIndex((h) => h === "description" || h === "body");
  const vendorIdx = headers.findIndex((h) => h === "vendor" || h === "brand");

  if (skuIdx < 0 && titleIdx < 0) return "CSV must include sku and/or title columns.";

  const rows: CatalogRowInput[] = [];
  for (const line of lines.slice(1)) {
    const cells = splitCsvLine(line);
    const sku = skuIdx >= 0 ? cells[skuIdx] ?? "" : "";
    const title = titleIdx >= 0 ? cells[titleIdx] ?? "" : "";
    const priceRaw = priceIdx >= 0 ? cells[priceIdx] ?? "" : "";
    const price = Number(String(priceRaw).replace(/[^0-9.]/g, ""));
    const inventoryRaw = invIdx >= 0 ? cells[invIdx] ?? "" : "";
    const inventory = inventoryRaw === "" ? undefined : Number(inventoryRaw.replace(/[^0-9.]/g, ""));
    rows.push({
      sku,
      title,
      price: Number.isFinite(price) ? price : 0,
      inventory: inventory != null && Number.isFinite(inventory) ? inventory : undefined,
      description: descIdx >= 0 ? cells[descIdx] || undefined : undefined,
      vendor: vendorIdx >= 0 ? cells[vendorIdx] || undefined : undefined,
    });
  }
  return rows;
}
