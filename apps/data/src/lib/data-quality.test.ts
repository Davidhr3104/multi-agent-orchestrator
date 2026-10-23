import { describe, expect, it } from "vitest";
import { dirtyLeadsGrid } from "@/lib/demo";
import { runPipeline } from "@/lib/pipeline";
import { ALL_COLUMNS, findDuplicateRows, profileGrid } from "@/lib/profile";
import {
  ambiguousDateCandidates,
  applyApproved,
  proposeRules,
  resolveAmbiguousDate,
} from "@/lib/rules";
import { contractFor, fieldTypeProblem, mapColumns, validateAgainstContract } from "@/lib/contracts";
import type { SheetGrid } from "@/lib/types";

describe("rules only touch the columns they are about", () => {
  it("never rewrites a 10-digit ID as a phone number", () => {
    const grid: SheetGrid = {
      headers: ["Order ID", "Phone"],
      rows: [["5551234567", "(555) 123-4567"]],
    };
    const { changes } = proposeRules("v1", grid);
    expect(changes.some((c) => c.ruleId === "phone_e164" && c.column === "Order ID")).toBe(false);
    expect(changes.some((c) => c.ruleId === "phone_e164" && c.column === "Phone" && c.after === "+15551234567")).toBe(true);
  });

  it("does not call free text with an @ a broken email", () => {
    const grid: SheetGrid = {
      headers: ["Message", "Email"],
      rows: [["call me @ 5pm", "john@acme"]],
    };
    const { issues } = proposeRules("v1", grid);
    expect(issues.filter((i) => i.ruleId === "email_syntax").map((i) => i.column)).toEqual(["Email"]);
  });
});

describe("duplicates", () => {
  it("does not flag every repeated city as a duplicate", () => {
    const { issues } = profileGrid("v1", dirtyLeadsGrid());
    expect(issues.filter((i) => i.column === "City")).toHaveLength(0);
    expect(issues.filter((i) => i.ruleId === "exact_duplicate")).toHaveLength(0);
  });

  it("finds the same lead by normalized email even when other cells differ", () => {
    const { issues } = profileGrid("v1", dirtyLeadsGrid());
    const dupe = issues.find((i) => i.ruleId === "duplicate_key");
    expect(dupe).toMatchObject({ column: "Email", rowIndex: 4, severity: "warn" });
    expect(dupe?.message).toContain("row 2");
  });

  it("flags a whole repeated row once, as exact_duplicate, and never deletes anything", () => {
    const grid: SheetGrid = {
      headers: ["Name", "Email"],
      rows: [
        ["Ava", "ava@example.com"],
        ["  AVA ", "AVA@example.com"],
        ["Bo", "bo@example.com"],
      ],
    };
    const before = JSON.stringify(grid);
    const issues = findDuplicateRows("v1", grid);
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({ ruleId: "exact_duplicate", column: ALL_COLUMNS, rowIndex: 1 });
    expect(JSON.stringify(grid)).toBe(before);
  });

  it("ignores blank cells and implausible keys", () => {
    const grid: SheetGrid = {
      headers: ["Email", "Phone"],
      rows: [
        ["", "123"],
        ["", "123"],
        ["not-an-email", ""],
        ["not-an-email", "x"],
      ],
    };
    expect(findDuplicateRows("v1", grid).filter((i) => i.ruleId === "duplicate_key")).toHaveLength(0);
  });
});

describe("contract validation checks types, not just presence", () => {
  const { preview } = runPipeline({ versionId: "v1", grid: dirtyLeadsGrid(), now: "2026-10-07T00:00:00.000Z" });
  const contract = contractFor("leads");
  const rows = validateAgainstContract(preview, mapColumns(preview, contract), contract);

  it("rejects an email that is present but invalid", () => {
    const john = rows[1];
    expect(john.accepted).toBe(false);
    expect(john.reasons.join(" ")).toContain("email: “john@acme” is not a valid email.");
  });

  it("rejects the second lead with the same email and says which row it repeats", () => {
    expect(rows[0].accepted).toBe(true);
    expect(rows[4].accepted).toBe(false);
    expect(rows[4].reasons).toEqual(["Duplicate of row 2 (same email)."]);
  });

  it("accepts exactly the clean rows and classifies every row", () => {
    expect(rows).toHaveLength(preview.rows.length);
    expect(rows.filter((r) => r.accepted).map((r) => r.rowIndex)).toEqual([0, 2, 3, 5, 7]);
    expect(rows.every((r) => r.accepted || r.reasons.length > 0)).toBe(true);
  });

  it("does not treat the same campaign on different days as a duplicate", () => {
    const marketing = contractFor("marketing");
    const grid: SheetGrid = {
      headers: ["Campaign ID", "Spend", "Date"],
      rows: [
        ["c1", "$100", "2026-09-01"],
        ["c1", "$120", "2026-09-02"],
        ["c1", "$130", "2026-09-02"],
      ],
    };
    const out = validateAgainstContract(grid, mapColumns(grid, marketing), marketing);
    expect(out.map((r) => r.accepted)).toEqual([true, true, false]);
    expect(out[2].reasons[0]).toContain("Duplicate of row 3");
  });

  it("only checks row identity when every key field is mapped", () => {
    const marketing = contractFor("marketing");
    const grid: SheetGrid = {
      headers: ["Campaign ID", "Spend"],
      rows: [
        ["c1", "$100"],
        ["c1", "$120"],
      ],
    };
    const out = validateAgainstContract(grid, mapColumns(grid, marketing), marketing);
    expect(out.every((r) => r.accepted)).toBe(true);
  });

  it("explains each type problem and never repairs the value", () => {
    expect(fieldTypeProblem("money", "n/a")).toContain("not an amount");
    expect(fieldTypeProblem("money", "$85,000")).toBeNull();
    expect(fieldTypeProblem("number", "12abc")).toContain("not a number");
    expect(fieldTypeProblem("phone", "5551234567")).toContain("E.164");
    expect(fieldTypeProblem("phone", "+15551234567")).toBeNull();
    expect(fieldTypeProblem("date", "03/04/2026")).toContain("ambiguous");
    expect(fieldTypeProblem("date", "Sep 7, 2026")).toContain("ISO");
    expect(fieldTypeProblem("date", "2026-09-07")).toBeNull();
    expect(fieldTypeProblem("text", "anything")).toBeNull();
  });
});

describe("ambiguous dates are resolved by a person, never guessed", () => {
  it("offers both readings only when the date is truly ambiguous", () => {
    expect(ambiguousDateCandidates("03/04/2026")).toEqual({ mdy: "2026-03-04", dmy: "2026-04-03" });
    expect(ambiguousDateCandidates("03/04/26")).toEqual({ mdy: "2026-03-04", dmy: "2026-04-03" });
    expect(ambiguousDateCandidates("18/09/2026")).toBeNull();
    expect(ambiguousDateCandidates("2026-09-18")).toBeNull();
  });

  it("writes the chosen reading into the cleaned grid and records who chose it", () => {
    const grid = dirtyLeadsGrid();
    const { changes } = proposeRules("v1", grid);
    const change = changes.find((c) => c.ruleId === "date_ambiguous")!;
    expect(change.after).toBe("03/04/2026");

    const resolved = resolveAmbiguousDate(change, "dmy", "ops@helix.test");
    if (typeof resolved === "string") throw new Error(resolved);
    expect(resolved).toMatchObject({ after: "2026-04-03", confidence: 1, evidence: "Read as DMY by ops@helix.test." });

    const next = changes.map((c) => (c.id === resolved.id ? resolved : c));
    const cleaned = applyApproved(grid, next, [{ changeId: resolved.id, status: "approved" }]);
    const col = grid.headers.indexOf("Signup Date");
    expect(cleaned.rows[0][col]).toBe("2026-04-03");
    expect(grid.rows[0][col]).toBe("03/04/2026");
  });

  it("refuses to resolve anything that is not an ambiguous date", () => {
    const { changes } = proposeRules("v1", dirtyLeadsGrid());
    const trim = changes.find((c) => c.ruleId === "trim")!;
    expect(resolveAmbiguousDate(trim, "mdy", "ops")).toBe("Only ambiguous dates can be resolved this way.");
  });
});
