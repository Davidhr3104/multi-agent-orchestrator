"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { CheckCircle2, XCircle } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { KEYS_LEADS } from "@helix/core/secret-fields";
import { DeskOpsForm } from "@helix/help/desk-form";
import { ApiKeysForm } from "@helix/help/keys-form";

type Status = { claude: boolean; supabase: boolean; ghl: boolean };
type Org = {
  orgId: string;
  orgName: string;
  role: "owner" | "operator" | "viewer";
  webhookToken?: string;
  logoUrl?: string;
  primaryColor?: string;
};
type OrgInfo = {
  configured: boolean;
  signedIn: boolean;
  user?: { email: string | null };
  org?: Org | null;
};

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
  const [org, setOrg] = useState<OrgInfo | null>(null);
  const [logoDraft, setLogoDraft] = useState("");
  const [colorDraft, setColorDraft] = useState("#38bdf8");
  const [brandBusy, setBrandBusy] = useState(false);
  const [brandError, setBrandError] = useState<string | null>(null);

  function loadOrg() {
    return fetch("/api/org")
      .then((r) => r.json())
      .then((data: OrgInfo) => {
        setOrg(data);
        setLogoDraft(data.org?.logoUrl ?? "");
        setColorDraft(data.org?.primaryColor ?? "#38bdf8");
      });
  }

  useEffect(() => {
    void fetch("/api/status")
      .then((r) => r.json())
      .then((data: Status) => setStatus(data));
    void loadOrg();
  }, []);

  async function saveBranding() {
    setBrandBusy(true);
    setBrandError(null);
    try {
      const res = await fetch("/api/org", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ logoUrl: logoDraft, primaryColor: colorDraft }),
      });
      const data = (await res.json()) as OrgInfo & { error?: string };
      if (!res.ok) {
        setBrandError(data.error ?? "Could not save branding");
        return;
      }
      setOrg(data);
    } finally {
      setBrandBusy(false);
    }
  }

  const webhookUrl =
    org?.org?.webhookToken && typeof window !== "undefined"
      ? `${window.location.origin}/api/leads/webhook/ghl/${org.org.webhookToken}`
      : null;
  const canEditBranding = org?.org?.role !== "viewer";

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
      {org?.configured ? (
        <Card>
          <CardHeader>
            <CardTitle>Workspace</CardTitle>
            <CardDescription>Org-scoped data isolation.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {!org.signedIn ? (
              <div className="flex items-center justify-between gap-4">
                <p className="text-xs text-muted-foreground">Not signed in.</p>
                <Link href="/login" className="text-xs text-primary underline">
                  Sign in
                </Link>
              </div>
            ) : (
              <>
                <div>
                  <p className="text-sm font-medium">{org.org?.orgName ?? "No workspace"}</p>
                  <p className="text-xs text-muted-foreground">{org.user?.email}</p>
                </div>
                {webhookUrl ? (
                  <div>
                    <p className="text-xs font-medium">GHL webhook URL for this workspace</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Leads from this exact URL land only in this workspace — other orgs never see them.
                    </p>
                    <code className="mt-1 block truncate rounded-md border border-border bg-muted px-2 py-1 text-xs">
                      {webhookUrl}
                    </code>
                  </div>
                ) : null}
                {canEditBranding ? (
                  <div className="border-t pt-3">
                    <p className="text-xs font-medium">Branding</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Logo and accent color shown in this workspace&apos;s sidebar.
                    </p>
                    <div className="mt-2 flex flex-col gap-2">
                      <input
                        type="url"
                        placeholder="https://…/logo.png"
                        value={logoDraft}
                        onChange={(e) => setLogoDraft(e.target.value)}
                        className="h-8 w-full rounded-md border border-border bg-background px-2 text-xs"
                      />
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          value={colorDraft}
                          onChange={(e) => setColorDraft(e.target.value)}
                          className="h-8 w-10 rounded-md border border-border bg-background"
                          aria-label="Primary color"
                        />
                        <Button disabled={brandBusy} onClick={() => void saveBranding()}>
                          {brandBusy ? "Saving…" : "Save branding"}
                        </Button>
                      </div>
                      {brandError ? <p className="text-xs text-rose-400">{brandError}</p> : null}
                    </div>
                  </div>
                ) : (
                  <p className="border-t pt-3 text-xs text-muted-foreground">
                    Viewers cannot edit workspace branding.
                  </p>
                )}
              </>
            )}
          </CardContent>
        </Card>
      ) : null}
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
