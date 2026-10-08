"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { notifyDesk, postJson } from "@/components/notify-desk";

export function InboundActions({ id }: { id: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);

  async function run(action: "accept" | "dismiss") {
    setBusy(action);
    try {
      await postJson("/api/inbound", { action, id });
      notifyDesk(action === "accept" ? "Draft queued for review. Nothing was published." : "Dismissed the inbound draft.");
      router.refresh();
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="mt-3 flex flex-wrap gap-2">
      <button type="button" disabled={!!busy} onClick={() => void run("accept")} className="inline-flex min-h-9 cursor-pointer items-center rounded-full bg-primary px-3 text-xs font-semibold text-primary-foreground disabled:opacity-50">
        {busy === "accept" ? "Queuing…" : "Queue as draft"}
      </button>
      <button type="button" disabled={!!busy} onClick={() => void run("dismiss")} className="inline-flex min-h-9 cursor-pointer items-center rounded-full border border-border px-3 text-xs font-semibold text-muted-foreground disabled:opacity-50">
        Dismiss
      </button>
    </div>
  );
}
