"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";

type Status = { shopify: boolean; claude: boolean; supabase: boolean };

const ROWS: { key: keyof Status; label: string; hint: string }[] = [
  {
    key: "shopify",
    label: "Shopify Admin API",
    hint: "SHOPIFY_STORE_DOMAIN / SHOPIFY_ACCESS_TOKEN — mock data is used until configured.",
  },
  {
    key: "claude",
    label: "Claude (Anthropic API)",
    hint: "ANTHROPIC_API_KEY — heuristic engines run instead until configured.",
  },
  {
    key: "supabase",
    label: "Supabase persistence",
    hint: "NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY — in-memory store is used until configured.",
  },
];

export default function SettingsPage() {
  const [status, setStatus] = useState<Status | null>(null);

  useEffect(() => {
    void (async () => {
      const res = await fetch("/api/status");
      setStatus((await res.json()) as Status);
    })();
  }, []);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Settings</h1>
        <p className="mt-1 text-xs text-muted-foreground">
          Integration status — reflects actual environment configuration, not a form.
        </p>
      </div>

      <div className="glass-panel glass-panel-glow space-y-3 rounded-xl p-5">
        {ROWS.map((row) => {
          const connected = status?.[row.key];
          return (
            <div
              key={row.key}
              className="flex items-center justify-between border-b border-border py-3 last:border-0"
            >
              <div>
                <p className="text-sm font-medium text-foreground">{row.label}</p>
                <p className="text-xs text-muted-foreground">{row.hint}</p>
              </div>
              {status === null ? (
                <span className="text-xs text-muted-foreground">Checking…</span>
              ) : connected ? (
                <span className="flex items-center gap-1.5 rounded border border-primary/40 bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                  <CheckCircle2 className="size-3.5" />
                  Connected
                </span>
              ) : (
                <span
                  className={cn(
                    "flex items-center gap-1.5 rounded border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-xs font-medium text-amber-600 dark:text-amber-300"
                  )}
                >
                  <XCircle className="size-3.5" />
                  Not configured
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
