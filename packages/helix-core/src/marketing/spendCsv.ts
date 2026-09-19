import type { SpendRowInput } from "./types";

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

function platformOf(value: string): SpendRowInput["platform"] {
  const v = value.toLowerCase();
  if (v.includes("meta") || v.includes("facebook") || v.includes("ig")) return "meta";
  if (v.includes("google") || v.includes("adwords")) return "google";
  return "other";
}

export function parseSpendCsv(text: string): SpendRowInput[] | string {
  const lines = text
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length < 2) return "CSV needs a header row and at least one campaign row.";

  const headers = splitCsvLine(lines[0]).map(headerKey);
  const idIdx = headers.findIndex((h) => h === "campaignid" || h === "campaign" || h === "id");
  const nameIdx = headers.findIndex((h) => h === "name" || h === "campaignname");
  const platformIdx = headers.findIndex((h) => h === "platform" || h === "channel");
  const spendIdx = headers.findIndex((h) => h === "spend" || h === "cost" || h === "amount");
  const impIdx = headers.findIndex((h) => h === "impressions" || h === "imps");
  const clickIdx = headers.findIndex((h) => h === "clicks");
  const formIdx = headers.findIndex((h) => h === "formleads" || h === "leads" || h === "forms");

  if (idIdx < 0) return "CSV must include a campaign_id column.";
  if (spendIdx < 0) return "CSV must include a spend column.";

  const rows: SpendRowInput[] = [];
  for (const line of lines.slice(1)) {
    const cells = splitCsvLine(line);
    const campaignId = cells[idIdx] ?? "";
    if (!campaignId) continue;
    const spend = Number(String(cells[spendIdx] ?? "").replace(/[^0-9.]/g, ""));
    rows.push({
      campaignId,
      name: nameIdx >= 0 ? cells[nameIdx] || campaignId : campaignId,
      platform: platformOf(platformIdx >= 0 ? cells[platformIdx] ?? "" : ""),
      spend: Number.isFinite(spend) ? spend : 0,
      impressions: impIdx >= 0 ? Number(cells[impIdx]) || undefined : undefined,
      clicks: clickIdx >= 0 ? Number(cells[clickIdx]) || undefined : undefined,
      formLeads: formIdx >= 0 ? Number(cells[formIdx]) || undefined : undefined,
    });
  }
  return rows;
}
