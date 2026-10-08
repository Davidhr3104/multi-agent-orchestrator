import type { Issue, ProposedChange, SheetGrid } from "@/lib/types";
import { cellRef, headerKey } from "@/lib/utils";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MONEY_RE = /^\$?\s*-?\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?$|^\$?\s*-?\d+(?:\.\d{1,2})?$/;
const PHONE_DIGIT_RE = /[0-9]/;

export function looksLikeEmail(v: string): boolean {
  return EMAIL_RE.test(v.trim());
}

export function looksLikePhone(v: string): boolean {
  const digits = v.replace(/\D/g, "");
  return digits.length >= 10 && digits.length <= 15 && PHONE_DIGIT_RE.test(v);
}

export function looksLikeMoney(v: string): boolean {
  const t = v.trim();
  if (t.startsWith("$")) return true;
  return MONEY_RE.test(t) && /[0-9]/.test(t) && (t.includes(",") || t.includes("."));
}

export function looksLikeNumber(v: string): boolean {
  const t = v.trim().replace(/,/g, "");
  if (!t) return false;
  return /^-?\d+(\.\d+)?$/.test(t);
}

/** Returns ISO YYYY-MM-DD only when the date cannot be DMY vs MDY. Never guesses 03/04. */
export function parseUnambiguousIsoDate(raw: string): string | null {
  const v = raw.trim();
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v);
  if (iso) {
    const y = Number(iso[1]);
    const m = Number(iso[2]);
    const d = Number(iso[3]);
    if (validYmd(y, m, d)) return `${iso[1]}-${iso[2]}-${iso[3]}`;
    return null;
  }
  const ymdSlash = /^(\d{4})[/.](\d{1,2})[/.](\d{1,2})$/.exec(v);
  if (ymdSlash) {
    const y = Number(ymdSlash[1]);
    const m = Number(ymdSlash[2]);
    const d = Number(ymdSlash[3]);
    if (validYmd(y, m, d)) return isoDate(y, m, d);
    return null;
  }
  const named = /^(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+(\d{1,2}),?\s+(\d{4})$/i.exec(v);
  if (named) {
    const m = monthName(named[1]);
    const d = Number(named[2]);
    const y = Number(named[3]);
    if (m && validYmd(y, m, d)) return isoDate(y, m, d);
    return null;
  }
  const slash = /^(\d{1,2})[/.](\d{1,2})[/.](\d{2,4})$/.exec(v);
  if (slash) {
    const a = Number(slash[1]);
    const b = Number(slash[2]);
    let y = Number(slash[3]);
    if (slash[3].length === 2) y += y >= 70 ? 1900 : 2000;
    if (a > 12 && b <= 12) {
      if (validYmd(y, b, a)) return isoDate(y, b, a);
      return null;
    }
    if (b > 12 && a <= 12) {
      if (validYmd(y, a, b)) return isoDate(y, a, b);
      return null;
    }
    return null;
  }
  return null;
}

export function isAmbiguousDate(raw: string): boolean {
  const v = raw.trim();
  const slash = /^(\d{1,2})[/.](\d{1,2})[/.](\d{2,4})$/.exec(v);
  if (!slash) return false;
  const a = Number(slash[1]);
  const b = Number(slash[2]);
  return a >= 1 && a <= 12 && b >= 1 && b <= 12;
}

function validYmd(y: number, m: number, d: number): boolean {
  if (y < 1900 || y > 2100 || m < 1 || m > 12 || d < 1 || d > 31) return false;
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

function isoDate(y: number, m: number, d: number): string {
  return `${String(y).padStart(4, "0")}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

function monthName(raw: string): number | null {
  const key = raw.slice(0, 3).toLowerCase();
  const map: Record<string, number> = {
    jan: 1,
    feb: 2,
    mar: 3,
    apr: 4,
    may: 5,
    jun: 6,
    jul: 7,
    aug: 8,
    sep: 9,
    oct: 10,
    nov: 11,
    dec: 12,
  };
  return map[key] ?? null;
}

export function formatMoney(raw: string): string | null {
  const t = raw.trim().replace(/[$,\s]/g, "");
  if (!t || !/^-?\d+(\.\d{1,2})?$/.test(t)) return null;
  const n = Number(t);
  if (!Number.isFinite(n)) return null;
  const abs = Math.abs(n);
  const [int, frac] = abs.toFixed(abs % 1 === 0 ? 0 : 2).split(".");
  const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  const body = frac ? `${grouped}.${frac}` : grouped;
  return n < 0 ? `-$${body}` : `$${body}`;
}

/** US-leaning E.164-ish: 10 digits → +1; 11 starting with 1 → +1; already +cc. */
export function toE164ish(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const plus = trimmed.startsWith("+");
  const digits = trimmed.replace(/\D/g, "");
  if (digits.length < 10 || digits.length > 15) return null;
  if (plus && digits.length >= 10) return `+${digits}`;
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  if (digits.length > 11) return `+${digits}`;
  return null;
}

export function normalizeEmail(raw: string): string | null {
  const t = raw.trim().toLowerCase();
  if (!EMAIL_RE.test(t)) return null;
  return t;
}

function titleCase(raw: string): string {
  return raw
    .trim()
    .split(/\s+/)
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1).toLowerCase() : w))
    .join(" ");
}

export function proposeRules(versionId: string, grid: SheetGrid, extraIssues: Issue[] = []): {
  changes: ProposedChange[];
  issues: Issue[];
} {
  const issues = [...extraIssues];
  const changes: ProposedChange[] = [];
  const push = (c: Omit<ProposedChange, "id">) => {
    changes.push({
      id: `${versionId}:${c.ruleId}:${c.cellRef}`,
      ...c,
    });
  };

  grid.rows.forEach((row, rowIndex) => {
    row.forEach((raw, colIndex) => {
      const column = grid.headers[colIndex] ?? `Column ${colIndex + 1}`;
      const key = headerKey(column);
      const ref = cellRef(colIndex, rowIndex);
      const trimmed = raw.trim();
      if (raw !== trimmed && raw.length > 0) {
        push({
          issueId: null,
          cellRef: ref,
          rowIndex,
          column,
          before: raw,
          after: trimmed,
          ruleId: "trim",
          origin: "rule",
          confidence: 1,
          evidence: "Leading/trailing whitespace.",
          autoApprove: true,
        });
      }
      const working = trimmed;

      if (key.includes("email") || looksLikeEmail(working) || /@/.test(working)) {
        if (working && !looksLikeEmail(working)) {
          issues.push({
            id: `${versionId}:email:${ref}`,
            versionId,
            column,
            rowIndex,
            ruleId: "email_syntax",
            severity: "block",
            message: `“${working}” is not a valid email. Left unverified — never invented.`,
          });
          push({
            issueId: `${versionId}:email:${ref}`,
            cellRef: ref,
            rowIndex,
            column,
            before: working,
            after: working,
            ruleId: "email_syntax",
            origin: "rule",
            confidence: 0,
            evidence: "Unverified email. No invented repair.",
            autoApprove: false,
          });
        } else {
          const next = normalizeEmail(working);
          if (next && next !== working) {
            push({
              issueId: null,
              cellRef: ref,
              rowIndex,
              column,
              before: working,
              after: next,
              ruleId: "email_case",
              origin: "rule",
              confidence: 1,
              evidence: "Lowercase valid email syntax.",
              autoApprove: true,
            });
          }
        }
      }

      if (key.includes("phone") || (looksLikePhone(working) && !looksLikeEmail(working))) {
        const next = toE164ish(working);
        if (next && next !== working) {
          push({
            issueId: null,
            cellRef: ref,
            rowIndex,
            column,
            before: working,
            after: next,
            ruleId: "phone_e164",
            origin: "rule",
            confidence: 0.9,
            evidence: "Digits-only E.164-ish normalization.",
            autoApprove: true,
          });
        } else if (working && !next && (key.includes("phone") || /\d{6,}/.test(working))) {
          issues.push({
            id: `${versionId}:phone:${ref}`,
            versionId,
            column,
            rowIndex,
            ruleId: "phone_e164",
            severity: "warn",
            message: `Phone “${working}” is not E.164-ish. Left unverified.`,
          });
        }
      }

      const dateish = key.includes("date") || key.includes("signup") || /^\d{1,2}[/.]\d{1,2}[/.]\d{2,4}$/.test(working) || /^\d{4}-\d{2}-\d{2}$/.test(working);
      if (working && dateish) {
        if (isAmbiguousDate(working)) {
          issues.push({
            id: `${versionId}:ambigdate:${ref}`,
            versionId,
            column,
            rowIndex,
            ruleId: "date_ambiguous",
            severity: "block",
            message: `Date “${working}” could be MDY or DMY. HITL — never guessed.`,
          });
          push({
            issueId: `${versionId}:ambigdate:${ref}`,
            cellRef: ref,
            rowIndex,
            column,
            before: working,
            after: working,
            ruleId: "date_ambiguous",
            origin: "rule",
            confidence: 0,
            evidence: "Ambiguous MDY/DMY. Value unchanged until a person sets the ISO date.",
            autoApprove: false,
          });
        } else {
          const iso = parseUnambiguousIsoDate(working);
          if (iso && iso !== working) {
            push({
              issueId: null,
              cellRef: ref,
              rowIndex,
              column,
              before: working,
              after: iso,
              ruleId: "date_iso",
              origin: "rule",
              confidence: 1,
              evidence: "Unambiguous calendar date → ISO YYYY-MM-DD.",
              autoApprove: true,
            });
          } else if (!iso && (key.includes("date") || key.includes("signup"))) {
            issues.push({
              id: `${versionId}:baddate:${ref}`,
              versionId,
              column,
              rowIndex,
              ruleId: "date_iso",
              severity: "warn",
              message: `Date “${working}” could not be verified. Left unverified.`,
            });
          }
        }
      }

      const moneyish = key.includes("deal") || key.includes("amount") || key.includes("spend") || key.includes("price") || key.includes("budget") || working.startsWith("$");
      if (working && moneyish) {
        const next = formatMoney(working);
        if (next && next !== working) {
          push({
            issueId: null,
            cellRef: ref,
            rowIndex,
            column,
            before: working,
            after: next,
            ruleId: "money_format",
            origin: "rule",
            confidence: 1,
            evidence: "Family money format $85,000.",
            autoApprove: true,
          });
        }
      }

      if ((key === "name" || key.endsWith("name") || key === "company") && working && /^[A-Za-z][A-Za-z\s'.-]*$/.test(working)) {
        const isAll = working === working.toUpperCase() || working === working.toLowerCase();
        if (isAll && working.length > 1) {
          const next = titleCase(working);
          if (next !== working) {
            push({
              issueId: null,
              cellRef: ref,
              rowIndex,
              column,
              before: working,
              after: next,
              ruleId: "case_normalize",
              origin: "rule",
              confidence: 0.85,
              evidence: "All-caps or all-lower name/company → title case.",
              autoApprove: true,
            });
          }
        }
      }
    });
  });

  return { changes, issues };
}

export function applyApproved(
  grid: SheetGrid,
  changes: ProposedChange[],
  decisions: { changeId: string; status: string }[]
): SheetGrid {
  const allowed = new Set(
    decisions.filter((d) => d.status === "approved" || d.status === "auto_approved").map((d) => d.changeId)
  );
  const next = {
    headers: [...grid.headers],
    rows: grid.rows.map((r) => [...r]),
  };
  const byCol = new Map(next.headers.map((h, i) => [h, i]));
  for (const c of changes) {
    if (!allowed.has(c.id)) continue;
    const col = byCol.get(c.column);
    if (col === undefined) continue;
    const row = next.rows[c.rowIndex];
    if (!row) continue;
    row[col] = c.after;
  }
  return next;
}

export function autoDecisions(changes: ProposedChange[], decidedAt: string, decidedBy = "rule"): {
  changeId: string;
  decidedBy: string;
  decidedAt: string;
  status: "auto_approved" | "pending";
}[] {
  return changes.map((c) => ({
    changeId: c.id,
    decidedBy: c.autoApprove ? decidedBy : "pending",
    decidedAt: c.autoApprove ? decidedAt : "",
    status: c.autoApprove ? "auto_approved" : "pending",
  }));
}
