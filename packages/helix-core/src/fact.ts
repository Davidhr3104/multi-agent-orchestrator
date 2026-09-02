import type { ScoredField } from "./types";

export type DocumentCite = {
  quote: string;
  spanStart: number;
  spanEnd: number;
  verified: boolean;
  evidence: string;
};

export function missingCite(reason: string): DocumentCite {
  return {
    quote: "",
    spanStart: -1,
    spanEnd: -1,
    verified: false,
    evidence: `FACT: ${reason}`,
  };
}

/** Locate an exact or regex span in the source document for FACT. */
export function citeSpan(document: string, needle: string | RegExp): DocumentCite {
  if (!document.trim()) return missingCite("document is empty");

  if (typeof needle === "string") {
    const n = needle.trim();
    if (!n) return missingCite("no span to cite");
    const idx = document.toLowerCase().indexOf(n.toLowerCase());
    if (idx < 0) return missingCite(`span not in document (${n.slice(0, 80)})`);
    const quote = document.slice(idx, idx + n.length);
    return {
      quote,
      spanStart: idx,
      spanEnd: idx + n.length,
      verified: true,
      evidence: `chars ${idx}-${idx + n.length}: "${quote}"`,
    };
  }

  const match = needle.exec(document);
  if (!match || match.index == null) return missingCite("pattern not in document");
  const quote = match[0];
  return {
    quote,
    spanStart: match.index,
    spanEnd: match.index + quote.length,
    verified: true,
    evidence: `chars ${match.index}-${match.index + quote.length}: "${quote}"`,
  };
}

export function hydrateScoredField(
  document: string,
  partial: {
    key?: string;
    label?: string;
    value?: string;
    confidence?: number;
    evidence?: string;
    quote?: string;
    spanStart?: number;
    spanEnd?: number;
    verified?: boolean;
  },
  index: number
): ScoredField {
  const value = String(partial.value ?? "");
  const confidence = Math.max(0.15, Math.min(0.98, Number(partial.confidence) || 0.5));
  const needle = (partial.quote || partial.evidence || value).trim();
  const cite =
    typeof partial.spanStart === "number" &&
    partial.spanStart >= 0 &&
    typeof partial.spanEnd === "number"
      ? {
          quote: document.slice(partial.spanStart, partial.spanEnd) || String(partial.quote ?? ""),
          spanStart: partial.spanStart,
          spanEnd: partial.spanEnd,
          verified: partial.spanEnd > partial.spanStart,
          evidence: String(partial.evidence ?? ""),
        }
      : needle
        ? citeSpan(document, needle)
        : missingCite("no span to cite");
  if (cite.verified && !cite.evidence.startsWith("chars")) {
    cite.evidence = `chars ${cite.spanStart}-${cite.spanEnd}: "${cite.quote}"`;
  }
  return {
    key: partial.key || `field_${index}`,
    label: partial.label || partial.key || `Field ${index + 1}`,
    value,
    confidence,
    ...cite,
    needsHuman: confidence < 0.65 || !cite.verified,
  };
}
