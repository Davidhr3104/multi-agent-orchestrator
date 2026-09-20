"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, XCircle } from "lucide-react";
import { EngineShell } from "@/components/engine-shell";
import { KEYS_MARKETING } from "@helix/core/secret-fields";
import { DeskOpsForm } from "@helix/help/desk-form";
import { ApiKeysForm } from "@helix/help/keys-form";

type Status = { meta: boolean; google: boolean; csv: boolean; store?: string; unmatched?: number };

const ROWS: { key: "csv" | "meta" | "google"; label: string; hint: string }[] = [
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
          <p className="mt-2 text-sm text-[#9CA3AF]">Paste keys here. Nothing claims Ads Manager is connected.</p>
        </div>
        <section className="rounded-xl border border-white/[0.08] bg-[#10131a]/85 p-5 shadow-lg backdrop-blur-sm">
          <ApiKeysForm initialFields={KEYS_MARKETING} />
        </section>
        <section className="rounded-xl border border-white/[0.08] bg-[#10131a]/85 p-5 shadow-lg backdrop-blur-sm">
          <DeskOpsForm />
        </section>
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
        <section className="rounded-xl border border-white/[0.08] bg-[#10131a]/85 p-5 shadow-lg backdrop-blur-sm">
          <h2 className="text-sm font-semibold text-white">Desk store</h2>
          <p className="mt-1 text-xs text-[#6B7280]">
            Spend events, scored leads, and HITL decisions. Memory dies between Vercel instances unless
            Supabase is configured (<span className="font-mono">supabase/schemas/marketing.sql</span>).
          </p>
          <p className="mt-3 text-sm text-white">
            {status == null ? "Checking…" : status.store === "supabase" ? "Supabase" : status.store === "file" ? "Local file" : "In-memory (ephemeral)"}
          </p>
          {status?.unmatched != null ? (
            <p className="mt-2 text-xs text-[#9CA3AF]">
              {status.unmatched} unmatched campaign_id(s) in 30d.{" "}
              <a className="text-[#F97316]" href="/unmatched">
                Join queue
              </a>
            </p>
          ) : null}
        </section>
      </div>
    </EngineShell>
  );
}
