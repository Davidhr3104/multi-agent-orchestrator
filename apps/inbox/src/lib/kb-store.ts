import { readFileSync, readdirSync } from "fs";
import { join } from "path";
import {
  chunkDocument,
  retrieveCorpusHits,
  buildCorpusQuery,
  type CorpusDocument,
  type CorpusChunk,
  type CorpusHit,
} from "@helix/core";

const KB_DIR = join(process.cwd(), "kb");

let cachedChunks: CorpusChunk[] | null = null;

function loadKbDocuments(): CorpusDocument[] {
  const files = readdirSync(KB_DIR).filter((f) => f.endsWith(".md"));
  return files.map((file) => {
    const body = readFileSync(join(KB_DIR, file), "utf-8");
    const title = body.match(/^#\s+(.+)$/m)?.[1] ?? file;
    return { id: file, title, body, ingestedAt: new Date().toISOString() };
  });
}

function allKbChunks(): CorpusChunk[] {
  if (cachedChunks) return cachedChunks;
  // I3: the kb/ directory can be missing or unreadable (not deployed,
  // Next.js file-tracing didn't bundle it, permissions, etc.) — that must
  // degrade to "no citations", never break ingestion/classification. Per
  // the repo-wide rule in CLAUDE.md: "Missing or failed → heuristic
  // fallback, never a blank screen."
  try {
    cachedChunks = loadKbDocuments().flatMap((doc) => chunkDocument(doc));
  } catch (err) {
    console.warn("[helix-inbox] KB unavailable:", err);
    cachedChunks = [];
  }
  return cachedChunks;
}

export function queryInboxKb(input: { subject: string; body: string }, limit = 5): CorpusHit[] {
  const query = buildCorpusQuery({ title: input.subject, body: input.body });
  return retrieveCorpusHits(query, allKbChunks(), limit);
}
