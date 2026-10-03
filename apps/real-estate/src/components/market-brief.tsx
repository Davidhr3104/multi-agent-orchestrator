"use client";

import { useState } from "react";
import { Loader2, Sparkles } from "lucide-react";

type Reply = { ok: boolean; text?: string; error?: string; month: string; cached?: boolean; cost?: { inputTokens: number; outputTokens: number; estUsd: number } };
const usd = (n: number) => (n < 0.01 ? `$${n.toFixed(4)}` : `$${n.toFixed(2)}`);

/** A written brief on the loaded Realtor.com month. Generated only on request, since each call costs tokens. */
export function MarketBrief({ month, claude }: { month: string; claude: boolean }) {
  const [busy, setBusy] = useState(false);
  const [reply, setReply] = useState<Reply | null>(null);
  async function run() {
    setBusy(true);
    try {
      const res = await fetch("/api/market/brief", { method: "POST", headers: { "content-type": "application/json" }, body: "{}" });
      setReply(((await res.json().catch(() => null)) as Reply | null) ?? { ok: false, month, error: `Request failed (${res.status})` });
    } catch {
      setReply({ ok: false, month, error: "Request failed" });
    } finally {
      setBusy(false);
    }
  }
  return (
    <section aria-labelledby="brief-h" className="rounded-xl border border-border bg-card/80 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="brief-h" className="flex items-center gap-2 text-lg font-semibold text-foreground">
            <Sparkles className="size-4 text-primary" aria-hidden /> AI market brief
          </h2>
          <p className="text-xs text-muted-foreground">Claude writes the sentences; every number comes from the Realtor.com {month} figures on this page.</p>
        </div>
        <button
          type="button"
          onClick={() => void run()}
          disabled={!claude || busy}
          title={claude ? "Write a short brief from this month's figures" : "Needs an Anthropic API key on the server"}
          className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-border px-4 text-sm font-semibold text-foreground transition hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Sparkles className="size-4 text-primary" aria-hidden />}
          {reply?.ok ? "Write again" : "Write brief with Claude"}
        </button>
      </div>
      {!claude ? <p className="mt-3 text-xs text-muted-foreground">Claude isn&apos;t connected on this server (no Anthropic API key), so no brief is written. The figures above are unaffected.</p> : null}
      {reply ? (
        reply.ok ? (
          <div className="mt-3 space-y-2">
            <p className="text-sm leading-relaxed whitespace-pre-line text-foreground/90">{reply.text}</p>
            <p className="tabular font-mono text-[11px] text-muted-foreground">
              AI-written from Realtor.com data · {reply.month}
              {reply.cached ? " · reused from earlier today (no new cost)" : reply.cost ? ` · ${reply.cost.inputTokens + reply.cost.outputTokens} tokens · ≈ ${usd(reply.cost.estUsd)} estimated` : ""}
            </p>
          </div>
        ) : (
          <p role="alert" className="mt-3 text-xs text-rose-300">
            No brief: {reply.error}
          </p>
        )
      ) : null}
    </section>
  );
}
