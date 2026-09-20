import { describe, expect, it } from "vitest";
import {
  buildCorpusQuery,
  chunkDocument,
  retrieveCorpusHits,
  type CorpusDocument,
} from "./corpus";

const DOC: CorpusDocument = {
  id: "doc-bear",
  title: "BEAR chart review playbook",
  body: [
    "Helix Legal clinical practice: BEAR medical record abstraction for mass tort and personal injury.",
    "We summarize IME reports, extract ICD codes, and produce chronologies for Texas PI dockets.",
    "Malpractice coverage $2M aggregate is standard on injury clinic matters.",
    "SPI coding for workers compensation uses ICD and work-status extraction from clinical notes.",
  ].join(" "),
  ingestedAt: "2026-09-01T00:00:00.000Z",
};

describe("legal corpus retrieve", () => {
  it("chunks and returns verified cites for BEAR query", () => {
    const chunks = chunkDocument(DOC);
    expect(chunks.length).toBeGreaterThan(0);
    const hits = retrieveCorpusHits(
      buildCorpusQuery({
        title: "Medical record abstraction — mass tort",
        method: "BEAR",
        body: "Need clinical chart review and IME summarization for personal injury files in Texas.",
      }),
      chunks,
      3
    );
    expect(hits.length).toBeGreaterThan(0);
    expect(hits[0].docTitle).toContain("BEAR");
    expect(hits[0].verified).toBe(true);
    expect(hits[0].quote.length).toBeGreaterThan(0);
  });

  it("returns empty when corpus has no overlap", () => {
    const chunks = chunkDocument(DOC);
    const hits = retrieveCorpusHits("kubernetes shopify saas catalog sync", chunks, 3);
    expect(hits.length).toBe(0);
  });
});
