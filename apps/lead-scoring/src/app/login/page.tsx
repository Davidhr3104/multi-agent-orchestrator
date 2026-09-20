"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) {
        setError(data.error ?? "Could not send magic link");
        return;
      }
      setSent(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-sm flex-col justify-center gap-4 px-4">
      <h1 className="text-lg font-semibold text-white">Sign in to Helix for Leads</h1>
      <p className="text-sm text-slate-400">
        Each workspace is isolated — leads never cross between organizations.
      </p>
      {sent ? (
        <p className="rounded-md border border-emerald-900/50 bg-emerald-950/40 px-3 py-2 text-sm text-emerald-300">
          Check {email} for a sign-in link.
        </p>
      ) : (
        <>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@company.com"
            className="h-9 w-full rounded-md border border-sky-900/50 bg-[#0a1e30] px-3 text-sm text-slate-200 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
            onKeyDown={(e) => {
              if (e.key === "Enter") void submit();
            }}
          />
          {error ? <p className="text-sm text-rose-400">{error}</p> : null}
          <Button disabled={busy || !email.includes("@")} onClick={() => void submit()}>
            {busy ? "Sending…" : "Send magic link"}
          </Button>
        </>
      )}
    </div>
  );
}
