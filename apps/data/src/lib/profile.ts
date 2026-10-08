import type { ColumnProfile, ImportFieldType, Issue, SheetGrid } from "@/lib/types";
import { looksLikeEmail, looksLikeMoney, looksLikeNumber, looksLikePhone, parseUnambiguousIsoDate } from "@/lib/rules";

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
    const seen = new Map<string, number>();
    values.forEach((v, rowIndex) => {
      const key = v.trim().toLowerCase();
      if (!key) return;
      const first = seen.get(key);
      if (first === undefined) {
        seen.set(key, rowIndex);
        return;
      }
      issues.push({
        id: `${versionId}:dupe:${columnIndex}:${rowIndex}`,
        versionId,
        column,
        rowIndex,
        ruleId: "exact_duplicate",
        severity: "warn",
        message: `Exact duplicate of row ${first + 2} in “${column}”.`,
      });
    });
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
  for (const p of profiles) {
    p.issueCount = issues.filter((i) => i.column === p.column).length;
  }
  return { profiles, issues };
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
