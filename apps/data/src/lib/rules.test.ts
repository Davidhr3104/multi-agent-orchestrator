import { describe, expect, it } from "vitest";
import {
  applyApproved,
  autoDecisions,
  formatMoney,
  isAmbiguousDate,
  parseUnambiguousIsoDate,
  proposeRules,
  toE164ish,
} from "@/lib/rules";
import { cloneGrid } from "@/lib/utils";
import { dirtyLeadsGrid } from "@/lib/demo";
import { runPipeline } from "@/lib/pipeline";
import { profileGrid } from "@/lib/profile";
import { exportCleanedCsv, exportCleanedXlsx } from "@/lib/export";
import { parseWorkbook } from "@/lib/parse";
import { publicationIdempotencyKey, validateAgainstContract, contractFor, mapColumns } from "@/lib/contracts";
import { DIRTY_LEADS_CSV } from "@/lib/demo";

describe("dates", () => {
  it("never guesses 03/04", () => {
    expect(isAmbiguousDate("03/04/2026")).toBe(true);
    expect(parseUnambiguousIsoDate("03/04/2026")).toBeNull();
  });

  it("accepts unambiguous ISO, DMY day>12, MDY day>12, named months", () => {
    expect(parseUnambiguousIsoDate("2026-09-18")).toBe("2026-09-18");
    expect(parseUnambiguousIsoDate("18/09/2026")).toBe("2026-09-18");
    expect(parseUnambiguousIsoDate("09/18/2026")).toBe("2026-09-18");
    expect(parseUnambiguousIsoDate("Sep 7, 2026")).toBe("2026-09-07");
  });
});

describe("money and phones", () => {
  it("formats family money", () => {
    expect(formatMoney("$85000")).toBe("$85,000");
    expect(formatMoney("125000")).toBe("$125,000");
    expect(formatMoney("$9,400")).toBe("$9,400");
  });

  it("normalizes E.164-ish phones", () => {
    expect(toE164ish("(555) 123-4567")).toBe("+15551234567");
    expect(toE164ish("+1 415 555 0199")).toBe("+14155550199");
    expect(toE164ish("123")).toBeNull();
  });
});

describe("profile", () => {
  it("flags mixed types, completeness, and exact dupes", () => {
    const { profiles, issues } = profileGrid("v1", dirtyLeadsGrid());
    expect(profiles.find((p) => p.column === "Email")?.completeness).toBeGreaterThan(0.8);
    expect(issues.some((i) => i.ruleId === "exact_duplicate")).toBe(true);
  });
});

describe("rules + diff", () => {
  it("auto-approves trim, email case, E.164, ISO dates, money; HITL on ambiguous dates", () => {
    const grid = dirtyLeadsGrid();
    const { changes, issues } = proposeRules("v1", grid);
    expect(changes.some((c) => c.ruleId === "trim" && c.autoApprove)).toBe(true);
    expect(changes.some((c) => c.ruleId === "email_case" && c.after === "jane.doe@example.com")).toBe(true);
    expect(changes.some((c) => c.ruleId === "phone_e164" && c.after.startsWith("+"))).toBe(true);
    expect(changes.some((c) => c.ruleId === "date_iso" && c.after === "2026-09-18")).toBe(true);
    expect(changes.some((c) => c.ruleId === "money_format" && c.after === "$85,000")).toBe(true);
    expect(issues.some((i) => i.ruleId === "date_ambiguous" && i.message.includes("03/04/2026"))).toBe(true);
    expect(issues.some((i) => i.ruleId === "email_syntax")).toBe(true);
    expect(changes.some((c) => c.ruleId === "date_ambiguous" && !c.autoApprove && c.after === c.before)).toBe(true);
    expect(changes.every((c) => c.origin === "rule")).toBe(true);
  });
});

describe("idempotency and never-overwrite", () => {
  it("does not mutate the original grid when applying or exporting", () => {
    const original = dirtyLeadsGrid();
    const snapshot = JSON.stringify(original);
    const { changes } = proposeRules("v1", original);
    const decisions = autoDecisions(changes, "2026-10-07T00:00:00.000Z");
    const cleaned = applyApproved(original, changes, decisions);
    expect(JSON.stringify(original)).toBe(snapshot);
    expect(JSON.stringify(cleaned)).not.toBe(snapshot);
    const csv = exportCleanedCsv(cleaned);
    const xlsx = exportCleanedXlsx(cleaned);
    expect(JSON.stringify(original)).toBe(snapshot);
    expect(csv.byteLength).toBeGreaterThan(10);
    expect(xlsx.byteLength).toBeGreaterThan(10);
  });

  it("running rules on an already-cleaned copy is a no-op for auto-approved cells", () => {
    const first = runPipeline({ versionId: "v1", grid: dirtyLeadsGrid(), now: "2026-10-07T00:00:00.000Z" });
    const second = runPipeline({ versionId: "v2", grid: first.preview, now: "2026-10-07T00:00:00.000Z" });
    const autoAgain = second.changes.filter((c) => c.autoApprove);
    expect(autoAgain).toHaveLength(0);
    expect(JSON.stringify(second.preview)).toBe(JSON.stringify(first.preview));
  });

  it("clone is deep", () => {
    const g = dirtyLeadsGrid();
    const c = cloneGrid(g);
    c.rows[0][0] = "mutated";
    expect(g.rows[0][0]).not.toBe("mutated");
  });
});

describe("parse + contracts", () => {
  it("parses the invented dirty CSV", () => {
    const parsed = parseWorkbook(Buffer.from(DIRTY_LEADS_CSV, "utf8"), "dirty-leads.csv");
    if (typeof parsed === "string") throw new Error(parsed);
    expect(parsed.grid.rows.length).toBe(8);
    expect(parsed.truncated).toBe(false);
  });

  it("dry-run contract validation never silently drops a row", () => {
    const grid = dirtyLeadsGrid();
    const contract = contractFor("leads");
    const mapping = mapColumns(grid, contract);
    const rows = validateAgainstContract(grid, mapping, contract);
    expect(rows).toHaveLength(grid.rows.length);
    expect(rows.some((r) => !r.accepted && r.reasons.length > 0)).toBe(true);
    expect(publicationIdempotencyKey("abc", "leads", 1)).toBe("leads@v1@abc");
    expect(publicationIdempotencyKey("abc", "leads", 1)).toBe(publicationIdempotencyKey("abc", "leads", 1));
  });
});
