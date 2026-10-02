"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { notifyDesk, postJson } from "@/components/notify-desk";

/** Fills empty days in the next 3 when switched on. It does not watch the calendar after that. */
export function AutopilotSwitch({ on }: { on: boolean }) {
  const router = useRouter();
  const [enabled, setEnabled] = useState(on);
  const [busy, setBusy] = useState(false);

  async function toggle() {
    const next = !enabled;
    setBusy(true);
    try {
      const data = await postJson<{ message?: string }>("/api/desk", { action: "autopilot", on: next });
      setEnabled(next);
      notifyDesk(data.message ?? (next ? "Autopilot is on." : "Autopilot is off."));
      router.refresh();
    } catch (err) {
      notifyDesk(err instanceof Error ? err.message : "Couldn't change autopilot");
    } finally {
      setBusy(false);
    }
  }

  return (
    <button type="button" aria-pressed={enabled} disabled={busy} onClick={() => void toggle()} className={`inline-flex min-h-9 cursor-pointer items-center rounded-full border px-3 text-xs font-semibold disabled:opacity-50 ${enabled ? "border-primary/50 bg-primary/15 text-primary" : "border-border text-muted-foreground"}`}>
      {busy ? "Working…" : enabled ? "AI Autopilot on" : "Enable AI Autopilot"}
    </button>
  );
}
