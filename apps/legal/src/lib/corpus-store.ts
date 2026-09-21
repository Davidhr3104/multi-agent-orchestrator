import {
  autoSeedEnabled,
  buildCorpusQuery,
  chunkDocument,
  retrieveCorpusHits,
  type CorpusDocument,
  type CorpusHit,
  type StoredRfp,
} from "@helix/core";

type CorpusDesk = {
  docs: Map<string, CorpusDocument>;
  seeded: boolean;
};

function desk(): CorpusDesk {
  const g = globalThis as typeof globalThis & { __helixLegalCorpus?: CorpusDesk };
  if (!g.__helixLegalCorpus) {
    g.__helixLegalCorpus = { docs: new Map(), seeded: false };
  }
  return g.__helixLegalCorpus;
}

const SEED: Omit<CorpusDocument, "ingestedAt">[] = [
  {
    id: "corp-bear-playbook",
    title: "BEAR medical record abstraction — firm playbook",
    practiceArea: "clinical / PI",
    body: [
      "Helix Legal clinical practice delivers BEAR medical record abstraction for mass tort and personal injury dockets.",
      "Standard deliverables: clinical chart review, IME summarization, chronology build, and exhibit indexes for Texas PI files.",
      "Malpractice coverage $2M aggregate is required on injury clinic matters. Penalty language for late deliverables is flagged in partner review.",
      "Incumbent Harbor Review Group is frequently named; differentiate on BEAR sample packs and 48-hour turnaround on first 50 charts.",
      "Q&A deadlines and submission dates must be calendared at 7 / 3 / 1 day alerts before partner sign-off.",
    ].join(" "),
  },
  {
    id: "corp-spi-coding",
    title: "SPI workers' compensation coding capability statement",
    practiceArea: "SPI / clinical coding",
    body: [
      "SPI preferred engagements extract ICD codes and work-status statements from clinical notes for workers' compensation clinics.",
      "Five years of workers' compensation coding experience is the baseline; E&O insurance is required on Harbor Occupational Health style RFPs.",
      "Typical budget band $35,000–$55,000 for clinic-scale SPI coding. Price competitively but do not chase pure software vendor RFPs.",
      "Deliverables include coded encounter batches, audit samples, and weekly error-rate reports under 2%.",
    ].join(" "),
  },
  {
    id: "corp-no-bid-it",
    title: "No-bid rules — IT / SaaS / non-clinical",
    practiceArea: "intake policy",
    body: [
      "Firm no-bid policy: reject RFPs with no medical records, pure Kubernetes / SaaS catalog work, or Shopify-adjacent vendor portals.",
      "SOC2 Type II alone does not make an IT refresh a clinical matter. IP assignment to County or non-clinical CIO buyers are out of practice.",
      "When issuer is a county CIO or cloud incumbent (Nimbus Cloud), mark NO-GO and log capacity avoided in Outcomes.",
      "ISO 27001 preferred postings without clinical scope remain CONDITIONAL until body clarifies medical document work.",
    ].join(" "),
  },
  {
    id: "corp-clinical-nlp",
    title: "Clinical NLP / thin RFP intake checklist",
    practiceArea: "clinical NLP",
    body: [
      "Thin clinical NLP postings often omit method, budget, and timeline. Require clarification before GO.",
      "Ask for: document types (charts, IME, bills), jurisdiction, PHI handling, and whether BEAR or SPI is expected.",
      "ISO 27001 is preferred but not sufficient without a medical records scope. Flag CONDITIONAL and hold bid amount unspecified until Q&A.",
    ].join(" "),
  },
];

function seedCorpus() {
  const d = desk();
  if (d.seeded) return;
  d.seeded = true;
  if (!autoSeedEnabled()) return;
  const now = new Date().toISOString();
  for (const doc of SEED) {
    d.docs.set(doc.id, { ...doc, ingestedAt: now });
  }
}

export function listCorpusDocs(): CorpusDocument[] {
  seedCorpus();
  return [...desk().docs.values()].sort((a, b) => b.ingestedAt.localeCompare(a.ingestedAt));
}

export function ingestCorpusDoc(input: {
  title: string;
  body: string;
  practiceArea?: string;
}): CorpusDocument | { error: string } {
  seedCorpus();
  const title = input.title.trim();
  const body = input.body.trim();
  if (title.length < 4) return { error: "title too short" };
  if (body.length < 40) return { error: "body too short (need ≥ 40 chars)" };
  const id = `corp-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
  const doc: CorpusDocument = {
    id,
    title,
    body,
    practiceArea: input.practiceArea?.trim() || undefined,
    ingestedAt: new Date().toISOString(),
  };
  desk().docs.set(id, doc);
  return doc;
}

export function allCorpusChunks() {
  seedCorpus();
  return listCorpusDocs().flatMap((doc) => chunkDocument(doc));
}

export function queryFirmCorpus(rfp: StoredRfp, limit = 5): CorpusHit[] {
  const query = buildCorpusQuery({
    title: rfp.title,
    body: rfp.body,
    method: rfp.method,
    amount: rfp.amount,
  });
  return retrieveCorpusHits(query, allCorpusChunks(), limit);
}

export function corpusStats() {
  const docs = listCorpusDocs();
  const chunks = allCorpusChunks();
  return { docCount: docs.length, chunkCount: chunks.length, docs };
}
