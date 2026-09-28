"use client";

import { useState, type FormEvent } from "react";

type AskAiMessage = { role: "user" | "assistant"; content: string };
type AskAiEngine = "claude" | "fallback";

const QUICK_CHIPS = [
  { label: "Explain this match score", question: "Why did this RFP get this match score?" },
  { label: "What does unverified mean?", question: "What does an unverified fact mean here?" },
  { label: "Explain Go/No-Go", question: "How does the Go/No-Go recommendation work?" },
];

export function AskAiCard({ rfpId }: { rfpId?: string }) {
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
        body: JSON.stringify({ rfpId, history: nextHistory }),
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
  const statusColor = engine === "fallback" ? "#F87171" : "#F59E0B";

  return (
    <div className="relative mb-4 overflow-hidden rounded-[6px] border border-[#1F2937] bg-[#111827] p-5 shadow-subtle">
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(120% 140% at 15% 0%, rgba(245,158,11,0.14) 0%, rgba(217,119,6,0.05) 35%, transparent 70%)",
        }}
        aria-hidden
      />
      <div className="relative flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0 flex-1 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-[3px] border border-[#1F2937] px-2.5 py-0.5 text-[10px] font-bold tracking-wider text-[#9CA3AF] uppercase">
              Helix Copilot
            </span>
            <span className="flex items-center gap-1 text-[11px] font-semibold" style={{ color: statusColor }}>
              <span className="inline-block size-1.5 rounded-full" style={{ backgroundColor: statusColor }} />
              {statusLabel}
            </span>
          </div>

          <div>
            <h2 className="text-[20px] font-bold tracking-tight text-[#F3F4F6]">
              {rfpId ? "Ask Helix AI about this RFP" : "Ask Helix AI"}
            </h2>
            <p className="mt-1 max-w-xl text-sm text-[#9CA3AF]">
              {rfpId
                ? "Ask why this RFP scored the way it did, grounded in its actual reasoning."
                : "Ask how scoring, Go/No-Go, and conflict checks work in this desk."}
            </p>
          </div>

          <form onSubmit={onSubmit} className="flex items-center gap-2">
            <input
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="Ask AI e.g. why is this RFP flagged for review?"
              disabled={busy}
              className="h-10 w-full min-w-0 rounded-[4px] border border-[#1F2937] bg-[#0B0F19] px-3 text-sm text-[#F3F4F6] placeholder:text-[#6B7280] focus:border-[#F59E0B] focus:outline-none"
            />
            <button
              type="submit"
              disabled={busy || !question.trim()}
              className="btn-tactile shrink-0 rounded-[4px] bg-[#F59E0B] px-4 py-2 text-[11px] font-semibold text-[#0B0F19] transition hover:bg-[#D97706] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {busy ? "Asking…" : "Ask Copilot →"}
            </button>
          </form>

          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-[#6B7280]">Quick chips:</span>
            {QUICK_CHIPS.map((chip) => (
              <button
                key={chip.label}
                type="button"
                disabled={busy}
                onClick={() => void ask(chip.question)}
                className="rounded-full border border-[#1F2937] px-2.5 py-1 text-xs text-[#9CA3AF] transition hover:bg-[#1F2937] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {chip.label}
              </button>
            ))}
          </div>

          {error ? <p className="text-xs text-[#F87171]">{error}</p> : null}

          {history.length > 0 ? (
            <div className="max-h-64 space-y-2 overflow-y-auto rounded-[4px] border border-[#1F2937] bg-[#0B0F19] p-3">
              {history.map((m, i) => (
                <p
                  key={i}
                  className={
                    m.role === "user"
                      ? "text-sm text-[#F59E0B]"
                      : "text-sm whitespace-pre-line text-[#9CA3AF]"
                  }
                >
                  <span className="font-semibold">{m.role === "user" ? "You: " : "Helix: "}</span>
                  {m.content}
                </p>
              ))}
              {busy ? <p className="text-sm text-[#6B7280]">Thinking…</p> : null}
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
