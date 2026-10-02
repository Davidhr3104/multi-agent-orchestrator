"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { notifyDesk, postJson } from "@/components/notify-desk";

export function CreateReportButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setBusy(true);
    setError(null);
    try {
      const data = await postJson<{ report: { id: string } }>("/api/reports", {});
      notifyDesk("Saved a calendar report for this workspace.");
      router.push(`/reports/${data.report.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        disabled={busy}
        onClick={() => void run()}
        className="inline-flex min-h-10 cursor-pointer items-center rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground hover:brightness-110 disabled:opacity-50"
      >
        {busy ? "Saving…" : "Save a reading link"}
      </button>
      <p className="text-[11px] text-muted-foreground">The link is a page on this desk. It is not a PDF and it does not include likes or reach.</p>
      {error ? (
        <p role="alert" className="text-xs text-rose-400">
          {error}
        </p>
      ) : null}
    </div>
  );
}
