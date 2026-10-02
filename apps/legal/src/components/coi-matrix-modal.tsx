"use client";

import { useMemo, useState } from "react";
import type { StoredRfp } from "@helix/core";
import type { ConflictHit, ConflictReport } from "@/lib/conflict-types";
import { assignTeam } from "@/lib/rfp-intel";
import { modelForMethod, traceSuffix } from "@/lib/audit-trace";
import { cn } from "@/lib/utils";

export type CoiDeskStatus = "CLEAR" | "REVIEW" | "BLOCKED";

export function coiStatusFromVerdict(verdict: ConflictReport["verdict"] | undefined): CoiDeskStatus {
  if (verdict === "NO-GO") return "BLOCKED";
  if (verdict === "CONDITIONAL") return "REVIEW";
  return "CLEAR";
}

type Row = { lane: string; party: string; detail: string; tone: "clear" | "review" | "blocked" };

function toneOf(hit: ConflictHit): Row["tone"] {
  if (hit.severity === "red") return "blocked";
  if (hit.severity === "amber") return "review";
  return "clear";
}

function buildRows(rfp: StoredRfp, report: ConflictReport | undefined): Row[] {
  const team = assignTeam(rfp);
  const rows: Row[] = [
    {
      lane: "Directors",
      party: team.attorney,
      detail: `${team.role} on this pursuit · ${team.reason}`,
      tone: "clear",
    },
  ];
  const hits = report?.hits ?? [];
  const lanes: { lane: string; test: (hit: ConflictHit) => boolean }[] = [
    { lane: "Affiliates", test: (h) => h.relation === "related_entity" },
    { lane: "Active clients", test: (h) => h.against === "current_client" || h.against === "former_client" },
    {
      lane: "Adverse history",
      test: (h) => h.relation === "opposing_party" || h.against === "active_matter_adverse" || h.against === "closed_matter",
    },
  ];
  for (const lane of lanes) {
    const matched = hits.filter(lane.test);
    if (matched.length === 0) {
      rows.push({ lane: lane.lane, party: "—", detail: "No cross-match in the firm book.", tone: "clear" });
      continue;
    }
    for (const hit of matched) {
      rows.push({ lane: lane.lane, party: hit.matchedName, detail: hit.detail, tone: toneOf(hit) });
    }
  }
  return rows;
}

export function CoiMatrixModal({
  rfp,
  report,
  magicToken,
  onClose,
  onDecide,
}: {
  rfp: StoredRfp;
  report: ConflictReport | undefined;
  magicToken: string | null;
  onClose: () => void;
  onDecide: (status: CoiDeskStatus) => void;
}) {
  const rows = useMemo(() => buildRows(rfp, report), [rfp, report]);
  const [partner, setPartner] = useState(assignTeam(rfp).attorney);
  const [email, setEmail] = useState("");
  const [reason, setReason] = useState("");
  const [linkNote, setLinkNote] = useState<string | null>(magicToken ? "Magic link opened. Sign to record the decision." : null);
  const [busy, setBusy] = useState(false);

  async function writeAudit(action: string, status: CoiDeskStatus) {
    const signature = btoa(`${partner}|${rfp.id}|${status}|${new Date().toISOString()}`).slice(0, 24);
    const detail = [
      `${rfp.title}: ${action} by ${partner}${reason.trim() ? ` — ${reason.trim()}` : ""} · signature ${signature}`,
      traceSuffix({
        model: modelForMethod(rfp.method),
        prompt: "coi-matrix-v1",
        match: report ? `${report.score} (${report.verdict})` : "not run",
        approval: `${status} · ${magicToken ? "magic-link" : "desk-sign"}`,
      }),
    ].join("\n");
    await fetch("/api/audit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ actor: partner, action: "coi", detail }),
    });
  }

  async function decide(status: CoiDeskStatus, action: string) {
    setBusy(true);
    try {
      await writeAudit(action, status);
      onDecide(status);
      onClose();
    } finally {
      setBusy(false);
    }
  }

  async function issueLink() {
    const token = Math.random().toString(36).slice(2, 10);
    const url = `${window.location.origin}/?coi=${encodeURIComponent(rfp.id)}&token=${token}`;
    const body = `Open this link to authorize or block ${rfp.title}. It opens the conflict matrix. The signature is a desk hash, not a qualified electronic signature.\n\n${url}`;
    if (email.includes("@")) {
      window.location.href = `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(`Helix COI — ${rfp.title}`)}&body=${encodeURIComponent(body)}`;
      setLinkNote("Your mail app opens with the link. Helix does not send the message, and it does not send SMS.");
    } else {
      try {
        await navigator.clipboard.writeText(url);
        setLinkNote("Add a partner email to draft the message. The link is copied.");
      } catch {
        setLinkNote(url);
      }
    }
    await writeAudit("magic link issued", "REVIEW");
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" role="dialog" aria-modal="true" aria-label="Conflict matrix">
      <div className="max-h-[90vh] w-full max-w-3xl overflow-auto rounded-xl border border-[#1F2937] bg-[#111827] p-5 shadow-subtle">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-semibold tracking-widest text-[#9CA3AF] uppercase">Conflict of interest</p>
            <h2 className="mt-1 text-[16px] font-semibold text-[#F3F4F6]">{rfp.title}</h2>
            <p className="mt-1 text-[12px] text-[#9CA3AF]">{report?.why ?? "No COI report stored yet. The matrix still lists the responsible partner."}</p>
          </div>
          <button type="button" className="text-[12px] text-[#9CA3AF] hover:text-white" onClick={onClose}>
            Close
          </button>
        </div>
        <table className="mt-4 w-full border-collapse text-left text-[12px]">
          <thead>
            <tr className="border-b border-[#1F2937] text-[10px] tracking-wide text-[#6B7280] uppercase">
              <th className="py-2 pr-3">Lane</th>
              <th className="py-2 pr-3">Party</th>
              <th className="py-2">Finding</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={`${row.lane}-${row.party}-${i}`} className="border-b border-[#1F2937]/80">
                <td className="py-2 pr-3 text-[#9CA3AF]">{row.lane}</td>
                <td className="py-2 pr-3 font-medium text-[#F3F4F6]">{row.party}</td>
                <td className="py-2">
                  <span
                    className={cn(
                      "mr-2 rounded px-1.5 py-0.5 text-[9px] font-semibold",
                      row.tone === "blocked" && "bg-[#7F1D1D] text-[#FCA5A5]",
                      row.tone === "review" && "bg-[#422006] text-[#FCD34D]",
                      row.tone === "clear" && "bg-[#064E3B] text-[#6EE7B7]"
                    )}
                  >
                    {row.tone === "blocked" ? "BLOCKED" : row.tone === "review" ? "REVIEW" : "CLEAR"}
                  </span>
                  <span className="text-[#9CA3AF]">{row.detail}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="mt-4 grid gap-2 sm:grid-cols-3">
          <label className="text-[11px] text-[#9CA3AF]">
            Partner
            <input
              className="mt-1 h-8 w-full rounded border border-[#1F2937] bg-[#0B0F19] px-2 text-[12px] text-[#F3F4F6]"
              value={partner}
              onChange={(e) => setPartner(e.target.value)}
            />
          </label>
          <label className="text-[11px] text-[#9CA3AF]">
            Partner email
            <input
              type="email"
              className="mt-1 h-8 w-full rounded border border-[#1F2937] bg-[#0B0F19] px-2 text-[12px] text-[#F3F4F6]"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="partner@firm.com"
            />
          </label>
          <label className="text-[11px] text-[#9CA3AF]">
            Why
            <input
              className="mt-1 h-8 w-full rounded border border-[#1F2937] bg-[#0B0F19] px-2 text-[12px] text-[#F3F4F6]"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Required for the audit trail"
            />
          </label>
        </div>
        {linkNote ? <p className="mt-2 text-[11px] text-[#FCD34D]">{linkNote}</p> : null}
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={busy || !partner.trim()}
            className="rounded bg-[#064E3B] px-3 py-1.5 text-[11px] font-semibold text-[#6EE7B7] disabled:opacity-40"
            onClick={() => void decide("CLEAR", "authorized")}
          >
            Authorize pursuit
          </button>
          <button
            type="button"
            disabled={busy || !partner.trim()}
            className="rounded bg-[#7F1D1D] px-3 py-1.5 text-[11px] font-semibold text-[#FCA5A5] disabled:opacity-40"
            onClick={() => void decide("BLOCKED", "blocked")}
          >
            Block RFP
          </button>
          <button
            type="button"
            disabled={busy || !email.includes("@")}
            className="rounded border border-[#374151] px-3 py-1.5 text-[11px] text-[#F3F4F6] disabled:opacity-40"
            onClick={() => {
              const token = Math.random().toString(36).slice(2, 10);
              const url = `${window.location.origin}/authorize?coi=${encodeURIComponent(rfp.id)}&token=${token}`;
              const href = `mailto:${email}?subject=${encodeURIComponent(`Helix COI — ${rfp.title}`)}&body=${encodeURIComponent(`Open this link to authorize or block. You do not need the rest of the desk.\n\n${url}`)}`;
              window.location.href = href;
              setLinkNote("Your mail app opened with the magic link. Helix does not send the message itself.");
              void writeAudit("magic link mailed via the operator's mail app", "REVIEW");
            }}
          >
            Email magic link
          </button>
          <button
            type="button"
            disabled={busy}
            className="rounded border border-[#374151] px-3 py-1.5 text-[11px] text-[#F3F4F6]"
            onClick={() => void issueLink()}
          >
            Copy magic link
          </button>
        </div>
        <p className="mt-3 text-[10px] text-[#6B7280]">
          The signature is a desk hash stored on the audit log. It is not a qualified electronic signature.
        </p>
      </div>
    </div>
  );
}
