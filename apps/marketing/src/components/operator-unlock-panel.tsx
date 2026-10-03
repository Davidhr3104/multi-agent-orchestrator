"use client";

import { useState, type FormEvent } from "react";
import { cn } from "@/lib/utils";

const OPEN_IN_DEMO = [
  "Review sample campaigns (keep / pause / scale on the demo desk)",
  "Confirm Helix AI proposals on the demo desk",
  "Upload a spend CSV, sync demo leads and resolve the join queue",
];

const NEEDS_OPERATOR = [
  "Sync Meta, Google Ads and TikTok Ads with real tokens",
  "Generate the AI waste report (Claude)",
  "Ask Helix AI with Claude",
  "Pause or scale in Meta Ads Manager — always after a person confirms",
  "Save API keys, leave the demo, and any change to a live desk",
];

export function OperatorUnlockPanel({ configured, initialUnlocked }: { configured: boolean; initialUnlocked: boolean }) {
  const [key, setKey] = useState("");
  const [unlocked, setUnlocked] = useState(initialUnlocked);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!key.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/operator", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key }),
      });
      if (!res.ok) {
        setError("That key is not valid on this deployment.");
        return;
      }
      setKey("");
      setUnlocked(true);
    } catch {
      setError("Could not reach the server. Try again.");
    } finally {
      setBusy(false);
    }
  }

  const status = unlocked ? "UNLOCKED" : configured ? "LOCKED" : "NOT REQUIRED";

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-5 py-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-medium text-on-surface">Operator unlock</h1>
          <p className="mt-1 text-sm text-on-surface-variant">
            The demo stays open to everyone. Real ad platforms, paid AI and the live desk need the operator key.
          </p>
        </div>
        <span
          className={cn(
            "rounded border px-2 py-0.5 font-mono text-[11px] font-bold",
            unlocked
              ? "border-success-emerald/30 bg-success-emerald/10 text-success-emerald"
              : "border-marketing-amber/30 bg-marketing-amber/10 text-marketing-amber"
          )}
        >
          {status}
        </span>
      </div>

      <div className="relative overflow-hidden rounded-xl border border-[var(--border-hairline)] bg-surface-container-low p-5 shadow-lg">
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(120% 140% at 15% 0%, rgba(249,115,22,0.18) 0%, rgba(217,119,6,0.06) 35%, transparent 70%)",
          }}
          aria-hidden
        />
        <div className="relative flex flex-col gap-3">
          {!configured ? (
            <p className="text-sm text-on-surface-variant">
              Operator access is not enabled on this deployment (no HELIX_OPERATOR_KEY), so every action is already allowed.
            </p>
          ) : unlocked ? (
            <>
              <p className="flex items-center gap-2 text-sm text-success-emerald">
                <span className="material-symbols-outlined text-[18px]">lock_open</span>
                Unlocked on this browser for 30 days.
              </p>
              <div className="flex flex-wrap gap-2">
                <a href="/" className="inline-flex h-9 items-center rounded-lg bg-primary-container px-4 text-xs font-bold text-white hover:bg-marketing-amber">
                  Back to the desk →
                </a>
                <a href="/settings" className="inline-flex h-9 items-center rounded-lg border border-[var(--border-hairline)] bg-surface-container px-4 text-xs text-on-surface hover:bg-surface-container-high">
                  Settings & API keys
                </a>
              </div>
            </>
          ) : (
            <form className="flex flex-col gap-3" onSubmit={(e) => void submit(e)}>
              <label htmlFor="operator-key" className="text-xs font-semibold text-on-surface">
                Operator key
              </label>
              <div className="flex flex-col gap-2 sm:flex-row">
                <input
                  id="operator-key"
                  type="password"
                  autoComplete="off"
                  placeholder="HELIX_OPERATOR_KEY"
                  value={key}
                  onChange={(e) => setKey(e.target.value)}
                  className="h-10 w-full min-w-0 rounded-lg border border-[var(--border-hairline)] bg-surface-container-high px-3 font-mono text-sm text-on-surface placeholder:text-on-surface-variant focus:outline-none"
                />
                <button
                  type="submit"
                  disabled={busy || !key.trim()}
                  className="inline-flex h-10 shrink-0 items-center justify-center gap-1 rounded-lg bg-[#f97316] px-4 text-xs font-bold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {busy ? "Unlocking…" : "Unlock"}
                </button>
              </div>
              {error ? <p className="text-xs text-alert-rose">{error}</p> : null}
            </form>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <div className="rounded-xl border border-[var(--border-hairline)] bg-surface-container-low p-4">
          <p className="font-mono text-[11px] text-success-emerald uppercase">Open in the demo</p>
          <ul className="mt-2 flex flex-col gap-1.5 text-xs text-on-surface-variant">
            {OPEN_IN_DEMO.map((t) => (
              <li key={t}>• {t}</li>
            ))}
          </ul>
        </div>
        <div className="rounded-xl border border-[var(--border-hairline)] bg-surface-container-low p-4">
          <p className="font-mono text-[11px] text-marketing-amber uppercase">Needs the operator key</p>
          <ul className="mt-2 flex flex-col gap-1.5 text-xs text-on-surface-variant">
            {NEEDS_OPERATOR.map((t) => (
              <li key={t}>• {t}</li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
