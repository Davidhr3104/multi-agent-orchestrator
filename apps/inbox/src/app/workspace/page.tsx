"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { UserPreferences } from "@/lib/types";

type WorkspacePayload = {
  workspace?: { id: string; name: string; email: string };
  persistence?: string;
  counts?: { open: number; review: number; routed: number; blocked: number; starred: number };
  preferences?: UserPreferences;
};

export default function WorkspacePage() {
  const [data, setData] = useState<WorkspacePayload | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void fetch("/api/workspace")
      .then((r) => r.json())
      .then((d: WorkspacePayload) => {
        setData(d);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className="p-8 text-muted-foreground">Loading workspace…</div>;
  }

  const ws = data?.workspace;
  const counts = data?.counts;

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-foreground">Workspace</h1>
        <p className="text-sm text-muted-foreground">Active EA desk for this origin. Switch products from Operator when unlocked.</p>
      </div>

      <div className="max-w-2xl space-y-4">
        <div className="glass-panel rounded-xl p-6">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-full border border-accent/40 bg-gradient-to-tr from-indigo-500/20 to-violet-500/30 text-sm font-semibold text-foreground">
              N
            </div>
            <div>
              <h2 className="text-base font-semibold text-foreground">{ws?.name ?? "Northwind EA"}</h2>
              <p className="text-xs text-muted-foreground">{ws?.email ?? "triage@company.io"}</p>
            </div>
          </div>
          <dl className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-xs text-muted-foreground">Workspace id</dt>
              <dd className="font-mono text-xs text-foreground">{ws?.id ?? "ws-northwind"}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Persistence</dt>
              <dd className="text-foreground">{data?.persistence ?? "memory+cookie"}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Default tone</dt>
              <dd className="text-foreground">{data?.preferences?.defaultTone ?? "professional"}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Auto-triage</dt>
              <dd className="text-foreground">{data?.preferences?.autoTriage ? "On" : "Off"}</dd>
            </div>
          </dl>
        </div>

        {counts ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {(
              [
                ["Open", counts.open],
                ["Review", counts.review],
                ["Routed", counts.routed],
                ["Blocked", counts.blocked],
              ] as const
            ).map(([label, n]) => (
              <div key={label} className="glass-panel rounded-xl p-4">
                <p className="text-[11px] tracking-wide text-muted-foreground uppercase">{label}</p>
                <p className="mt-1 text-2xl font-semibold text-foreground">{n}</p>
              </div>
            ))}
          </div>
        ) : null}

        <div className="flex flex-wrap gap-2 text-sm">
          <Link href="/settings" className="rounded-md border border-border px-3 py-1.5 text-foreground hover:bg-surface-muted">
            Settings
          </Link>
          <Link href="/audit" className="rounded-md border border-border px-3 py-1.5 text-foreground hover:bg-surface-muted">
            Audit log
          </Link>
        </div>
      </div>
    </div>
  );
}
