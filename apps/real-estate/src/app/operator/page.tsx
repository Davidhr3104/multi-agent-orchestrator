"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import { KeyRound, Loader2, LockOpen } from "lucide-react";

type Session = { operator: boolean; configured: boolean };

export default function OperatorUnlock() {
  const [key, setKey] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [session, setSession] = useState<Session | null>(null);

  useEffect(() => {
    void fetch("/api/operator")
      .then((r) => r.json())
      .then((d: Partial<Session>) => setSession({ operator: Boolean(d.operator), configured: Boolean(d.configured) }))
      .catch(() => setSession({ operator: false, configured: false }));
  }, []);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
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
      setError("Request failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <header>
        <h1 className="text-3xl font-semibold text-foreground">Operator</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          The demo desk is open to everyone. Real actions — sending email or SMS, pushing to HubSpot, importing your data, and Claude calls that cost money — need the operator key.
        </p>
      </header>

      <section className="max-w-md rounded-xl border border-border bg-card/80 p-5" aria-labelledby="operator-heading">
        <h2 id="operator-heading" className="flex items-center gap-2 text-lg font-semibold text-foreground">
          <KeyRound className="size-4 text-primary" aria-hidden /> Operator unlock
        </h2>
        <div className="mt-3">
          {session === null ? (
            <p className="text-sm text-muted-foreground">Checking…</p>
          ) : !session.configured ? (
            <p className="text-sm text-muted-foreground">Operator access is not enabled on this deployment (HELIX_OPERATOR_KEY is not set), so every action is open.</p>
          ) : session.operator ? (
            <div className="space-y-3">
              <p className="flex items-center gap-2 text-sm font-semibold text-emerald-300">
                <LockOpen className="size-4" aria-hidden /> Unlocked on this browser.
              </p>
              <p className="text-xs text-muted-foreground">Real and paid actions now run here. The unlock lasts 30 days on this browser.</p>
              <Link href="/" className="inline-flex min-h-10 items-center rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground transition hover:brightness-110">
                Back to the desk
              </Link>
            </div>
          ) : (
            <form className="flex flex-col gap-3" onSubmit={(e) => void submit(e)}>
              <label htmlFor="operator-key" className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
                Operator key
              </label>
              <input
                id="operator-key"
                type="password"
                className="h-10 rounded-lg border border-input bg-background/40 px-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
                placeholder="Operator key"
                value={key}
                onChange={(e) => setKey(e.target.value)}
                autoComplete="off"
              />
              {error ? (
                <p role="alert" className="text-xs text-rose-300">
                  {error}
                </p>
              ) : null}
              <button
                type="submit"
                disabled={busy || !key.trim()}
                className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground transition hover:brightness-110 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
              >
                {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null} Unlock
              </button>
            </form>
          )}
        </div>
      </section>
    </>
  );
}
