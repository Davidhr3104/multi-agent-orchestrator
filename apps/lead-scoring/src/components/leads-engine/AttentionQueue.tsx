"use client";

import type { StoredLead } from "@helix/core";
import { initials } from "./lead-ui";

type Props = {
  leads: StoredLead[];
  flashIds?: string[];
  busyId: string | null;
  onApprove: (id: string) => void;
  onSpam: (id: string) => void;
};

export function AttentionQueue({ leads, flashIds = [], busyId, onApprove, onSpam }: Props) {
  const queue = leads.filter((l) => l.needsReview);

  return (
    <div className="rounded-xl border border-error/25 bg-surface-container">
      <div className="flex items-center gap-2 border-b border-outline-variant/20 px-5 py-4">
        <span className="material-symbols-outlined text-[20px] text-error">priority_high</span>
        <div>
          <h3 className="text-sm font-bold text-on-surface">Attention Required</h3>
          <p className="text-xs text-on-surface-variant">
            {queue.length === 0 ? "Queue clear" : `${queue.length} lead(s) flagged for HITL`}
          </p>
        </div>
      </div>
      {queue.length === 0 ? (
        <p className="px-5 py-8 text-center text-sm text-outline">No reviews pending.</p>
      ) : (
        <ul className="divide-y divide-outline-variant/15">
          {queue.map((lead) => (
            <li key={lead.id} className={"px-5 py-4" + (flashIds.includes(lead.id) ? " ai-flash" : "")}>
              <div className="flex items-start gap-3">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-error-container/40 text-xs font-bold text-error">
                  {initials(lead.name)}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-on-surface">{lead.name}</p>
                  <p className="mt-0.5 text-xs text-on-surface-variant">
                    Score {lead.score} · {lead.classification} · {lead.email}
                  </p>
                  <p className="mt-2 line-clamp-2 text-xs text-outline">{lead.reasoning}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={busyId === lead.id}
                      onClick={() => onApprove(lead.id)}
                      className="inline-flex h-8 items-center gap-1 rounded-lg bg-primary-container px-3 text-xs font-bold text-on-primary-container disabled:opacity-50"
                    >
                      <span className="material-symbols-outlined text-[16px]">check</span>
                      Approve &amp; Push
                    </button>
                    <button
                      type="button"
                      disabled={busyId === lead.id}
                      onClick={() => onSpam(lead.id)}
                      className="inline-flex h-8 items-center gap-1 rounded-lg border border-outline-variant/40 bg-surface-container-high px-3 text-xs font-semibold text-on-surface-variant disabled:opacity-50"
                    >
                      <span className="material-symbols-outlined text-[16px]">block</span>
                      Mark Spam
                    </button>
                  </div>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
