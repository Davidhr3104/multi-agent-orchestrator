import type { ColumnProfile, ImportFieldType, Issue, SheetGrid } from "@/lib/types";
import { looksLikeEmail, looksLikeMoney, looksLikeNumber, looksLikePhone, parseUnambiguousIsoDate } from "@/lib/rules";
import { headerKey } from "@/lib/utils";

export function profileGrid(versionId: string, grid: SheetGrid): { profiles: ColumnProfile[]; issues: Issue[] } {
  const issues: Issue[] = [];
  const profiles: ColumnProfile[] = grid.headers.map((column, columnIndex) => {
    const values = grid.rows.map((r) => r[columnIndex] ?? "");
    const filled = values.filter((v) => v.trim() !== "");
    const types = filled.map(inferCellType);
    const typeSet = new Set(types);
    const mixedFormats = typeSet.size > 1;
    const empty = filled.length === 0;
    let inferredType: ColumnProfile["inferredType"] = "empty";
    if (!empty) {
      if (typeSet.size === 1) inferredType = [...typeSet][0];
      else inferredType = "mixed";
    }
    const unique = new Set(filled.map((v) => v.trim()));
    if (empty) {
      issues.push({
        id: `${versionId}:empty:${columnIndex}`,
        versionId,
        column,
        rowIndex: -1,
        ruleId: "empty_column",
        severity: "info",
        message: `Column “${column}” is empty.`,
      });
    }
    if (mixedFormats) {
      issues.push({
        id: `${versionId}:mixed:${columnIndex}`,
        versionId,
        column,
        rowIndex: -1,
        ruleId: "mixed_types",
        severity: "warn",
        message: `Column “${column}” mixes ${[...typeSet].join(", ")}.`,
      });
    }
    markNumericOutliers(versionId, column, columnIndex, values, issues);
    return {
      versionId,
      column,
      columnIndex,
      inferredType,
      completeness: values.length === 0 ? 0 : filled.length / values.length,
      mixedFormats,
      empty,
      uniqueCount: unique.size,
      sample: filled.slice(0, 5),
      issueCount: 0,
    };
  });
  issues.push(...findDuplicateRows(versionId, grid));
  for (const p of profiles) {
    p.issueCount = issues.filter((i) => i.column === p.column).length;
  }
  return { profiles, issues };
}

export const ALL_COLUMNS = "(all columns)";

function isEmailHeader(header: string): boolean {
  return headerKey(header).includes("email");
}

function isPhoneHeader(header: string): boolean {
  const key = headerKey(header);
  return key.includes("phone") || key.includes("mobile") || key === "tel" || key.includes("telephone");
}

/**
 * Row-level duplicates. Flags the *later* row and points at the first one. Nothing is deleted:
 * these are issues for a person to decide on.
 *  - exact_duplicate: every cell matches after trim / lowercase / collapsed whitespace.
 *  - duplicate_key:   same normalized email or phone, even if other cells differ.
 */
export function findDuplicateRows(versionId: string, grid: SheetGrid): Issue[] {
  const issues: Issue[] = [];
  const norm = (v: string) => v.trim().toLowerCase().replace(/\s+/g, " ");
  const exactSeen = new Map<string, number>();
  const exactDupes = new Set<number>();

  grid.rows.forEach((row, rowIndex) => {
    const cells = grid.headers.map((_, i) => norm(row[i] ?? ""));
    if (cells.every((c) => c === "")) return;
    const key = cells.join("\u0001");
    const first = exactSeen.get(key);
    if (first === undefined) {
      exactSeen.set(key, rowIndex);
      return;
    }
    exactDupes.add(rowIndex);
    issues.push({
      id: `${versionId}:dupe:${rowIndex}`,
      versionId,
      column: ALL_COLUMNS,
      rowIndex,
      ruleId: "exact_duplicate",
      severity: "warn",
      message: `Row ${rowIndex + 2} is an exact duplicate of row ${first + 2}.`,
    });
  });

  grid.headers.forEach((header, columnIndex) => {
    const email = isEmailHeader(header);
    if (!email && !isPhoneHeader(header)) return;
    const seen = new Map<string, number>();
    grid.rows.forEach((row, rowIndex) => {
      const raw = (row[columnIndex] ?? "").trim();
      if (!raw) return;
      const key = email ? raw.toLowerCase() : raw.replace(/\D/g, "").slice(-10);
      // A value that isn't a plausible key can't be a duplicate of anything.
      if (email ? !looksLikeEmail(key) : key.length < 10) return;
      const first = seen.get(key);
      if (first === undefined) {
        seen.set(key, rowIndex);
        return;
      }
      if (exactDupes.has(rowIndex)) return;
      issues.push({
        id: `${versionId}:dupekey:${columnIndex}:${rowIndex}`,
        versionId,
        column: header,
        rowIndex,
        ruleId: "duplicate_key",
        severity: "warn",
        message: `Row ${rowIndex + 2} repeats the ${email ? "email" : "phone"} of row ${first + 2} in “${header}”. Not removed — review.`,
      });
    });
  });
  return issues;
}

export function inferCellType(raw: string): ImportFieldType {
  const v = raw.trim();
  if (looksLikeEmail(v)) return "email";
  if (looksLikePhone(v)) return "phone";
  if (looksLikeMoney(v)) return "money";
  if (parseUnambiguousIsoDate(v)) return "date";
  if (looksLikeNumber(v)) return "number";
  return "text";
}

function markNumericOutliers(
  versionId: string,
  column: string,
  columnIndex: number,
  values: string[],
  issues: Issue[]
) {
  const nums: { i: number; n: number }[] = [];
  values.forEach((v, i) => {
    const n = Number(String(v).replace(/[$,]/g, "").trim());
    if (v.trim() && Number.isFinite(n)) nums.push({ i, n });
  });
  if (nums.length < 6) return;
  const sorted = [...nums].sort((a, b) => a.n - b.n);
  const q1 = sorted[Math.floor(sorted.length * 0.25)].n;
  const q3 = sorted[Math.floor(sorted.length * 0.75)].n;
  const iqr = q3 - q1;
  if (iqr <= 0) return;
  const lo = q1 - 3 * iqr;
  const hi = q3 + 3 * iqr;
  for (const { i, n } of nums) {
    if (n < lo || n > hi) {
      issues.push({
        id: `${versionId}:outlier:${columnIndex}:${i}`,
        versionId,
        column,
        rowIndex: i,
        ruleId: "outlier",
        severity: "info",
        message: `Marked outlier ${n} in “${column}” — not changed.`,
      });
    }
  }
}
