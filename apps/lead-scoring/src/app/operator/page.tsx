"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";

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
      setError("Could not reach the server. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-full max-w-md flex-col justify-center gap-5 px-4 py-16">
      <div>
        <p className="text-[10px] font-bold tracking-[0.2em] text-primary uppercase">Helix for Leads</p>
        <h1 className="mt-1 text-xl font-semibold text-on-surface">Operator unlock</h1>
        <p className="mt-2 text-sm text-on-surface-variant">
          The demo desk is open to every visitor. The operator key is only needed for actions that reach a real
          provider or cost money: pushing leads to HubSpot / GoHighLevel and Claude drafts or triage.
        </p>
      </div>

      {session === null ? (
        <p className="text-sm text-outline">Checking operator status…</p>
      ) : !session.configured ? (
        <p className="rounded-lg border border-outline-variant/40 bg-surface-container px-3 py-2 text-sm text-on-surface-variant">
          Operator access is not enabled on this deployment (no HELIX_OPERATOR_KEY), so every action is already open.
        </p>
      ) : session.operator ? (
        <div className="space-y-3 rounded-xl border border-primary/30 bg-primary/10 p-4">
          <p className="flex items-center gap-2 text-sm font-semibold text-primary">
            <span className="size-2 rounded-full bg-primary" aria-hidden />
            Unlocked on this browser
          </p>
          <p className="text-xs text-on-surface-variant">
            CRM pushes and Claude calls will run with your operator session for the next 30 days.
          </p>
          <Link
            href="/"
            className="inline-flex h-9 items-center rounded-lg bg-primary-container px-3 text-xs font-bold text-on-primary-container hover:brightness-110"
          >
            Back to the desk
          </Link>
        </div>
      ) : (
        <form
          className="flex flex-col gap-3 rounded-xl border border-outline-variant/30 bg-surface-container p-4"
          onSubmit={(e) => void submit(e)}
        >
          <p className="flex items-center gap-2 text-xs font-semibold text-outline">
            <span className="size-2 rounded-full bg-outline" aria-hidden />
            Locked
          </p>
          <input
            type="password"
            className="h-9 rounded-lg border border-outline-variant/40 bg-surface-container-lowest px-3 text-sm text-on-surface outline-none placeholder:text-outline focus:border-primary"
            placeholder="Operator key"
            value={key}
            onChange={(e) => setKey(e.target.value)}
            autoComplete="off"
            aria-label="Operator key"
          />
          {error ? <p className="text-sm text-error">{error}</p> : null}
          <button
            type="submit"
            disabled={busy || !key.trim()}
            className="h-9 rounded-lg bg-primary-container px-3 text-xs font-bold text-on-primary-container transition hover:brightness-110 disabled:opacity-50"
          >
            {busy ? "Unlocking…" : "Unlock operator mode"}
          </button>
        </form>
      )}
    </main>
  );
}
