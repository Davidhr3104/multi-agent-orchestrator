"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { CheckCircle2, XCircle } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type Status = { meta: boolean; google: boolean; csv: boolean };

const ROWS: { key: keyof Status; label: string; hint: string }[] = [
  {
    key: "csv",
    label: "CSV / JSON spend",
    hint: "POST /api/campaigns/ingest. This is the live path for the MVP.",
  },
  {
    key: "meta",
    label: "Meta Ads",
    hint: "Stub. Confirm pause/scale only changes local campaign status.",
  },
  {
    key: "google",
    label: "Google Ads",
    hint: "Stub. Same as Meta — no Ads Manager writes this sprint.",
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
          <div className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/helix-for-marketing.png"
              alt="Helix for Marketing"
              className="h-10 w-auto shrink-0"
            />
            <div>
              <p className="text-xs tracking-[0.2em] text-primary uppercase">Helix for Marketing</p>
              <h1 className="mt-1 text-2xl font-medium">Settings</h1>
            </div>
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
            Nothing here claims Ads Manager is connected.
          </p>
        </div>
        <Link
          href="/"
          className="inline-flex h-7 items-center rounded-lg border border-border px-2.5 text-[0.8rem]"
        >
          Campaigns
        </Link>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Integrations</CardTitle>
          <CardDescription>CSV is real. Ad APIs are stubs.</CardDescription>
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
    </div>
  );
}
