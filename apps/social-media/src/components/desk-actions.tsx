"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { notifyDesk, postJson } from "@/components/notify-desk";

export function DeskAction({
  action,
  body,
  label,
  message,
}: {
  action: string;
  body?: Record<string, unknown>;
  label: string;
  message: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setBusy(true);
    setError(null);
    try {
      const data = await postJson<{ message?: string; href?: string }>(`/api/desk`, { action, ...body });
      notifyDesk(data.message ?? message);
      if (data.href) router.push(data.href);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <span className="inline-flex flex-col gap-1">
      <button type="button" disabled={busy} onClick={() => void run()} className="inline-flex min-h-9 cursor-pointer items-center rounded-lg border border-primary/40 bg-primary/10 px-3 text-xs font-semibold text-primary hover:bg-primary/20 disabled:opacity-50">
        {busy ? "Working…" : label}
      </button>
      {error ? <span className="text-[11px] text-rose-400">{error}</span> : null}
    </span>
  );
}
