"use client";

import { useState } from "react";
import { RotateCcw } from "lucide-react";

export function ResetDemoButton() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function reset() {
    if (!window.confirm("Reload the demo data? Every change on this desk — showings, drafts, sellers and the activity log — goes back to the sample set.")) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/settings/desk", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "demo" }) });
      const body = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) throw new Error(body?.error ?? `Request failed (${res.status})`);
      window.dispatchEvent(new CustomEvent("helix:ai-action", { detail: { message: "Demo data reloaded.", ids: [] } }));
      window.dispatchEvent(new CustomEvent("helix:desk-refresh"));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed");
    } finally {
      setBusy(false);
    }
  }
  return (
    <span className="inline-flex flex-col gap-1">
      <button
        type="button"
        onClick={reset}
        disabled={busy}
        className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-rose-400/40 px-4 text-sm font-semibold text-rose-200 transition hover:bg-rose-500/10 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:opacity-50"
      >
        <RotateCcw className="size-4" aria-hidden /> {busy ? "Reloading…" : "Reload demo data"}
      </button>
      {error ? (
        <span role="alert" className="text-xs text-rose-300">
          {error}
        </span>
      ) : null}
    </span>
  );
}
