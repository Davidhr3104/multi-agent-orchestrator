"use client";

import { useState } from "react";
import { CheckCheck } from "lucide-react";
import { notifyDesk, postJson } from "@/components/notify-desk";

/** Approves every in-review post that already scores 100. Leaves the rest in the queue. */
export function BulkApprove({ count, items = [] }: { count: number; items?: { id: string; caption: string }[] }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const preview = items.slice(0, 6);

  async function run() {
    setBusy(true);
    setError(null);
    try {
      const data = await postJson<{ approved: string[]; stepped?: string[] }>("/api/posts/bulk-approve", {});
      const n = data.approved.length;
      const stepped = data.stepped?.length ?? 0;
      notifyDesk(
        [n ? `Approved ${n} post${n === 1 ? "" : "s"} with a score of 100.` : "", stepped ? `Sent ${stepped} to the client.` : ""]
          .filter(Boolean)
          .join(" ") || "No post in review has a score of 100.",
        data.approved
      );
      setOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-1">
      <button
        type="button"
        disabled={busy || count === 0}
        onClick={() => setOpen(true)}
        className="inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground transition hover:brightness-110 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
      >
        <CheckCheck className="size-4" aria-hidden />
        {busy ? "Approving…" : `Approve all 100/100 (${count})`}
      </button>
      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 backdrop-blur-sm" role="presentation" onMouseDown={() => setOpen(false)}>
          <div role="dialog" aria-modal="true" aria-labelledby="bulk-title" className="w-full max-w-md rounded-2xl border border-border bg-card p-5 shadow-2xl" onMouseDown={(event) => event.stopPropagation()}>
            <h3 id="bulk-title" className="text-lg font-semibold text-foreground">
              Sign off {count} perfect post{count === 1 ? "" : "s"}?
            </h3>
            <p className="mt-1 text-xs text-muted-foreground">Only posts already in review at 100. Nothing is published.</p>
            {preview.length ? (
              <ul className="mt-3 space-y-1 text-sm text-foreground">
                {preview.map((item) => (
                  <li key={item.id} className="truncate">
                    {item.caption}
                  </li>
                ))}
                {items.length > preview.length ? <li className="text-xs text-muted-foreground">and {items.length - preview.length} more</li> : null}
              </ul>
            ) : null}
            <div className="mt-4 flex gap-2">
              <button type="button" onClick={() => setOpen(false)} className="inline-flex min-h-10 cursor-pointer items-center rounded-lg border border-border px-4 text-sm font-semibold">
                Cancel
              </button>
              <button type="button" disabled={busy} onClick={() => void run()} className="inline-flex min-h-10 cursor-pointer items-center rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-50">
                {busy ? "Approving…" : "Confirm sign-off"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
      {error ? (
        <p role="alert" className="text-xs text-rose-400">
          {error}
        </p>
      ) : null}
    </div>
  );
}
