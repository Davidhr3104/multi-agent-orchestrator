"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import type { StoredRfp } from "@helix/core";
import { complianceGaps } from "@/lib/rfp-intel";

type OfficeDocument = {
  setSelectedDataAsync: (text: string, callback: (result: { status: string }) => void) => void;
};

function officeDocument(): OfficeDocument | null {
  const office = (window as unknown as { Office?: { context?: { document?: OfficeDocument } } }).Office;
  return office?.context?.document ?? null;
}

const REDLINES: { test: RegExp; suggestion: string }[] = [
  { test: /indemnif|liquidated damages|penalt/i, suggestion: "Cap indemnity at fees paid in the prior 12 months and exclude consequential damages." },
  { test: /insur|e&o|malpractice/i, suggestion: "State the firm's current E&O limit and make acceptance subject to confirmation." },
  { test: /ip ownership|work for hire|assign all rights/i, suggestion: "Keep pre-existing tools with the firm and license them for this matter." },
  { test: /iso\s*27001|soc\s*2/i, suggestion: "Do not claim a certification the firm does not hold. Offer the controls that are in place." },
];

function WordTaskPane() {
  const params = useSearchParams();
  const [rfps, setRfps] = useState<StoredRfp[]>([]);
  const [id, setId] = useState(params.get("rfp") ?? "");
  const [note, setNote] = useState<string | null>(null);
  const [inWord, setInWord] = useState(false);

  useEffect(() => {
    void fetch("/api/rfps")
      .then((r) => r.json())
      .then((d: { rfps?: StoredRfp[] }) => {
        const rows = d.rfps ?? [];
        setRfps(rows);
        setId((current) => current || rows[0]?.id || "");
      });
    const office = (window as unknown as { Office?: { onReady?: (cb: () => void) => void } }).Office;
    office?.onReady?.(() => setInWord(true));
  }, []);

  const rfp = rfps.find((row) => row.id === id) ?? null;
  const suggestions = useMemo(() => {
    if (!rfp) return [];
    const text = `${rfp.title}\n${rfp.body}`;
    const fromGaps = complianceGaps(rfp).map((gap) => ({
      label: gap.label,
      suggestion: gap.detail,
    }));
    const extra = REDLINES.filter((rule) => rule.test.test(text)).map((rule) => ({
      label: "Clause",
      suggestion: rule.suggestion,
    }));
    return [...fromGaps, ...extra];
  }, [rfp]);

  async function insert(text: string) {
    const doc = officeDocument();
    if (!doc) {
      try {
        await navigator.clipboard.writeText(text);
        setNote("Copied. Word is not hosting this page, so nothing was inserted into a document.");
      } catch {
        setNote(text);
      }
      return;
    }
    doc.setSelectedDataAsync(text, (result) => {
      setNote(result.status === "succeeded" ? "Inserted at the cursor." : "Word did not accept the insert.");
    });
  }

  return (
    <main className="min-h-screen space-y-4 bg-[#0a1322] p-4 text-[#E5E7EB]">
      <div>
        <p className="text-[10px] font-semibold tracking-widest text-[#9CA3AF] uppercase">Helix for Legal</p>
        <h1 className="mt-1 text-lg font-semibold">Word task pane</h1>
        <p className="mt-1 text-[12px] text-[#9CA3AF]">
          {inWord
            ? "Connected to the open document. Insert writes at the cursor."
            : "Browser preview. Sideload public/word/manifest.xml in Word on HTTPS to insert into the document. This build does not ship in the Office Store."}
        </p>
      </div>
      <label className="block text-[11px] text-[#9CA3AF]">
        RFP
        <select className="mt-1 h-8 w-full rounded border border-[#1b2a45] bg-[#0f1b30] px-2 text-[12px]" value={id} onChange={(e) => setId(e.target.value)}>
          {rfps.map((row) => (
            <option key={row.id} value={row.id}>
              {row.title}
            </option>
          ))}
        </select>
      </label>
      {rfp ? (
        <button
          type="button"
          className="rounded bg-white px-3 py-1.5 text-[11px] font-semibold text-[#090b10]"
          onClick={() =>
            void insert(
              `${rfp.title}\nIssuer: ${rfp.issuer}\nAmount: ${rfp.amount}\nDeadline: ${rfp.deadline}\nMatch: ${rfp.matchScore}`
            )
          }
        >
          Insert extracted fields
        </button>
      ) : null}
      <section className="space-y-2">
        <h2 className="text-[13px] font-semibold">Risk redlines</h2>
        {suggestions.length === 0 ? (
          <p className="text-[12px] text-[#9CA3AF]">No flagged clauses on this RFP.</p>
        ) : (
          suggestions.map((item) => (
            <div key={item.suggestion} className="rounded border border-[#1b2a45] bg-[#0f1b30] p-3">
              <p className="text-[10px] text-[#FCD34D]">{item.label}</p>
              <p className="mt-1 text-[12px]">{item.suggestion}</p>
              <button type="button" className="mt-2 text-[11px] underline" onClick={() => void insert(item.suggestion)}>
                Insert suggestion
              </button>
            </div>
          ))
        )}
      </section>
      {note ? <p className="text-[11px] text-[#FCD34D]">{note}</p> : null}
    </main>
  );
}

/** useSearchParams() needs a Suspense boundary so the page can still be prerendered. */
export default function WordPage() {
  return (
    <Suspense fallback={null}>
      <WordTaskPane />
    </Suspense>
  );
}
