"use client";

import { useState, useSyncExternalStore } from "react";
import { Check, X } from "lucide-react";
import { runDeskAction } from "@/lib/desk-client";
import { cn } from "@/lib/utils";

/** Selected draft ids, shared between each card's checkbox and the batch bar. */
let selected = new Set<string>();
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};
const snapshot = () => selected;
const setSelected = (next: Set<string>) => {
  selected = next;
  emit();
};
const useSelected = () => useSyncExternalStore(subscribe, snapshot, () => selected);

export function DraftSelect({ id, label }: { id: string; label: string }) {
  const sel = useSelected();
  const on = sel.has(id);
  return (
    <label className="inline-flex cursor-pointer items-center" title="Select for batch approval">
      <input
        type="checkbox"
        checked={on}
        onChange={() => {
          const next = new Set(selected);
          if (on) next.delete(id);
          else next.add(id);
          setSelected(next);
        }}
        className="size-4 cursor-pointer accent-[var(--primary)]"
        aria-label={`Select ${label}`}
      />
    </label>
  );
}

type Item = { id: string; label: string; kind: "new_match" | "reactivation" };

/**
 * Approve or dismiss several drafts at once. Every batch shows the exact list in a confirmation dialog first —
 * one click by a person, never a rule that approves on its own. Approving still sends nothing.
 */
export function BatchApproveBar({ items }: { items: Item[] }) {
  const sel = useSelected();
  const [busy, setBusy] = useState<"approve" | "dismiss" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const live = items.filter((i) => sel.has(i.id));
  const pick = (f: (i: Item) => boolean) => setSelected(new Set(items.filter(f).map((i) => i.id)));

  async function run(action: "approve_draft" | "dismiss_draft") {
    const verb = action === "approve_draft" ? "Approve" : "Dismiss";
    const list = live.map((i) => `• ${i.label}`).join("\n");
    const tail = action === "approve_draft" ? "\n\nApproving records your sign-off. Nothing is sent — each send is a separate confirmation in Outreach." : "";
    if (!window.confirm(`${verb} ${live.length} draft${live.length === 1 ? "" : "s"}?\n\n${list}${tail}`)) return;
    setBusy(action === "approve_draft" ? "approve" : "dismiss");
    setError(null);
    try {
      await runDeskAction({ action, targetIds: live.map((i) => i.id), labels: live.map((i) => i.label) });
      setSelected(new Set());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Request failed");
    } finally {
      setBusy(null);
    }
  }

  if (items.length < 2) return null;
  const chip = (on: boolean) =>
    cn("min-h-8 cursor-pointer rounded-full px-3 text-xs font-semibold ring-1 transition", on ? "bg-primary/15 text-primary ring-primary/40" : "text-muted-foreground ring-border hover:text-foreground");
  const allChecks = items.filter((i) => i.kind === "reactivation");
  const allAlerts = items.filter((i) => i.kind === "new_match");
  return (
    <div className="surface sticky top-2 z-20 flex flex-wrap items-center gap-2 rounded-xl px-4 py-2.5">
      <span className="text-xs font-semibold text-foreground">Batch</span>
      <button type="button" className={chip(live.length === items.length)} onClick={() => pick(() => true)}>
        All ({items.length})
      </button>
      {allChecks.length ? (
        <button type="button" className={chip(false)} onClick={() => pick((i) => i.kind === "reactivation")}>
          Cold check-ins ({allChecks.length})
        </button>
      ) : null}
      {allAlerts.length ? (
        <button type="button" className={chip(false)} onClick={() => pick((i) => i.kind === "new_match")}>
          New-listing alerts ({allAlerts.length})
        </button>
      ) : null}
      {live.length ? (
        <button type="button" className="text-xs text-muted-foreground hover:text-foreground" onClick={() => setSelected(new Set())}>
          Clear
        </button>
      ) : null}
      <span className="ml-auto flex items-center gap-2">
        {error ? (
          <span role="alert" className="text-xs text-rose-400">
            {error}
          </span>
        ) : null}
        <button
          type="button"
          disabled={!live.length || !!busy}
          onClick={() => void run("dismiss_draft")}
          className="inline-flex min-h-9 cursor-pointer items-center gap-1.5 rounded-lg px-3 text-xs font-semibold text-muted-foreground transition hover:bg-accent hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
        >
          <X className="size-3.5" aria-hidden /> {busy === "dismiss" ? "Dismissing…" : "Dismiss"}
        </button>
        <button
          type="button"
          disabled={!live.length || !!busy}
          onClick={() => void run("approve_draft")}
          className="inline-flex min-h-9 cursor-pointer items-center gap-1.5 rounded-lg bg-primary px-3.5 text-xs font-semibold text-primary-foreground transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Check className="size-3.5" aria-hidden /> {busy === "approve" ? "Approving…" : `Review & approve ${live.length || ""}`.trim()}
        </button>
      </span>
    </div>
  );
}
