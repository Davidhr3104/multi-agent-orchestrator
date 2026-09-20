"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { CheckCircle2, XCircle } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { KEYS_LEADS } from "@helix/core/secret-fields";
import { DeskOpsForm } from "@helix/help/desk-form";
import { ApiKeysForm } from "@helix/help/keys-form";

type Status = { claude: boolean; supabase: boolean; ghl: boolean };

const ROWS: { key: keyof Status; label: string; hint: string }[] = [
  {
    key: "claude",
    label: "Claude",
    hint: "ANTHROPIC_API_KEY — heuristic scoring runs until this is set.",
  },
  {
    key: "supabase",
    label: "Supabase",
    hint: "Persists scored leads. Without it the inbox is in-memory and resets on deploy.",
  },
  {
    key: "ghl",
    label: "GoHighLevel",
    hint: "GHL_API_KEY + GHL_LOCATION_ID. Send to CRM errors until both exist. Inbound: POST /api/leads/webhook/ghl.",
  },
];

export default function SettingsPage() {
  const [status, setStatus] = useState<Status | null>(null);

  useEffect(() => {
    void fetch("/api/status")
      .then((r) => r.json())
      .then((data: Status) => setStatus(data));
  }, []);

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-8">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs tracking-[0.2em] text-primary uppercase">Helix for Leads</p>
          <h1 className="mt-1 text-2xl font-medium">Settings</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Paste keys below. Status reflects saved keys and env vars — not a pretend connector.
          </p>
        </div>
        <Link
          href="/"
          className="inline-flex h-7 items-center rounded-lg border border-border px-2.5 text-[0.8rem]"
        >
          Inbox
        </Link>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Integrations</CardTitle>
          <CardDescription>Connected vs not configured.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {ROWS.map((row) => {
            const connected = status?.[row.key];
            return (
              <div key={row.key} className="flex items-start justify-between gap-4 border-b pb-3 last:border-0">
                <div>
                  <p className="text-sm font-medium">{row.label}</p>
                  <p className="text-xs text-muted-foreground">{row.hint}</p>
                </div>
                {status == null ? (
                  <span className="text-xs text-muted-foreground">Checking…</span>
                ) : connected ? (
                  <span className="flex items-center gap-1 text-xs text-emerald-300">
                    <CheckCircle2 className="size-3.5" /> Connected
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-xs text-amber-300">
                    <XCircle className="size-3.5" /> Not configured
                  </span>
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>
      <Card>
        <CardContent className="pt-6">
          <ApiKeysForm initialFields={KEYS_LEADS} />
        </CardContent>
      </Card>
      <Card>
        <CardContent className="pt-6">
          <DeskOpsForm />
        </CardContent>
      </Card>
    </div>
  );
}
