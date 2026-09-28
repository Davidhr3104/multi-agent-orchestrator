"use client";

import { useState, type FormEvent } from "react";

type AskAiMessage = { role: "user" | "assistant"; content: string };
type AskAiEngine = "claude" | "fallback";

const QUICK_CHIPS = [
  { label: "Analyze pipeline velocity", question: "How is the lead pipeline moving right now?" },
  { label: "Explain lead score drops", question: "What causes a lead's score to drop?" },
  { label: "Predict next week spend", question: "What should I expect from next week's lead volume?" },
];

export function AskAiCard() {
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
    void ask(question);
  }

  const statusLabel = engine === "fallback" ? "Limited Mode" : "Online & Ready";
  const statusTone = engine === "fallback" ? "text-error" : "text-tertiary";
  const dotTone = engine === "fallback" ? "bg-error" : "bg-tertiary";

  return (
    <div className="relative overflow-hidden rounded-xl border border-outline-variant/25 bg-surface-container p-5">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0 flex-1 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-outline-variant/40 px-2.5 py-0.5 text-[10px] font-bold tracking-wider text-on-surface-variant uppercase">
              Helix Copilot v4.2
            </span>
            <span className={`flex items-center gap-1 text-[11px] font-semibold ${statusTone}`}>
              <span className={`inline-block size-1.5 rounded-full ${dotTone}`} />
              {statusLabel}
            </span>
          </div>

          <div>
            <h2 className="text-xl font-bold tracking-tight text-on-surface">Ask Helix AI</h2>
            <p className="mt-1 max-w-xl text-sm text-on-surface-variant">
              Query your pipeline heuristics, audit scoring decisions, and understand how the
              triage engine reached its conclusions — in real-time natural language.
            </p>
          </div>

          <form onSubmit={onSubmit} className="flex items-center gap-2">
            <input
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="Ask AI e.g. why did lead scoring change this week?"
              disabled={busy}
              className="h-10 w-full min-w-0 rounded-lg border border-outline-variant/40 bg-surface px-3 text-sm text-on-surface placeholder:text-outline focus:border-primary focus:outline-none"
            />
            <button
              type="submit"
              disabled={busy || !question.trim()}
              className="inline-flex h-10 shrink-0 items-center gap-1 rounded-lg bg-primary-container px-4 text-xs font-bold text-on-primary-container transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {busy ? "Asking…" : "Ask Copilot →"}
            </button>
          </form>

          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-outline">Quick chips:</span>
            {QUICK_CHIPS.map((chip) => (
              <button
                key={chip.label}
                type="button"
                disabled={busy}
                onClick={() => void ask(chip.question)}
                className="rounded-full border border-outline-variant/40 px-2.5 py-1 text-xs text-on-surface-variant transition hover:bg-surface-container-high disabled:cursor-not-allowed disabled:opacity-60"
              >
                {chip.label}
              </button>
            ))}
          </div>

          {error ? <p className="text-xs text-error">{error}</p> : null}

          {history.length > 0 ? (
            <div className="max-h-64 space-y-2 overflow-y-auto rounded-lg border border-outline-variant/25 bg-surface p-3">
              {history.map((m, i) => (
                <p
                  key={i}
                  className={
                    m.role === "user"
                      ? "text-sm text-primary"
                      : "text-sm whitespace-pre-line text-on-surface-variant"
                  }
                >
                  <span className="font-semibold">{m.role === "user" ? "You: " : "Helix: "}</span>
                  {m.content}
                </p>
              ))}
              {busy ? <p className="text-sm text-outline">Thinking…</p> : null}
            </div>
          ) : null}
        </div>

        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/ask-ai/ask-ai-visual.png"
          alt=""
          className="hidden h-44 w-auto shrink-0 rounded-lg object-contain lg:block"
        />
      </div>
    </div>
  );
}
