"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, XCircle } from "lucide-react";
import { EngineShell } from "@/components/engine-shell";

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
    <EngineShell active="settings">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-6 py-8 lg:px-8">
        <div>
          <h1 className="text-2xl font-medium text-white">Settings</h1>
          <p className="mt-2 text-sm text-[#9CA3AF]">Nothing here claims Ads Manager is connected.</p>
        </div>
        <section className="rounded-xl border border-white/[0.08] bg-[#10131a]/85 p-5 shadow-lg backdrop-blur-sm">
          <h2 className="text-sm font-semibold text-white">Integrations</h2>
          <p className="mt-1 text-xs text-[#6B7280]">CSV is real. Ad APIs are stubs.</p>
          <div className="mt-4 flex flex-col gap-4">
            {ROWS.map((row) => {
              const connected = status?.[row.key];
              return (
                <div key={row.key} className="flex items-start justify-between gap-4 border-b border-white/[0.08] pb-3 last:border-0">
                  <div>
                    <p className="text-sm font-medium text-white">{row.label}</p>
                    <p className="text-xs text-[#6B7280]">{row.hint}</p>
                  </div>
                  {status == null ? (
                    <span className="text-xs text-[#6B7280]">Checking…</span>
                  ) : connected ? (
                    <span className="flex items-center gap-1 text-xs text-[#34D399]">
                      <CheckCircle2 className="size-3.5" /> Connected
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-xs text-[#FBBF24]">
                      <XCircle className="size-3.5" /> Not configured
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </EngineShell>
  );
}
