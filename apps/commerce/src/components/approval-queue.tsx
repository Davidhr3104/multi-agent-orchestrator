"use client";

import { useEffect, useState } from "react";
import { Clock } from "lucide-react";
import type { PollRun, QueuedProposal } from "@/lib/order-automation";
import { formatCurrency } from "@/lib/format";
import { cn } from "@/lib/utils";

type AutomationState = {
  mode: "demo" | "live";
  proposals: QueuedProposal[];
  lastRun: PollRun | null;
  lastShopifySyncAt: string | null;
  cronConfigured: boolean;
  slackConfigured: boolean;
};

const ACTION_LABEL: Record<QueuedProposal["action"], string> = {
  hold_orders: "Hold for review",
  approve_orders: "Approve & fulfil",
};

/**
 * Proposals the automation queued. Nothing here runs on its own: each row needs a click, and
 * approving a real Shopify order asks once more because Helix cannot undo a fulfilment.
 */
export function ApprovalQueue({ onChanged }: { onChanged?: () => void }) {
  const [state, setState] = useState<AutomationState | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    void fetch("/api/automation")
      .then((r) => r.json())
      .then((d: AutomationState) => setState(d));
  }, [reloadKey]);

  async function confirm(p: QueuedProposal) {
    if (
      p.irreversibleOnShopify &&
      !window.confirm(`Approve ${p.label}? This fulfils the order in your real Shopify store and cannot be undone from Helix.`)
    ) {
      return;
    }
    setBusyId(p.orderId);
    setMessage(null);
    try {
      const res = await fetch("/api/ask-ai/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: p.action, targetIds: [p.orderId], labels: [p.label] }),
      });
      const body = (await res.json().catch(() => ({}))) as { resultText?: string; error?: string; failed?: { error: string }[] };
      if (!res.ok) setMessage(body.error ?? `HTTP ${res.status}`);
      else setMessage(body.failed?.length ? `${body.resultText ?? ""} ${body.failed[0].error}` : (body.resultText ?? "Done."));
      setReloadKey((k) => k + 1);
      onChanged?.();
    } finally {
      setBusyId(null);
    }
  }

  if (!state) return null;
  const run = state.lastRun;

  return (
    <section className="glass-panel space-y-3 rounded-xl p-5 text-xs">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Clock className="size-4 text-primary" />
          <h2 className="text-sm font-semibold text-foreground">Approval queue</h2>
          <span className="text-[10px] text-muted-foreground">{state.proposals.length} proposed</span>
        </div>
        <span className="text-[10px] text-muted-foreground">
          Order poll: {state.cronConfigured ? "daily via Vercel Cron" : "off (set CRON_SECRET)"} · Slack: {state.slackConfigured ? "on" : "off"}
        </span>
      </div>
      <p className="text-[11px] text-muted-foreground">
        The poll scores new Shopify orders and proposes a hold or an approval. It never approves, fulfils or cancels on its own — every row waits for your click.
      </p>
      {run ? (
        <p className="text-[10px] text-muted-foreground">
          Last poll {new Date(run.at).toLocaleString()}:{" "}
          {run.skipped ?? (run.ok ? `${run.newOrders} new of ${run.fetched} fetched from Shopify${run.postedToSlack ? ", Slack alert sent" : ""}` : `failed — ${run.error}`)}
        </p>
      ) : null}
      {message ? <p className="text-foreground">{message}</p> : null}

      {state.proposals.length === 0 ? (
        <p className="text-muted-foreground">No open orders waiting for a decision.</p>
      ) : (
        <ul className="space-y-1.5">
          {state.proposals.slice(0, 8).map((p) => (
            <li key={p.orderId} className="flex items-center justify-between gap-3 rounded border border-border p-2">
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="truncate font-medium text-foreground">{p.label}</span>
                  {p.source === "demo" ? (
                    <span className="rounded bg-amber-500/10 px-1 text-[9px] text-amber-600 dark:text-amber-300">demo</span>
                  ) : null}
                </div>
                <p className="text-[10px] text-muted-foreground">
                  {formatCurrency(p.totalPrice, p.currency)} · score {p.fraudScore} ({p.riskLevel})
                  {p.reasons.length ? ` · ${p.reasons.join("; ")}` : ""}
                </p>
              </div>
              <button
                disabled={busyId !== null}
                onClick={() => void confirm(p)}
                className={cn(
                  "shrink-0 rounded px-2.5 py-1 text-[11px] font-medium disabled:opacity-50",
                  p.action === "hold_orders"
                    ? "border border-amber-500/40 text-amber-600 hover:bg-amber-500/10 dark:text-amber-300"
                    : "bg-[#059669] text-white hover:bg-[#059669]/85"
                )}
              >
                {busyId === p.orderId ? "…" : `Confirm: ${ACTION_LABEL[p.action]}`}
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
