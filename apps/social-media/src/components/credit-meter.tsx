"use client";

import { ROLE_LABEL } from "@/lib/access";
import { PLANS } from "@/lib/plans";
import type { ShellSession } from "@/lib/store";

export function CreditMeter({ session }: { session: ShellSession }) {
  const used = Math.min(session.creditsUsed, session.creditsLimit);
  const width = session.creditsLimit ? Math.round((used / session.creditsLimit) * 100) : 0;

  return (
    <div className="rounded-lg border border-sidebar-border bg-sidebar-accent/40 px-3 py-2">
      <div className="flex items-center justify-between gap-2 text-xs">
        <span className="font-semibold text-sidebar-accent-foreground">{ROLE_LABEL[session.role]}</span>
        <span className="tabular font-mono text-muted-foreground">
          {session.creditsUsed}/{session.creditsLimit}
        </span>
      </div>
      <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-muted" role="meter" aria-valuenow={session.creditsUsed} aria-valuemin={0} aria-valuemax={session.creditsLimit} aria-label="AI credits used">
        <div className="h-full rounded-full bg-gradient-to-r from-emerald-400 via-primary to-sky-400" style={{ width: `${Math.max(width, session.creditsUsed > 0 ? 4 : 0)}%` }} />
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        {session.creditsUsed} / {session.creditsLimit} credits used
      </p>
      <p className="mt-1.5 text-xs leading-snug text-muted-foreground">
        {PLANS[session.plan].label} limits on this desk. Checkout is not live — there is no Upgrade until Stripe is connected.
      </p>
    </div>
  );
}
