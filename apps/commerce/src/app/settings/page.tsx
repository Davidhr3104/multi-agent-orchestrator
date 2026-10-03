"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { KEYS_COMMERCE } from "@helix/core/secret-fields";
import { DeskOpsForm } from "@helix/help/desk-form";
import { ApiKeysForm } from "@helix/help/keys-form";
import { AiCostLine } from "@/components/ai-insights-panel";
import { SHOPIFY_SCOPES, SHOPIFY_WEBHOOK_TOPICS } from "@/lib/shopify-setup";

type Status = { shopify: boolean; claude: boolean; supabase: boolean };

const ROWS: { key: keyof Status; label: string; hint: string }[] = [
  {
    key: "shopify",
    label: "Shopify Admin API",
    hint: "SHOPIFY_STORE_DOMAIN / SHOPIFY_ACCESS_TOKEN — live Admin API when both are set. Load demo otherwise.",
  },
  {
    key: "claude",
    label: "Claude (Anthropic API)",
    hint: "ANTHROPIC_API_KEY — order scoring, fraud explanations, daily summary and restock reasoning. Deterministic engines run (and are labelled) until configured.",
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
          Paste keys below. Status reflects saved keys. Sync Shopify uses the Admin API when both fields are set.
        </p>
      </div>

      <div className="glass-panel glass-panel-glow rounded-xl p-5">
        <ApiKeysForm initialFields={KEYS_COMMERCE} />
      </div>

      <div className="glass-panel glass-panel-glow rounded-xl p-5">
        <DeskOpsForm />
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

      <div className="glass-panel glass-panel-glow space-y-3 rounded-xl p-5 text-xs">
        <h2 className="text-sm font-semibold text-foreground">Connect a free Shopify development store</h2>
        <ol className="list-decimal space-y-1.5 pl-4 text-secondary-foreground">
          <li>
            Create a free Shopify Partner account at <span className="font-mono">partners.shopify.com</span>.
          </li>
          <li>
            In the Partner Dashboard: <b>Stores → Add store → Create development store</b>. It is free and cannot take real payments.
          </li>
          <li>
            In the dev store admin: <b>Settings → Apps and sales channels → Develop apps</b>, allow custom app development, then <b>Create an app</b>. If your admin sends you to
            Shopify&apos;s Dev Dashboard instead, create the app there and install it on the dev store — scopes and token work the same way.
          </li>
          <li>
            <b>Configuration → Admin API integration</b>: tick the scopes listed below and save.
          </li>
          <li>
            <b>Install app → API credentials</b>: reveal the Admin API access token (starts with <span className="font-mono">shpat_</span>). Shopify shows it only once.
          </li>
          <li>
            Paste <span className="font-mono">your-store.myshopify.com</span> as the store domain and the token above, save, then Sync Shopify. The desk switches to your real orders
            only after Shopify answers; demo data is dropped, never mixed in.
          </li>
          <li>
            Test orders: enable the <b>Bogus Gateway</b> under Settings → Payments and check out on the storefront, or create draft orders and mark them paid.
          </li>
          <li>
            Optional webhooks (instant scoring): Settings → Notifications → Webhooks, URL <span className="font-mono">https://&lt;this-app&gt;/api/webhooks/shopify</span>, topics{" "}
            <span className="font-mono">{SHOPIFY_WEBHOOK_TOPICS.join(", ")}</span>. Copy the signing secret into Shopify webhook secret.
          </li>
          <li>
            Optional automation: set <span className="font-mono">CRON_SECRET</span> in the Vercel project. Vercel Cron then calls{" "}
            <span className="font-mono">/api/cron/poll-orders</span> daily (12:30 UTC) to score new orders and queue proposals — it never approves or cancels. Add{" "}
            <span className="font-mono">SLACK_WEBHOOK_URL</span> to get an alert.
          </li>
        </ol>

        <h3 className="pt-2 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">Admin API scopes this app calls</h3>
        <ul className="space-y-1">
          {SHOPIFY_SCOPES.map((s) => (
            <li key={s.scope} className="flex gap-2">
              <span className={cn("shrink-0 font-mono", s.required ? "text-foreground" : "text-muted-foreground")}>{s.scope}</span>
              <span className="text-muted-foreground">{s.usedFor}</span>
            </li>
          ))}
        </ul>
        <p className="text-muted-foreground">
          Approving fulfils the order and cancelling voids it in your real Shopify store; Helix cannot undo either. Both always wait for a human click.
        </p>
      </div>

      <div className="glass-panel glass-panel-glow rounded-xl p-5">
        <h2 className="mb-1 text-sm font-semibold text-foreground">AI usage (estimated)</h2>
        <AiCostLine />
      </div>
    </div>
  );
}
