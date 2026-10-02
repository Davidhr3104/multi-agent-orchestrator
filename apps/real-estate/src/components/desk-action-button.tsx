"use client";

import { useState, type ReactNode } from "react";
import { runDeskAction } from "@/lib/desk-client";
import { cn } from "@/lib/utils";

const VARIANT = {
  primary: "bg-primary text-primary-foreground hover:brightness-110",
  glow: "bg-gradient-to-b from-[#e3c274] to-primary text-primary-foreground shadow-[0_0_18px_rgba(201,162,75,0.45)] ring-1 ring-[#e3c274]/60 hover:shadow-[0_0_26px_rgba(201,162,75,0.65)] hover:brightness-110",
  outline: "border border-border text-foreground hover:bg-accent",
  ghost: "text-muted-foreground hover:bg-accent hover:text-foreground",
  danger: "border border-rose-400/30 text-rose-300 hover:bg-rose-400/10",
};

/** A person's click on a desk action. The click is the confirmation, so it goes straight to execute. */
export function DeskActionButton({
  action,
  targetIds,
  labels,
  params,
  children,
  busyLabel,
  variant = "outline",
  className,
  confirm,
  onDone,
}: {
  action: string;
  targetIds: string[];
  labels?: string[];
  params?: Record<string, unknown>;
  children: ReactNode;
  busyLabel?: string;
  variant?: keyof typeof VARIANT;
  className?: string;
  /** Asked with the browser dialog before running; for changes that are awkward to walk back. */
  confirm?: string;
  onDone?: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    if (confirm && !window.confirm(confirm)) return;
    setBusy(true);
    setError(null);
    try {
      await runDeskAction({ action, targetIds, labels, params });
      onDone?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <span className={cn("inline-flex flex-col gap-1", className)}>
      <button
        type="button"
        disabled={busy || targetIds.length === 0}
        onClick={() => void run()}
        className={cn(
          "inline-flex min-h-10 w-full cursor-pointer items-center justify-center gap-2 rounded-lg px-4 text-sm font-semibold transition focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50",
          VARIANT[variant]
        )}
      >
        {busy && busyLabel ? busyLabel : children}
      </button>
      {error ? (
        <span role="alert" className="max-w-xs text-xs text-rose-400">
          {error}
        </span>
      ) : null}
    </span>
  );
}
