import type { CorpusHit } from "../types";
import { citeSpan } from "../fact";

export type CorpusChunk = {
  id: string;
  docId: string;
  docTitle: string;
  text: string;
  /** Offset of this chunk inside the source document. */
  offset: number;
};

export type CorpusDocument = {
  id: string;
  title: string;
  body: string;
  practiceArea?: string;
  ingestedAt: string;
};

const STOP = new Set([
  "the",
  "and",
  "for",
  "with",
  "that",
  "this",
  "from",
  "into",
  "your",
  "our",
  "are",
  "was",
  "were",
  "have",
  "has",
  "will",
  "shall",
  "not",
  "any",
  "all",
  "per",
  "via",
  "a",
  "an",
  "of",
  "to",
  "in",
  "on",
  "or",
  "by",
  "as",
  "is",
  "be",
  "at",
  "it",
]);

export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9$]+/)
    .filter((t) => t.length > 2 && !STOP.has(t) && !/^\d+$/.test(t));
}

/** Split a document into overlapping character windows for retrieval. */
export function chunkDocument(
  doc: CorpusDocument,
  size = 700,
  overlap = 120
): CorpusChunk[] {
  const body = doc.body.trim();
  if (!body) return [];
  const chunks: CorpusChunk[] = [];
  let offset = 0;
  let i = 0;
  while (offset < body.length) {
    const end = Math.min(body.length, offset + size);
    const text = body.slice(offset, end);
    chunks.push({
      id: `${doc.id}-c${i}`,
      docId: doc.id,
      docTitle: doc.title,
      text,
      offset,
    });
    if (end >= body.length) break;
    offset = Math.max(offset + 1, end - overlap);
    i += 1;
  }
  return chunks;
}

function scoreChunk(tokens: string[], chunkText: string): number {
  if (!tokens.length) return 0;
  const lower = chunkText.toLowerCase();
  let hits = 0;
  let unique = 0;
  const seen = new Set<string>();
  for (const t of tokens) {
    const re = new RegExp(`\\b${escapeReg(t)}\\b`, "gi");
    const count = (lower.match(re) ?? []).length;
    if (count > 0) {
      hits += count;
      if (!seen.has(t)) {
        unique += 1;
        seen.add(t);
      }
    }
  }
  return unique * 2 + hits * 0.35 + (unique / tokens.length) * 3;
}

function escapeReg(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function pickQuote(chunk: CorpusChunk, queryTokens: string[]): CorpusHit {
  const lower = chunk.text.toLowerCase();
  const candidates = [...queryTokens]
    .filter((t) => t.length >= 4 && !/^\d+$/.test(t))
    .sort((a, b) => b.length - a.length);
  let needle = candidates.find((t) => lower.includes(t)) ?? "";
  if (!needle) {
    // Prefer a clause that contains any query token
    const sentences = chunk.text.split(/(?<=[.:;])\s+/);
    const hitSentence = sentences.find((s) =>
      queryTokens.some((t) => t.length >= 3 && s.toLowerCase().includes(t))
    );
    needle = (hitSentence ?? chunk.text).slice(0, Math.min(140, (hitSentence ?? chunk.text).length));
  } else {
    // Expand to surrounding phrase (~120 chars around token), snap to word edges
    const idx = lower.indexOf(needle);
    let start = Math.max(0, idx - 40);
    let end = Math.min(chunk.text.length, idx + needle.length + 80);
    while (start > 0 && /[A-Za-z0-9]/.test(chunk.text[start]!)) start -= 1;
    while (end < chunk.text.length && /[A-Za-z0-9]/.test(chunk.text[end - 1]!)) end += 1;
    needle = chunk.text.slice(start, end).trim();
  }
  const cite = citeSpan(chunk.text, needle.length > 160 ? needle.slice(0, 160) : needle);
  const excerpt =
    chunk.text.length > 280 ? `${chunk.text.slice(0, 277).trim()}…` : chunk.text.trim();
  return {
    docId: chunk.docId,
    docTitle: chunk.docTitle,
    chunkId: chunk.id,
    excerpt,
    quote: cite.quote || excerpt.slice(0, 160),
    spanStart: cite.verified ? chunk.offset + cite.spanStart : chunk.offset,
    spanEnd: cite.verified ? chunk.offset + cite.spanEnd : chunk.offset + excerpt.length,
    score: 0,
    verified: cite.verified,
  };
}

/** Keyword retrieve over firm chunks — RAG-lite without embeddings. */
export function retrieveCorpusHits(
  query: string,
  chunks: CorpusChunk[],
  limit = 5
): CorpusHit[] {
  const tokens = tokenize(query);
  if (!tokens.length || !chunks.length) return [];

  const ranked = chunks
    .map((chunk) => {
      const score = scoreChunk(tokens, chunk.text);
      if (score <= 0) return null;
      const hit = pickQuote(chunk, tokens);
      hit.score = Math.round(score * 100) / 100;
      return hit;
    })
    .filter((h): h is CorpusHit => h != null)
    .sort((a, b) => b.score - a.score);

  const seen = new Set<string>();
  const out: CorpusHit[] = [];
  for (const hit of ranked) {
    const key = `${hit.docId}:${hit.quote.slice(0, 40)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(hit);
    if (out.length >= limit) break;
  }
  return out;
}

export function buildCorpusQuery(input: {
  title: string;
  body: string;
  method?: string;
  amount?: string;
}): string {
  const head = input.body.slice(0, 1200);
  return [input.title, input.method, input.amount, head].filter(Boolean).join("\n");
}
