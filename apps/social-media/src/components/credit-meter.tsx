"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { notifyDesk, postJson } from "@/components/notify-desk";
import { ROLE_LABEL } from "@/lib/access";
import { PLANS } from "@/lib/plans";
import type { ShellSession } from "@/lib/store";

export function CreditMeter({ session }: { session: ShellSession }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const used = Math.min(session.creditsUsed, session.creditsLimit);
  const width = session.creditsLimit ? Math.round((used / session.creditsLimit) * 100) : 0;
  const onPro = session.plan === "pro";

  async function upgrade() {
    setBusy(true);
    setError(null);
    try {
      await postJson("/api/workspace", { action: "plan", plan: "pro" });
      notifyDesk(`Plan set to Pro. ${PLANS.pro.credits} AI credits, no card charged.`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-lg border border-sidebar-border bg-sidebar-accent/40 px-3 py-2">
      <div className="flex items-center justify-between gap-2 text-[11px]">
        <span className="font-semibold text-sidebar-accent-foreground">{ROLE_LABEL[session.role]}</span>
        <span className="tabular font-mono text-muted-foreground">
          {session.creditsUsed}/{session.creditsLimit}
        </span>
      </div>
      <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-muted" role="meter" aria-valuenow={session.creditsUsed} aria-valuemin={0} aria-valuemax={session.creditsLimit} aria-label="AI credits used">
        <div className="h-full rounded-full bg-gradient-to-r from-emerald-400 via-primary to-sky-400" style={{ width: `${Math.max(width, session.creditsUsed > 0 ? 4 : 0)}%` }} />
      </div>
      <p className="mt-1 text-[10px] text-muted-foreground">
        {session.creditsUsed} / {session.creditsLimit} credits used
      </p>
      <p className="mt-1.5 text-[10px] leading-snug text-muted-foreground">
        {PLANS[session.plan].label} plan. Nothing is posted from this desk. No card is charged.
      </p>
      {onPro ? (
        <p className="mt-2 text-[11px] font-semibold text-primary">Pro · {session.creditsLimit} credits</p>
      ) : (
        <button
          type="button"
          disabled={busy}
          onClick={() => void upgrade()}
          className="mt-2 inline-flex min-h-8 cursor-pointer items-center rounded-full border border-primary/40 px-3 text-[11px] font-semibold text-primary hover:bg-primary/10 disabled:opacity-50"
        >
          {busy ? "Updating…" : "Upgrade to Pro"}
        </button>
      )}
      {error ? (
        <p role="alert" className="mt-1 text-[10px] text-rose-400">
          {error}
        </p>
      ) : null}
    </div>
  );
}
