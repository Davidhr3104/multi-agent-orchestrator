"use client";

import { useEffect, useState, type FormEvent } from "react";

export default function OperatorUnlock() {
  const [key, setKey] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  const [configured, setConfigured] = useState<boolean | null>(null);

  useEffect(() => {
    void fetch("/api/operator")
      .then((r) => r.json())
      .then((d: { configured?: boolean }) => setConfigured(Boolean(d.configured)))
      .catch(() => setConfigured(false));
  }, []);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const res = await fetch("/api/operator", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key }),
    });
    if (!res.ok) {
      setError("That key is not valid on this deployment.");
      return;
    }
    setOk(true);
    window.location.href = "/";
  }

  return (
    <main className="mx-auto flex min-h-full max-w-md flex-col justify-center gap-4 px-4 py-16">
      <h1 className="text-xl font-semibold">Helix operator</h1>
      <p className="text-sm text-muted-foreground">
        Product switching is for internal ops only. Each Helix ships as its own product.
      </p>
      {configured === false ? (
        <p className="text-sm text-muted-foreground">Operator access is not enabled on this deployment.</p>
      ) : (
        <form className="flex flex-col gap-3" onSubmit={(e) => void submit(e)}>
          <input
            type="password"
            className="h-9 rounded-lg border border-input bg-background px-3 text-sm"
            placeholder="Operator key"
            value={key}
            onChange={(e) => setKey(e.target.value)}
            autoComplete="off"
            disabled={configured !== true}
          />
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          {ok ? <p className="text-sm text-emerald-400">Unlocked. Redirecting…</p> : null}
          <button
            type="submit"
            disabled={configured !== true}
            className="h-9 rounded-lg bg-primary px-3 text-sm text-primary-foreground disabled:opacity-50"
          >
            Unlock switcher
          </button>
        </form>
      )}
    </main>
  );
}
