"use client";

import { useState } from "react";
import type { HelixLead } from "@/lib/lead-ai";
import { cn } from "@/lib/utils";

type Props = {
  lead: HelixLead;
  onLeadUpdate: (lead: HelixLead) => void;
};

/** Render with `key={aiTriagePanelKey(lead)}` so the editable draft resets when the lead or draft changes. */
export function aiTriagePanelKey(lead: HelixLead): string {
  return `${lead.id}:${lead.nextMove?.createdAt ?? "none"}`;
}

export function AiTriagePanel({ lead, onLeadUpdate }: Props) {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState(lead.nextMove?.message ?? "");
  const [copied, setCopied] = useState(false);
  const triage = lead.aiTriage;
  const move = lead.nextMove;
  const hot = lead.classification === "lead" && lead.tier === "hot";

  async function call(action: "draft" | "approve" | "dismiss") {
    setBusy(action);
    setError(null);
    try {
      const res = await fetch(`/api/leads/${lead.id}/next-move`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(action === "approve" ? { action, message } : { action }),
      });
      const data = (await res.json()) as { lead?: HelixLead; error?: string };
      if (data.lead) onLeadUpdate(data.lead);
      if (!res.ok) setError(data.error || `Failed (${res.status})`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <div className="mb-2 flex items-center justify-between gap-2">
          <h3 className="text-[11px] font-bold tracking-wider text-outline uppercase">AI triage</h3>
          {triage ? (
            <span
              className={cn(
                "rounded px-1.5 py-0.5 font-mono text-[10px]",
                triage.engine === "claude"
                  ? "bg-tertiary/15 text-tertiary"
                  : "bg-surface-container-high text-on-surface-variant"
              )}
            >
              {triage.engine === "claude" ? `Claude · ${triage.model}` : "Heuristic (not AI)"}
            </span>
          ) : (
            <span className="rounded bg-surface-container-high px-1.5 py-0.5 font-mono text-[10px] text-outline">
              Not triaged by this pipeline
            </span>
          )}
        </div>
        {triage ? (
          <>
            {triage.engine === "heuristic" && triage.fallbackReason ? (
              <p className="mb-2 text-[11px] text-outline">Why heuristic: {triage.fallbackReason}</p>
            ) : null}
            <ul className="space-y-1.5">
              {triage.reasons.map((r, i) => (
                <li key={i} className="rounded-lg bg-surface-container-low px-3 py-2 text-xs">
                  <p className="text-on-surface">{r.reason}</p>
                  {r.quote ? (
                    <p
                      className={cn(
                        "mt-1 border-l-2 pl-2 italic",
                        r.verified ? "border-primary/60 text-on-surface-variant" : "border-error/60 text-error"
                      )}
                    >
                      &ldquo;{r.quote}&rdquo;
                      {r.verified ? "" : " (quote not found in the lead's text)"}
                    </p>
                  ) : null}
                </li>
              ))}
            </ul>
          </>
        ) : null}
      </div>

      {lead.crmProposal ? (
        <div className="rounded-lg border border-secondary/30 bg-secondary/5 px-3 py-2 text-xs text-on-surface-variant">
          <p className="font-semibold text-secondary">CRM push proposed (pending your approval)</p>
          <p className="mt-0.5">
            {lead.crmProposal.reason} Target: {lead.crmProposal.target ?? "no CRM connected"}. Queued by
            the scheduled triage; nothing was pushed.
          </p>
        </div>
      ) : null}

      {lead.hubspotContactId && lead.crmStatus === "sent" ? (
        <p className="rounded-lg bg-tertiary/10 px-3 py-2 font-mono text-[11px] text-tertiary">
          Synced to HubSpot · contact {lead.hubspotContactId}
          {lead.hubspotSyncedAt ? ` · ${new Date(lead.hubspotSyncedAt).toLocaleString()}` : ""}
        </p>
      ) : lead.hubspotError ? (
        <p className="rounded-lg bg-error/10 px-3 py-2 font-mono text-[11px] text-error">
          HubSpot sync failed: {lead.hubspotError}
        </p>
      ) : null}

      <div>
        <h3 className="mb-2 text-[11px] font-bold tracking-wider text-outline uppercase">Next best move</h3>
        {move && move.status !== "dismissed" ? (
          <div className="space-y-2 rounded-lg bg-surface-container-low p-3 text-xs">
            <div className="flex items-center justify-between gap-2">
              <span className="font-semibold text-on-surface">{move.action}</span>
              <span className="rounded bg-surface-container-high px-1.5 py-0.5 font-mono text-[10px] text-on-surface-variant">
                {move.channel} · {move.status === "approved" ? "approved" : "draft"}
              </span>
            </div>
            {move.subject ? <p className="text-on-surface-variant">Subject: {move.subject}</p> : null}
            {move.status === "draft" ? (
              <textarea
                className="h-28 w-full resize-y rounded-lg border border-outline-variant/40 bg-surface-container-lowest p-2 text-xs text-on-surface"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
              />
            ) : (
              <p className="whitespace-pre-wrap text-on-surface">{move.message}</p>
            )}
            {move.rationale ? <p className="text-[11px] text-outline">Why: {move.rationale}</p> : null}
            <p className="font-mono text-[10px] text-outline">
              Written by {move.model} ({move.createdBy === "cron" ? "scheduled triage" : "on request"}). Helix
              does not send it.
              {move.status === "approved" && move.decidedBy ? ` Approved by ${move.decidedBy}.` : ""}
            </p>
            {move.status === "draft" ? (
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={Boolean(busy)}
                  onClick={() => void call("approve")}
                  className="h-8 flex-1 rounded-lg bg-primary-container text-xs font-semibold text-on-primary-container disabled:opacity-50"
                >
                  Approve draft
                </button>
                <button
                  type="button"
                  disabled={Boolean(busy)}
                  onClick={() => void call("dismiss")}
                  className="h-8 rounded-lg bg-surface-container-high px-3 text-xs text-on-surface-variant disabled:opacity-50"
                >
                  Dismiss
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => {
                  void navigator.clipboard.writeText(move.message).then(() => {
                    setCopied(true);
                    window.setTimeout(() => setCopied(false), 1500);
                  });
                }}
                className="h-8 w-full rounded-lg bg-surface-container-high text-xs text-on-surface"
              >
                {copied ? "Copied" : "Copy to send yourself"}
              </button>
            )}
          </div>
        ) : (
          <button
            type="button"
            disabled={Boolean(busy)}
            onClick={() => void call("draft")}
            className="h-8 w-full rounded-lg bg-surface-container-high text-xs font-medium text-on-surface disabled:opacity-50"
          >
            {busy === "draft" ? "Claude is drafting…" : hot ? "Draft next move with Claude" : "Draft next move with Claude (not a hot lead)"}
          </button>
        )}
        {error ? <p className="mt-2 text-[11px] text-error">{error}</p> : null}
      </div>
    </div>
  );
}
