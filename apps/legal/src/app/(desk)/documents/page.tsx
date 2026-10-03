"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import type { CorpusDocument, StoredRfp } from "@helix/core";
import { ChartCard, EmptyChart, Gauge, HBarList } from "@helix/ui";
import { INK, Ink, KpiRow } from "@/components/desk-charts";
import { corpusCoverage, isDemoDesk, isoDay } from "@/lib/desk-metrics";
import { DocumentSplit } from "@/components/document-split";
import { complianceGaps, downloadProposalDoc, nearestDeadline, similarRfp } from "@/lib/rfp-intel";
import { cn } from "@/lib/utils";

function downloadSource(rfp: StoredRfp) {
  const blob = new Blob([rfp.body], { type: "text/plain;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `${rfp.id}-source.txt`;
  a.click();
  URL.revokeObjectURL(a.href);
}

function DocumentsPageInner() {
  const [rfps, setRfps] = useState<StoredRfp[]>([]);
  const [docs, setDocs] = useState<CorpusDocument[]>([]);
  const [chunkCount, setChunkCount] = useState(0);
  const [openId, setOpenId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [practiceArea, setPracticeArea] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [pinnedQuote, setPinnedQuote] = useState("");
  const searchParams = useSearchParams();
  const cite = searchParams.get("q");

  async function load() {
    const [rfpRes, corpRes] = await Promise.all([
      fetch("/api/rfps").then((r) => r.json()),
      fetch("/api/corpus").then((r) => r.json()),
    ]);
    setRfps((rfpRes as { rfps?: StoredRfp[] }).rfps ?? []);
    setDocs((corpRes as { docs?: CorpusDocument[] }).docs ?? []);
    setChunkCount(Number((corpRes as { chunkCount?: number }).chunkCount ?? 0));
  }

  useEffect(() => {
    void load();
    const params = new URLSearchParams(window.location.search);
    const id = params.get("rfp");
    const cite = params.get("cite");
    if (id) setOpenId(id);
    if (cite) setPinnedQuote(cite);
  }, []);

  useEffect(() => {
    const id = searchParams.get("rfp");
    if (id) setOpenId(id);
  }, [searchParams]);

  const open = useMemo(() => rfps.find((r) => r.id === openId) ?? rfps[0] ?? null, [rfps, openId]);
  const corpusLive = rfps.filter((r) => r.corpusStatus === "live").length;
  const review = rfps.filter((r) => r.needsReview).length;
  const coverage = corpusCoverage(rfps);

  async function ingestFirmDoc() {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/corpus", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, body, practiceArea }),
      });
      const data = (await res.json()) as { error?: string; doc?: CorpusDocument };
      if (!res.ok) {
        setMsg(data.error ?? "Ingest failed");
        return;
      }
      setTitle("");
      setBody("");
      setPracticeArea("");
      setMsg(`Ingested: ${data.doc?.title}`);
      await load();
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto w-full max-w-[1720px] flex-1 space-y-4 p-4 sm:p-5">
      <div className="animate-entrance stagger-1 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[18px] font-semibold text-[#F3F4F6]">Documents</h1>
          <p className="mt-1 text-[12px] text-[#6B7280]">
            RFP vault + firm corpus playbooks. Ask corpus pulls live cites — not a mock flag.
          </p>
        </div>
        <Link
          href="/#legal-documents"
          className="btn-tactile rounded-[4px] bg-[#F59E0B] px-3 py-1.5 text-[11px] font-semibold text-[#0a1322] hover:bg-[#D97706]"
        >
          Ingest an RFP PDF
        </Link>
      </div>

      <div className="animate-entrance stagger-2 space-y-4">
        <KpiRow
          items={[
            { label: "Source RFPs", value: rfps.length, hint: "In the vault" },
            { label: "Firm docs", value: docs.length, hint: docs.length ? `${chunkCount} chunks indexed` : "No playbooks added yet", accent: INK.conditional },
            {
              label: "Corpus lookups",
              value: corpusLive === 0 ? "None live" : `${corpusLive} of ${rfps.length}`,
              hint: corpusLive === 0 ? "No RFP has had a live firm-corpus lookup yet" : "RFPs with a live firm-corpus lookup",
              accent: INK.go,
            },
            { label: "Needs review", value: review, hint: review ? "Waiting on a partner" : "Nothing waiting", accent: INK.noGo },
          ]}
        />
        <Ink className="grid gap-4 lg:grid-cols-5">
          <div className="lg:col-span-2">
            <ChartCard
              title="Corpus coverage"
              subtitle="RFPs checked against the firm corpus"
              demo={isDemoDesk(rfps)}
              source="Source: corpus status per RFP (live lookup ran, or cites returned)."
            >
              {rfps.length === 0 ? (
                <EmptyChart label="No RFPs yet" />
              ) : (
                <div className="flex justify-center">
                  <Gauge value={coverage.pct} max={100} label="Covered by the corpus" caption={`${coverage.covered} of ${coverage.total} RFPs`} />
                </div>
              )}
            </ChartCard>
          </div>
          <div className="lg:col-span-3">
            <ChartCard
              title="Extraction confidence by field"
              subtitle={open ? open.title : "Select an RFP"}
              demo={isDemoDesk(rfps)}
              source="Source: the extractor's per-field confidence. Unverified fields are listed as human review."
            >
              {open && open.fields.length ? (
                <HBarList
                  format={(n) => `${n}%`}
                  items={open.fields.map((f) => ({
                    label: f.label,
                    value: Math.round(f.confidence <= 1 ? f.confidence * 100 : f.confidence),
                    color: f.verified ? INK.go : INK.conditional,
                    hint: f.verified ? "verified" : "needs review",
                  }))}
                />
              ) : (
                <EmptyChart label="No extracted fields for this RFP" />
              )}
            </ChartCard>
          </div>
        </Ink>
      </div>

      <section className="animate-entrance stagger-3 rounded-[6px] border border-[#1b2a45] bg-[#0f1b30] p-4 shadow-subtle">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className="text-[13px] font-semibold text-[#F3F4F6]">Firm corpus</h2>
            <p className="mt-1 text-[11px] text-[#6B7280]">
              {docs.length} playbook{docs.length === 1 ? "" : "s"} · {chunkCount} chunks indexed (keyword RAG-lite)
            </p>
          </div>
        </div>
        {msg ? <p className="mt-2 text-[11px] text-[#F59E0B]">{msg}</p> : null}
        <div className="mt-3 grid gap-3 lg:grid-cols-2">
          <ul className="max-h-48 space-y-2 overflow-y-auto">
            {docs.map((doc) => (
              <li key={doc.id} className="rounded-[4px] border border-[#1b2a45] bg-[#0a1322] px-3 py-2">
                <p className="text-[12px] font-medium text-[#F3F4F6]">{doc.title}</p>
                <p className="mt-0.5 text-[10px] text-[#6B7280]">
                  {doc.practiceArea ?? "general"} · {doc.body.length.toLocaleString()} chars
                </p>
              </li>
            ))}
          </ul>
          <div className="space-y-2">
            <input
              className="h-8 w-full rounded-[4px] border border-[#1b2a45] bg-[#0a1322] px-2 text-[11px] text-[#F3F4F6]"
              placeholder="Playbook title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
            <input
              className="h-8 w-full rounded-[4px] border border-[#1b2a45] bg-[#0a1322] px-2 text-[11px] text-[#F3F4F6]"
              placeholder="Practice area (optional)"
              value={practiceArea}
              onChange={(e) => setPracticeArea(e.target.value)}
            />
            <textarea
              className="min-h-[88px] w-full rounded-[4px] border border-[#1b2a45] bg-[#0a1322] px-2 py-1.5 text-[11px] text-[#F3F4F6]"
              placeholder="Paste firm playbook / capability statement (≥ 40 chars)"
              value={body}
              onChange={(e) => setBody(e.target.value)}
            />
            <button
              type="button"
              disabled={busy}
              onClick={() => void ingestFirmDoc()}
              className="btn-tactile rounded-[4px] bg-[#F59E0B] px-3 py-1.5 text-[11px] font-semibold text-[#0a1322] hover:bg-[#D97706] disabled:opacity-40"
            >
              {busy ? "Ingesting…" : "Add to firm corpus"}
            </button>
          </div>
        </div>
      </section>

      <div className="animate-entrance stagger-4 grid gap-4 lg:grid-cols-5">
        <section className="overflow-hidden rounded-[6px] border border-[#1b2a45] bg-[#0f1b30] shadow-subtle lg:col-span-2">
          <div className="border-b border-[#1b2a45] px-4 py-3">
            <h2 className="text-[13px] font-semibold text-[#F3F4F6]">RFP vault</h2>
          </div>
          {rfps.length === 0 ? (
            <div className="space-y-3 px-4 py-8 text-center">
              <p className="text-[12px] text-[#9CA3AF]">No documents yet.</p>
              <p className="text-[11px] text-[#6B7280]">Drop an RFP PDF on the dashboard to start the vault.</p>
              <Link
                href="/#legal-documents"
                className="btn-tactile inline-flex rounded-[4px] border border-[#F59E0B] px-3 py-1.5 text-[11px] font-semibold text-[#F59E0B] hover:bg-[#F59E0B] hover:text-[#0a1322]"
              >
                Go to ingest →
              </Link>
            </div>
          ) : (
            <ul className="divide-y divide-[#1b2a45]">
              {rfps.map((rfp) => {
                const on = open?.id === rfp.id;
                return (
                  <li key={rfp.id}>
                    <button
                      type="button"
                      className={cn(
                        "table-row-interactive w-full px-4 py-3 text-left",
                        on && "bg-[#162032]"
                      )}
                      onClick={() => setOpenId(rfp.id)}
                    >
                      <p className={cn("truncate text-[12px] font-semibold", on ? "text-[#F59E0B]" : "text-[#F3F4F6]")}>
                        {rfp.title}
                      </p>
                      <p className="mt-1 text-[10px] text-[#6B7280]">
                        {rfp.issuer} · {rfp.method} · corpus {rfp.corpusStatus}
                      </p>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section className="rounded-[6px] border border-[#1b2a45] bg-[#0f1b30] p-4 shadow-subtle lg:col-span-3">
          {open ? (
            <div className="space-y-3">
              <div>
                <h3 className="text-[14px] font-semibold text-[#F3F4F6]">{open.title}</h3>
                <p className="mt-1 text-[11px] text-[#6B7280]">
                  {open.issuer} · ingested {isoDay(Date.parse(open.createdAt))}
                </p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <span className="rounded-[3px] bg-[#1b2a45] px-1.5 py-0.5 font-mono-numbers text-[9px] text-[#9CA3AF]">
                    {open.method}
                  </span>
                  <span
                    className={cn(
                      "rounded-[3px] px-1.5 py-0.5 text-[9px]",
                      open.corpusStatus === "live"
                        ? "bg-[#064E3B]/40 text-[#6EE7B7]"
                        : open.corpusStatus === "unavailable"
                          ? "bg-[#7F1D1D]/30 text-[#FCA5A5]"
                          : "bg-[#1b2a45] text-[#9CA3AF]"
                    )}
                  >
                    corpus {open.corpusStatus}
                    {open.corpusHits?.length ? ` · ${open.corpusHits.length} cites` : ""}
                  </span>
                  {open.needsReview ? (
                    <span className="rounded-[3px] bg-[#7F1D1D] px-1.5 py-0.5 text-[9px] font-medium text-[#FCA5A5]">
                      Needs review
                    </span>
                  ) : null}
                </div>
              </div>
              {open.corpusHits && open.corpusHits.length > 0 ? (
                <ul className="space-y-2 rounded-[4px] border border-[#1b2a45] bg-[#0a1322] p-3">
                  {open.corpusHits.map((hit) => (
                    <li key={hit.chunkId} className="text-[11px]">
                      <p className="font-medium text-[#F3F4F6]">{hit.docTitle}</p>
                      <p className="mt-0.5 text-[#9CA3AF]">“{hit.quote}”</p>
                    </li>
                  ))}
                </ul>
              ) : null}
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className="btn-tactile rounded-[4px] border border-[#374151] bg-[#1b2a45] px-2.5 py-1 text-[11px] text-[#9CA3AF] hover:text-[#F3F4F6]"
                  onClick={() => downloadSource(open)}
                >
                  Download source .txt
                </button>
                <button
                  type="button"
                  className="btn-tactile rounded-[4px] bg-[#F59E0B] px-2.5 py-1 text-[11px] font-semibold text-[#0a1322] hover:bg-[#D97706]"
                  onClick={() => {
                    const peer = similarRfp(open, rfps);
                    downloadProposalDoc(open, open.clientProfile, peer);
                  }}
                >
                  Generate Proposal First Draft
                </button>
                <Link
                  href={`/word?rfp=${encodeURIComponent(open.id)}`}
                  className="btn-tactile rounded-[4px] border border-[#374151] px-2.5 py-1 text-[11px] text-[#E5E7EB]"
                >
                  Open Word task pane
                </Link>
              </div>
              <p className="text-[10px] text-[#6B7280]">Word-ready draft from the RFP and the firm profile. Edit it in Word. It is not a filed proposal.</p>
              <DocumentSplit
                title={open.title}
                body={open.body}
                initialQuote={pinnedQuote || cite}
                fields={[
                  {
                    id: "amount",
                    label: "Budget",
                    value: open.amount || "Not stated",
                    confidence: Math.round(open.confidence * 100),
                    quote: open.amount,
                    tone: "money",
                  },
                  {
                    id: "due",
                    label: "Deadline",
                    value: nearestDeadline(open, Date.now())?.date ?? open.deadline,
                    confidence: 74,
                    quote: nearestDeadline(open, Date.now())?.date ?? open.deadline,
                    tone: "rule",
                  },
                  {
                    id: "gaps",
                    label: "Compliance gaps",
                    value: complianceGaps(open).map((g) => g.label).join(", ") || "None flagged",
                    confidence: complianceGaps(open).length ? 68 : 80,
                    quote: open.body.match(/indemnif[^.\n]{0,80}|liquidated damages[^.\n]{0,60}|penalt[^.\n]{0,40}|iso\s*27001|soc\s*2/i)?.[0] ?? "",
                    tone: complianceGaps(open).some((g) => g.severity === "red") ? "penalty" : "rule",
                  },
                ]}
              />
            </div>
          ) : (
            <p className="py-12 text-center text-[12px] text-[#6B7280]">Select an RFP from the vault.</p>
          )}
        </section>
      </div>
    </main>
  );
}

/** useSearchParams() needs a Suspense boundary so the page can still be prerendered. */
export default function DocumentsPage() {
  return (
    <Suspense fallback={null}>
      <DocumentsPageInner />
    </Suspense>
  );
}
