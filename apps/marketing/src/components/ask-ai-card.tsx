"use client";

import { useState, type FormEvent } from "react";

type AskAiMessage = { role: "user" | "assistant"; content: string };
type AskAiEngine = "claude" | "fallback";

const QUICK_CHIPS = [
  { label: "Explain spend on spam", question: "What does spend on spam mean?" },
  { label: "How is waste calculated?", question: "How is campaign waste calculated?" },
  { label: "Which campaign should I pause?", question: "Which campaign should I pause and why?" },
];

export function AskAiCard({ onOpenDrawer }: { onOpenDrawer?: (initialQuestion?: string) => void }) {
  const [question, setQuestion] = useState("");
  const [history, setHistory] = useState<AskAiMessage[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [engine, setEngine] = useState<AskAiEngine | null>(null);

  async function ask(text: string) {
    const trimmed = text.trim();
    if (!trimmed || busy) return;

    setError(null);
    setBusy(true);
    setQuestion("");

    const nextHistory: AskAiMessage[] = [...history, { role: "user", content: trimmed }];
    setHistory(nextHistory);

    try {
      const res = await fetch("/api/ask-ai", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ history: nextHistory }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? `Ask AI request failed (${res.status})`);
      }
      const data = (await res.json()) as { answer: string; engine: AskAiEngine };
      setEngine(data.engine);
      setHistory([...nextHistory, { role: "assistant", content: data.answer }]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ask AI request failed");
      setHistory(history);
    } finally {
      setBusy(false);
    }
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (onOpenDrawer) {
      onOpenDrawer(question.trim() || undefined);
      setQuestion("");
      return;
    }
    void ask(question);
  }

  const statusLabel = engine === "fallback" ? "Limited Mode" : "Online & Ready";
  const statusTone = engine === "fallback" ? "text-rose-500" : "text-[#f97316]";
  const dotTone = engine === "fallback" ? "bg-rose-500" : "bg-[#f97316]";

  return (
    <div className="relative overflow-hidden rounded-xl border border-[var(--border-hairline)] bg-surface-container-low p-3 shadow-lg backdrop-blur-sm sm:p-4">
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(120% 140% at 15% 0%, rgba(249,115,22,0.18) 0%, rgba(217,119,6,0.06) 35%, transparent 70%)",
        }}
        aria-hidden
      />
      <div className="relative flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0 flex-1 space-y-2.5">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <h2 className="text-base font-bold tracking-tight text-on-surface">Ask Helix AI</h2>
            <span className={`flex items-center gap-1 text-xs font-semibold ${statusTone}`}>
              <span className={`inline-block size-1.5 rounded-full ${dotTone}`} />
              {statusLabel}
            </span>
            <span className="hidden text-xs text-on-surface-variant sm:inline">How spend quality, waste scoring and HITL decisions work on this desk.</span>
          </div>

          <form onSubmit={onSubmit} className="flex items-center gap-2">
            <input
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="Ask AI e.g. what does spend on spam mean?"
              disabled={busy}
              className="h-10 w-full min-w-0 rounded-lg border border-[var(--border-hairline)] bg-surface-container-high px-3 text-sm text-on-surface placeholder:text-on-surface-variant focus:outline-none"
            />
            <button
              type="submit"
              disabled={busy || !question.trim()}
              className="inline-flex h-10 shrink-0 items-center gap-1 rounded-lg bg-[#f97316] px-4 text-xs font-bold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {busy ? "Asking…" : "Ask Helix →"}
            </button>
          </form>

          <div className="flex flex-wrap items-center gap-2">
                        {QUICK_CHIPS.map((chip) => (
              <button
                key={chip.label}
                type="button"
                disabled={busy}
                onClick={() => void ask(chip.question)}
                className="inline-flex min-h-10 items-center rounded-full border border-[var(--border-hairline)] px-3 text-xs sm:min-h-8 text-on-surface-variant transition hover:bg-surface-container-high disabled:cursor-not-allowed disabled:opacity-60"
              >
                {chip.label}
              </button>
            ))}
          </div>

          {error ? <p className="text-xs text-rose-500">{error}</p> : null}

          {history.length > 0 ? (
            <div className="max-h-64 space-y-2 overflow-y-auto rounded-lg border border-[var(--border-hairline)] bg-surface-container-high p-3">
              {history.map((m, i) => (
                <p
                  key={i}
                  className={
                    m.role === "user"
                      ? "text-sm text-[#f97316]"
                      : "text-sm whitespace-pre-line text-on-surface-variant"
                  }
                >
                  <span className="font-semibold">{m.role === "user" ? "You: " : "Helix: "}</span>
                  {m.content}
                </p>
              ))}
              {busy ? <p className="text-sm text-on-surface-variant">Thinking…</p> : null}
            </div>
          ) : null}
        </div>

        <button
          type="button"
          onClick={() => onOpenDrawer?.()}
          disabled={!onOpenDrawer}
          aria-label="Open Ask Helix AI assistant"
          className="group relative hidden shrink-0 rounded-lg transition-transform hover:scale-[1.02] disabled:cursor-default disabled:hover:scale-100 lg:block"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/ask-ai/ask-ai-visual.png" alt="" className="h-36 w-auto rounded-lg object-contain" />
          {onOpenDrawer ? (
            <span className="absolute right-2 bottom-2 left-2 flex items-center justify-center gap-1 rounded-md bg-black/70 py-1.5 text-xs font-semibold text-white backdrop-blur-sm transition-colors group-hover:bg-black/85">
              Ask Helix <span aria-hidden>→</span>
            </span>
          ) : null}
        </button>
      </div>
    </div>
  );
}
