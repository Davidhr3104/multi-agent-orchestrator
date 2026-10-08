import type { DatasetBundle } from "@/lib/types";

export function buildDataAskReply(question: string, bundles: DatasetBundle[]): { answer: string; cites: string[] } {
  const q = question.trim().toLowerCase();
  const bundle = bundles[0];
  if (!bundle) {
    return { answer: "No dataset is on this desk yet. Upload a sheet first.", cites: [] };
  }

  const cites: string[] = [];
  const pending = bundle.changes.filter((c) => bundle.decisions.find((d) => d.changeId === c.id)?.status === "pending");
  const auto = bundle.changes.filter((c) => bundle.decisions.find((d) => d.changeId === c.id)?.status === "auto_approved");

  const cellMatch = q.match(/\b([a-z]{1,3}\d{1,5})\b/i);
  if (cellMatch) {
    const ref = cellMatch[1].toUpperCase();
    const change = bundle.changes.find((c) => c.cellRef.toUpperCase() === ref);
    const issue = bundle.issues.find((i) => `${String.fromCharCode(65 + bundle.grid.headers.indexOf(i.column))}${i.rowIndex + 2}` === ref);
    if (change) {
      cites.push(change.cellRef);
      return {
        answer: `${change.cellRef} (${change.column}): original “${change.before}”. Proposed “${change.after}”. ${change.evidence} Helix does not invent a cell.`,
        cites,
      };
    }
    if (issue) {
      cites.push(ref);
      return { answer: `${ref}: ${issue.message}`, cites };
    }
  }

  if (/hitl|pending|ambiguous|unverified|queue/.test(q)) {
    const lines = pending.slice(0, 8).map((c) => {
      cites.push(c.cellRef);
      return `• ${c.cellRef} ${c.column}: “${c.before}” — ${c.evidence}`;
    });
    return {
      answer: `${bundle.dataset.name} has ${pending.length} cells waiting on a person.\n${lines.join("\n") || "None pending."}`,
      cites,
    };
  }

  if (/complet|empty|profile/.test(q)) {
    const lines = bundle.profiles.map((p) => `• ${p.column}: ${Math.round(p.completeness * 100)}% complete, ${p.inferredType}, ${p.issueCount} issues`);
    return { answer: `Profile for ${bundle.dataset.name}:\n${lines.join("\n")}`, cites: [] };
  }

  if (/dup/.test(q)) {
    const dups = bundle.issues.filter((i) => i.ruleId.includes("dup"));
    return {
      answer: dups.length
        ? `Duplicate findings (${dups.length}):\n${dups.slice(0, 8).map((i) => `• ${i.column} row ${i.rowIndex + 2}: ${i.message}`).join("\n")}`
        : "No duplicate-row issues on this dataset.",
      cites: [],
    };
  }

  const sample = pending[0] ?? auto[0];
  if (sample) cites.push(sample.cellRef);
  return {
    answer: [
      `${bundle.dataset.name}: ${bundle.original.rows} original rows, ${pending.length} HITL, ${auto.length} auto-approved.`,
      sample ? `Example ${sample.cellRef} ${sample.column}: original “${sample.before}”. ${sample.evidence}` : "Upload a file to profile cells.",
      "Ask about a cell (e.g. E3), HITL, completeness, or duplicates. Answers cite cells from this desk. Helix AI can be wrong — check the grid.",
    ].join(" "),
    cites,
  };
}
