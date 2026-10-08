import type { DatasetBundle, Decision, ProposedChange, SheetGrid } from "@/lib/types";
import { cloneGrid } from "@/lib/utils";
import { profileGrid } from "@/lib/profile";
import { applyApproved, autoDecisions, proposeRules } from "@/lib/rules";
import { contractFor, mapColumns } from "@/lib/contracts";
import type { ImportContract } from "@/lib/types";

export function runPipeline(input: {
  versionId: string;
  grid: SheetGrid;
  targetApp?: ImportContract["app"];
  now?: string;
}): {
  profiles: ReturnType<typeof profileGrid>["profiles"];
  issues: ReturnType<typeof profileGrid>["issues"];
  changes: ProposedChange[];
  decisions: Decision[];
  mapping: ReturnType<typeof mapColumns>;
  preview: SheetGrid;
} {
  const now = input.now ?? new Date().toISOString();
  const original = cloneGrid(input.grid);
  const { profiles, issues: profileIssues } = profileGrid(input.versionId, original);
  const { changes, issues } = proposeRules(input.versionId, original, profileIssues);
  const decisions = autoDecisions(changes, now) as Decision[];
  const preview = applyApproved(original, changes, decisions);
  const contract = contractFor(input.targetApp ?? "leads");
  const mapping = mapColumns(original, contract);
  return { profiles, issues, changes, decisions, mapping, preview };
}

export function provenanceFor(bundle: DatasetBundle, cellRef: string) {
  const change = bundle.changes.find((c) => c.cellRef === cellRef);
  const decision = change ? bundle.decisions.find((d) => d.changeId === change.id) : undefined;
  const [colLetters, row] = [cellRef.replace(/\d/g, ""), Number(cellRef.replace(/\D/g, ""))];
  void colLetters;
  const rowIndex = Number.isFinite(row) ? row - 2 : -1;
  const originalValue =
    change?.before ??
    (rowIndex >= 0
      ? bundle.originalGrid.rows[rowIndex]?.[bundle.originalGrid.headers.indexOf(change?.column ?? "")] ?? ""
      : "");
  return {
    cellRef,
    originalValue,
    currentValue: change?.after ?? originalValue,
    ruleId: change?.ruleId ?? null,
    origin: change?.origin ?? null,
    confidence: change?.confidence ?? null,
    approvedBy: decision && (decision.status === "approved" || decision.status === "auto_approved") ? decision.decidedBy : null,
    approvedAt: decision && (decision.status === "approved" || decision.status === "auto_approved") ? decision.decidedAt : null,
  };
}
