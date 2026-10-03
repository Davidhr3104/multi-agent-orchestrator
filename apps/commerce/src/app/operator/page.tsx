"use client";

import { useEffect, useState, type FormEvent } from "react";
import { KeyRound, LockKeyhole, LockKeyholeOpen } from "lucide-react";
import { cn } from "@/lib/utils";

type Session = { operator: boolean; configured: boolean };

export default function OperatorPage() {
  const [session, setSession] = useState<Session | null>(null);
  const [key, setKey] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void fetch("/api/operator")
      .then((r) => r.json())
      .then((d: Partial<Session>) => setSession({ operator: Boolean(d.operator), configured: Boolean(d.configured) }))
      .catch(() => setSession({ operator: false, configured: false }));
  }, []);

  async function submit(e: FormEvent) {
    e.preventDefault();
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
      setSession({ operator: true, configured: true });
    } catch {
      setError("Unlock failed: the server did not answer.");
    } finally {
      setBusy(false);
    }
  }

  const unlocked = Boolean(session?.operator);

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div>
        <h1 className="text-lg font-semibold tracking-tight text-foreground">Operator</h1>
        <p className="mt-1 text-xs text-muted-foreground">
          The demo desk works without a key. Claude calls, Shopify sync and changes on a live store need the operator unlock.
        </p>
      </div>

      <section className="glass-panel space-y-4 rounded-xl p-5 text-xs">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <KeyRound className="size-4 text-primary" />
            <h2 className="text-sm font-semibold text-foreground">Operator unlock</h2>
          </div>
          {session ? (
            <span
              className={cn(
                "flex items-center gap-1.5 rounded border px-2 py-0.5 font-medium",
                !session.configured
                  ? "border-border text-muted-foreground"
                  : unlocked
                    ? "border-primary/40 bg-primary/10 text-primary"
                    : "border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-300"
              )}
            >
              {unlocked ? <LockKeyholeOpen className="size-3" /> : <LockKeyhole className="size-3" />}
              {!session.configured ? "Not required" : unlocked ? "Unlocked" : "Locked"}
            </span>
          ) : null}
        </div>

        {!session ? (
          <p className="text-muted-foreground">Checking.</p>
        ) : !session.configured ? (
          <p className="text-secondary-foreground">
            HELIX_OPERATOR_KEY is not set on this deployment, so every action is already open.
          </p>
        ) : unlocked ? (
          <p className="text-secondary-foreground">
            This browser is unlocked for 30 days. Claude, Shopify sync and live-store changes are available.
          </p>
        ) : (
          <form className="space-y-3" onSubmit={(e) => void submit(e)}>
            <input
              type="password"
              className="h-9 w-full rounded-lg border border-border bg-black/[0.02] px-3 text-xs text-foreground placeholder-muted-foreground focus:border-primary focus:ring-1 focus:ring-primary/50 focus:outline-none dark:bg-white/[0.04]"
              placeholder="Operator key"
              value={key}
              onChange={(e) => setKey(e.target.value)}
              autoComplete="off"
              aria-label="Operator key"
            />
            {error ? <p className="text-[#dc2626]">{error}</p> : null}
            <button
              type="submit"
              disabled={busy || !key.trim()}
              className="flex min-h-9 items-center gap-2 rounded-lg border border-primary/30 bg-primary/10 px-3 py-1.5 font-semibold text-primary transition hover:bg-primary/20 disabled:opacity-50"
            >
              {busy ? "Unlocking…" : "Unlock"}
            </button>
          </form>
        )}
      </section>
    </div>
  );
}
