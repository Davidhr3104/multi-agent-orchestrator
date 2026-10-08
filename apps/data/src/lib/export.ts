import * as XLSX from "xlsx";
import type { DatasetBundle, SheetGrid } from "@/lib/types";
import { cloneGrid, headerKey } from "@/lib/utils";
import { gridToCsv } from "@/lib/parse";
import { looksLikeMoney } from "@/lib/rules";

function parseMoneyNumber(raw: string): number | null {
  const t = raw.trim().replace(/[$,]/g, "");
  if (!t || /^n\/?a$/i.test(t)) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

function moneyColumns(bundle: DatasetBundle): Set<number> {
  const out = new Set<number>();
  bundle.grid.headers.forEach((h, i) => {
    const key = headerKey(h);
    const profile = bundle.profiles.find((p) => p.column === h);
    if (profile?.inferredType === "money" || /amount|spend|price|budget|cost|deal/.test(key)) out.add(i);
  });
  return out;
}

function emptyBundle(grid: SheetGrid): DatasetBundle {
  return {
    dataset: {
      id: "export",
      orgId: "org-helix",
      name: "export",
      source: "file",
      originalFileName: "export.xlsx",
      invented: false,
      ownerKey: null,
      createdAt: "",
    },
    original: {
      id: "export-original",
      datasetId: "export",
      kind: "original",
      storageKey: "export",
      rows: grid.rows.length,
      cols: grid.headers.length,
      hash: "",
      createdAt: "",
    },
    cleaned: null,
    grid,
    originalGrid: grid,
    profiles: [],
    issues: [],
    changes: [],
    decisions: [],
    mapping: [],
    targetApp: "leads",
    truncated: false,
    hitlCount: 0,
    autoCount: 0,
  };
}

function isBundle(input: SheetGrid | DatasetBundle): input is DatasetBundle {
  return "dataset" in input;
}

/** Always a new workbook. The original grid is never mutated. */
export function exportCleanedXlsx(input: SheetGrid | DatasetBundle, sheetName = "Cleaned"): Buffer {
  const bundle = isBundle(input) ? input : emptyBundle(input);
  const copy = cloneGrid(bundle.grid);
  const money = moneyColumns(bundle);
  const pending = new Set(
    bundle.decisions.filter((d) => d.status === "pending").map((d) => bundle.changes.find((c) => c.id === d.changeId)?.cellRef).filter(Boolean) as string[]
  );
  const aoa: (string | number)[][] = [
    copy.headers,
    ...copy.rows.map((row) =>
      row.map((cell, i) => {
        if (money.has(i) || looksLikeMoney(cell)) {
          const n = parseMoneyNumber(cell);
          if (n != null) return n;
        }
        return cell;
      })
    ),
  ];
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  money.forEach((col) => {
    const letter = XLSX.utils.encode_col(col);
    for (let r = 1; r <= copy.rows.length; r += 1) {
      const addr = `${letter}${r + 1}`;
      const cell = ws[addr];
      if (cell && typeof cell.v === "number") cell.z = '"$"#,##0.00';
    }
  });
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName.slice(0, 31) || "Cleaned");

  const unverified: string[][] = [["cell", "column", "value", "evidence"]];
  for (const change of bundle.changes) {
    const decision = bundle.decisions.find((d) => d.changeId === change.id);
    if (decision?.status !== "pending") continue;
    unverified.push([change.cellRef, change.column, change.before, change.evidence]);
  }
  const audit: string[][] = [["cell", "before", "after", "rule", "status"]];
  for (const change of bundle.changes) {
    const decision = bundle.decisions.find((d) => d.changeId === change.id);
    audit.push([change.cellRef, change.before, change.after, change.ruleId, decision?.status ?? ""]);
  }
  if (unverified.length > 1) {
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(unverified), "Unverified");
  }
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(audit), "Audit");
  void pending;
  return Buffer.from(XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer);
}

export function exportCleanedCsv(grid: SheetGrid): Buffer {
  return Buffer.from(gridToCsv(cloneGrid(grid)), "utf8");
}

export function cleanedFileName(originalFileName: string, ext: "xlsx" | "csv"): string {
  const base = originalFileName.replace(/\.(xlsx|xls|csv)$/i, "");
  return `${base}.cleaned.${ext}`;
}
