"use client";

import { useState, type FormEvent } from "react";
import { ErrorText } from "@/components/operator-notice";

type AskAiMessage = { role: "user" | "assistant"; content: string };
type AskAiEngine = "claude" | "fallback";

const QUICK_CHIPS = [
  { label: "Explain this thread's urgency", question: "Why was this thread flagged as urgent?" },
  { label: "What does needs review mean?", question: "What does 'needs review' mean in this inbox?" },
  { label: "How is sentiment detected?", question: "How does the engine detect sentiment?" },
];

export function AskAiCard({
  threadId,
  onOpenDrawer,
}: {
  threadId?: string;
  onOpenDrawer?: (initialQuestion?: string) => void;
}) {
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
        body: JSON.stringify({ threadId, history: nextHistory }),
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
  const statusTone = engine === "fallback" ? "text-rose-500" : "text-[#8B5CF6]";
  const dotTone = engine === "fallback" ? "bg-rose-500" : "bg-[#8B5CF6]";

  return (
    <div className="glass-panel relative overflow-hidden rounded-xl border border-border p-5">
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(120% 140% at 15% 0%, rgba(139,92,246,0.18) 0%, rgba(99,102,241,0.06) 35%, transparent 70%)",
        }}
        aria-hidden
      />
      <div className="relative flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0 flex-1 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-border px-2.5 py-0.5 text-[10px] font-bold tracking-wider text-muted-foreground uppercase">
              Helix AI
            </span>
            <span className={`flex items-center gap-1 text-[11px] font-semibold ${statusTone}`}>
              <span className={`inline-block size-1.5 rounded-full ${dotTone}`} />
              {statusLabel}
            </span>
          </div>

          <div>
            <h2 className="text-xl font-bold tracking-tight text-foreground">
              {threadId ? "Ask Helix AI about this thread" : "Ask Helix AI"}
            </h2>
            <p className="mt-1 max-w-xl text-sm text-muted-foreground">
              {threadId
                ? "Ask why this thread was classified the way it was, grounded in its actual reasoning."
                : "Ask how triage, urgency, and routing work in this inbox."}
            </p>
          </div>

          <form onSubmit={onSubmit} className="flex items-center gap-2">
            <input
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="Ask AI e.g. why is this thread marked urgent?"
              disabled={busy}
              className="input-glow h-10 w-full min-w-0 rounded-lg border border-border bg-surface-muted px-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
            />
            <button
              type="submit"
              disabled={busy || !question.trim()}
              className="inline-flex h-10 shrink-0 items-center gap-1 rounded-lg bg-gradient-to-r from-[#4E5FF7] via-[#6366F1] to-[#8B5CF6] px-4 text-xs font-bold text-white shadow-[0_4px_18px_rgba(124,58,237,0.45)] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {busy ? "Asking…" : "Ask Helix →"}
            </button>
          </form>

          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-muted-foreground">Quick chips:</span>
            {QUICK_CHIPS.map((chip) => (
              <button
                key={chip.label}
                type="button"
                disabled={busy}
                onClick={() => void ask(chip.question)}
                className="rounded-full border border-border px-2.5 py-1 text-xs text-muted-foreground transition hover:bg-surface-muted disabled:cursor-not-allowed disabled:opacity-60"
              >
                {chip.label}
              </button>
            ))}
          </div>

          {error ? <p className="text-xs text-rose-500"><ErrorText message={error} /></p> : null}

          {history.length > 0 ? (
            <div className="max-h-64 space-y-2 overflow-y-auto rounded-lg border border-border bg-surface p-3">
              {history.map((m, i) => (
                <p
                  key={i}
                  className={
                    m.role === "user"
                      ? "text-sm text-[#8B5CF6]"
                      : "text-sm whitespace-pre-line text-muted-foreground"
                  }
                >
                  <span className="font-semibold">{m.role === "user" ? "You: " : "Helix: "}</span>
                  {m.content}
                </p>
              ))}
              {busy ? <p className="text-sm text-muted-foreground">Thinking…</p> : null}
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
          <img src="/ask-ai/ask-ai-visual.png" alt="" className="h-44 w-auto rounded-lg object-contain" />
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
