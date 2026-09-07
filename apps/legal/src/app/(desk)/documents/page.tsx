"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { StoredRfp } from "@helix/core";
import { downloadProposalDoc, similarRfp } from "@/lib/rfp-intel";
import { cn } from "@/lib/utils";

function downloadSource(rfp: StoredRfp) {
  const blob = new Blob([rfp.body], { type: "text/plain;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `${rfp.id}-source.txt`;
  a.click();
  URL.revokeObjectURL(a.href);
}

export default function DocumentsPage() {
  const [rfps, setRfps] = useState<StoredRfp[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);

  useEffect(() => {
    void fetch("/api/rfps")
      .then((r) => r.json())
      .then((d: { rfps?: StoredRfp[] }) => setRfps(d.rfps ?? []));
  }, []);

  const open = useMemo(() => rfps.find((r) => r.id === openId) ?? rfps[0] ?? null, [rfps, openId]);
  const corpus = rfps.filter((r) => r.corpusStatus === "mocked").length;
  const review = rfps.filter((r) => r.needsReview).length;

  return (
    <main className="mx-auto w-full max-w-[1720px] flex-1 space-y-4 p-5">
      <div className="animate-entrance stagger-1 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[18px] font-semibold text-[#F3F4F6]">Documents</h1>
          <p className="mt-1 text-[12px] text-[#6B7280]">
            Ingested RFP source and generated proposal drafts on this desk.
          </p>
        </div>
        <Link
          href="/#legal-documents"
          className="btn-tactile rounded-[4px] bg-[#F59E0B] px-3 py-1.5 text-[11px] font-semibold text-[#0B0F19] hover:bg-[#D97706]"
        >
          Ingest a PDF
        </Link>
      </div>

      <section className="animate-entrance stagger-2 grid gap-4 sm:grid-cols-3">
        {(
          [
            ["SOURCE RFPS", rfps.length, "text-[#F3F4F6]"],
            ["CORPUS PULLED", corpus, "text-[#F59E0B]"],
            ["NEEDS REVIEW", review, "text-[#FCA5A5]"],
          ] as const
        ).map(([label, value, color]) => (
          <div key={label} className="rounded-[6px] border border-[#1F2937] bg-[#111827] p-4 shadow-subtle">
            <p className="text-[10px] font-semibold tracking-wide text-[#9CA3AF] uppercase">{label}</p>
            <p className={cn("font-mono-numbers mt-2 text-[28px] leading-none font-bold", color)}>{value}</p>
          </div>
        ))}
      </section>

      <div className="animate-entrance stagger-3 grid gap-4 lg:grid-cols-5">
        <section className="overflow-hidden rounded-[6px] border border-[#1F2937] bg-[#111827] shadow-subtle lg:col-span-2">
          <div className="border-b border-[#1F2937] px-4 py-3">
            <h2 className="text-[13px] font-semibold text-[#F3F4F6]">Vault</h2>
          </div>
          {rfps.length === 0 ? (
            <div className="space-y-3 px-4 py-8 text-center">
              <p className="text-[12px] text-[#9CA3AF]">No documents yet.</p>
              <p className="text-[11px] text-[#6B7280]">Drop an RFP PDF on the dashboard to start the vault.</p>
              <Link
                href="/#legal-documents"
                className="btn-tactile inline-flex rounded-[4px] border border-[#F59E0B] px-3 py-1.5 text-[11px] font-semibold text-[#F59E0B] hover:bg-[#F59E0B] hover:text-[#0B0F19]"
              >
                Go to ingest →
              </Link>
            </div>
          ) : (
            <ul className="divide-y divide-[#1F2937]">
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
                        {rfp.issuer} · {rfp.method} · {rfp.body.length.toLocaleString()} chars
                      </p>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section className="rounded-[6px] border border-[#1F2937] bg-[#111827] p-4 shadow-subtle lg:col-span-3">
          {open ? (
            <div className="space-y-3">
              <div>
                <h3 className="text-[14px] font-semibold text-[#F3F4F6]">{open.title}</h3>
                <p className="mt-1 text-[11px] text-[#6B7280]">
                  {open.issuer} · ingested {new Date(open.createdAt).toISOString().slice(0, 10)}
                </p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <span className="rounded-[3px] bg-[#1F2937] px-1.5 py-0.5 font-mono-numbers text-[9px] text-[#9CA3AF]">
                    {open.method}
                  </span>
                  <span className="rounded-[3px] bg-[#1F2937] px-1.5 py-0.5 text-[9px] text-[#9CA3AF]">
                    corpus {open.corpusStatus}
                  </span>
                  {open.needsReview ? (
                    <span className="rounded-[3px] bg-[#7F1D1D] px-1.5 py-0.5 text-[9px] font-medium text-[#FCA5A5]">
                      Needs review
                    </span>
                  ) : null}
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className="btn-tactile rounded-[4px] border border-[#374151] bg-[#1F2937] px-2.5 py-1 text-[11px] text-[#9CA3AF] hover:text-[#F3F4F6]"
                  onClick={() => downloadSource(open)}
                >
                  Download source .txt
                </button>
                <button
                  type="button"
                  className="btn-tactile rounded-[4px] bg-[#F59E0B] px-2.5 py-1 text-[11px] font-semibold text-[#0B0F19] hover:bg-[#D97706]"
                  onClick={() => downloadProposalDoc(open, open.clientProfile, similarRfp(open, rfps))}
                >
                  Download proposal .doc
                </button>
              </div>
              <pre className="max-h-72 overflow-y-auto rounded-[4px] border border-[#1F2937] bg-[#0B0F19] p-3 text-[11px] leading-relaxed whitespace-pre-wrap text-[#9CA3AF]">
                {open.body}
              </pre>
            </div>
          ) : (
            <div className="flex h-48 flex-col items-center justify-center gap-2 text-center">
              <p className="text-[12px] text-[#9CA3AF]">Select a document from the vault.</p>
              <p className="text-[11px] text-[#6B7280]">Source text and proposal export appear here.</p>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
