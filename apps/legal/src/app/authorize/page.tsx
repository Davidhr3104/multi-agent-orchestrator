"use client";

import { useEffect, useState } from "react";
import type { StoredRfp } from "@helix/core";
import { CoiMatrixModal } from "@/components/coi-matrix-modal";
import type { ConflictReport } from "@/lib/conflict-types";

export default function AuthorizePage() {
  const [rfp, setRfp] = useState<StoredRfp | null>(null);
  const [report, setReport] = useState<ConflictReport | undefined>(undefined);
  const [token, setToken] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const id = params.get("coi");
    const linkToken = params.get("token");
    setToken(linkToken);
    if (!id || !linkToken) {
      setMissing(true);
      return;
    }
    void fetch("/api/rfps")
      .then((r) => r.json())
      .then((data: { rfps?: StoredRfp[]; conflicts?: Record<string, ConflictReport> }) => {
        const found = (data.rfps ?? []).find((item) => item.id === id) ?? null;
        setRfp(found);
        setReport(data.conflicts?.[id]);
        if (!found) setMissing(true);
      })
      .catch(() => setMissing(true));
  }, []);

  return (
    <main className="min-h-screen bg-[#0B0F19] p-6 text-[#F3F4F6]">
      <p className="text-[11px] tracking-widest text-[#9CA3AF] uppercase">Helix for Legal · partner decision</p>
      <h1 className="mt-2 text-xl font-semibold">Authorize or block this RFP</h1>
      <p className="mt-2 max-w-xl text-sm text-[#9CA3AF]">
        This page is only the conflict decision. TLS 1.3 protects the connection. The signature stored on the audit log is a desk hash, not a qualified electronic signature.
      </p>
      {done ? <p className="mt-6 text-sm text-[#6EE7B7]">{done}</p> : null}
      {missing ? <p className="mt-6 text-sm text-[#FCA5A5]">This magic link is missing an RFP or has expired from the desk.</p> : null}
      {rfp && !done ? (
        <CoiMatrixModal
          rfp={rfp}
          report={report}
          magicToken={token}
          onClose={() => setDone("Closed without a new decision.")}
          onDecide={(status) => setDone(status === "CLEAR" ? "Pursuit authorized and written to the audit log." : status === "BLOCKED" ? "RFP blocked and written to the audit log." : "Review recorded.")}
        />
      ) : null}
    </main>
  );
}
