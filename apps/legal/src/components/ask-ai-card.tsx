"use client";

import { useState, type FormEvent } from "react";

type AskAiMessage = { role: "user" | "assistant"; content: string };
type AskAiEngine = "claude" | "fallback";

const QUICK_CHIPS = [
  { label: "Explain this match score", icon: "help_outline", question: "Why did this RFP get this match score?" },
  { label: "What does unverified mean?", icon: "verified", question: "What does an unverified fact mean here?" },
  { label: "Explain Go/No-Go", icon: "rule", question: "How does the Go/No-Go recommendation work?" },
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
  const dotColor = engine === "fallback" ? "#f87171" : "#e2e8f0";
  const dotGlow = engine === "fallback" ? "0 0 8px #f87171" : "0 0 8px #ffffff";

  return (
    <section
      className="relative w-full overflow-hidden rounded-2xl p-6"
      style={{
        background:
          "radial-gradient(circle at 75% 30%, rgba(226, 232, 240, 0.08) 0%, transparent 60%), linear-gradient(135deg, rgba(20, 24, 34, 0.95) 0%, rgba(12, 14, 20, 0.98) 100%)",
        border: "1px solid rgba(226, 232, 240, 0.16)",
        boxShadow: "0 20px 50px -10px rgba(0, 0, 0, 0.8), inset 0 1px 0 0 rgba(255, 255, 255, 0.2)",
      }}
    >
      <div className="pointer-events-none absolute -top-24 -right-24 size-[32rem] rounded-full bg-slate-300/5 blur-3xl" />
      <div className="relative z-10 grid grid-cols-1 items-center gap-6 lg:grid-cols-12">
        <div className="space-y-3 lg:col-span-7">
          <div
            className="inline-flex items-center gap-2 rounded-full px-3 py-1"
            style={{ background: "rgba(226, 232, 240, 0.08)", border: "1px solid rgba(226, 232, 240, 0.18)", backdropFilter: "blur(8px)" }}
          >
            <span
              className="size-2 animate-pulse rounded-full"
              style={{ backgroundColor: dotColor, boxShadow: dotGlow }}
            />
            <span className="text-[11px] font-semibold tracking-wider text-slate-200 uppercase">
              Helix Copilot • {statusLabel}
            </span>
          </div>

          <div>
            <h2
              className="text-[28px] leading-tight font-bold tracking-tight"
              style={{
                background: "linear-gradient(180deg, #ffffff 0%, #e2e8f0 45%, #94a3b8 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                textShadow: "0 2px 20px rgba(255,255,255,0.15)",
              }}
            >
              Ask Helix AI
            </h2>
            <p className="mt-1 max-w-xl text-sm leading-relaxed text-slate-300">
              {rfpId
                ? "Ask why this RFP scored the way it did, grounded in its actual reasoning."
                : "Ask how scoring, Go/No-Go probability models, and cross-jurisdictional conflict checks work across this legal intake desk."}
            </p>
          </div>

          <form onSubmit={onSubmit} className="relative flex w-full items-center">
            <div
              className="flex w-full items-center rounded-xl p-1.5"
              style={{
                background: "rgba(9, 11, 16, 0.85)",
                border: "1px solid rgba(226, 232, 240, 0.18)",
                boxShadow: "inset 0 2px 6px rgba(0, 0, 0, 0.8), 0 4px 20px rgba(0, 0, 0, 0.4)",
              }}
            >
              <span className="material-symbols-outlined px-3 text-[20px] text-slate-400">smart_toy</span>
              <input
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder="Ask AI e.g. why is this RFP flagged for review?"
                disabled={busy}
                className="w-full min-w-0 border-none bg-transparent px-1 text-sm text-white placeholder:text-slate-500 outline-none"
              />
              <button
                type="submit"
                disabled={busy || !question.trim()}
                className="flex shrink-0 items-center gap-1.5 rounded-lg px-5 py-2 text-[13px] font-semibold transition-all hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
                style={{
                  background: "linear-gradient(180deg, #ffffff 0%, #cbd5e1 50%, #94a3b8 100%)",
                  color: "#090a0f",
                  boxShadow: "0 2px 10px rgba(0,0,0,0.5), inset 0 1px 1px rgba(255,255,255,0.9)",
                  border: "1px solid rgba(255,255,255,0.5)",
                }}
              >
                <span>{busy ? "Asking…" : "Ask Copilot"}</span>
                <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
              </button>
            </div>
          </form>

          <div className="flex flex-wrap items-center gap-1.5 pt-1">
            <span className="mr-1 text-[11px] font-medium tracking-wider text-slate-400 uppercase">Suggested:</span>
            {QUICK_CHIPS.map((chip) => (
              <button
                key={chip.label}
                type="button"
                disabled={busy}
                onClick={() => void ask(chip.question)}
                className="flex items-center gap-1 rounded-md px-2.5 py-1 text-[11px] text-slate-300 transition-all hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
                style={{ background: "rgba(226, 232, 240, 0.06)", border: "1px solid rgba(226, 232, 240, 0.12)" }}
              >
                <span className="material-symbols-outlined text-[14px] text-slate-400">{chip.icon}</span>
                {chip.label}
              </button>
            ))}
          </div>

          {error ? <p className="text-xs text-rose-400">{error}</p> : null}

          {history.length > 0 ? (
            <div
              className="max-h-64 space-y-2 overflow-y-auto rounded-lg p-3"
              style={{ background: "rgba(9, 11, 16, 0.85)", border: "1px solid rgba(226, 232, 240, 0.12)" }}
            >
              {history.map((m, i) => (
                <p
                  key={i}
                  className={m.role === "user" ? "text-sm text-slate-100" : "text-sm whitespace-pre-line text-slate-300"}
                >
                  <span className="font-semibold">{m.role === "user" ? "You: " : "Helix: "}</span>
                  {m.content}
                </p>
              ))}
              {busy ? <p className="text-sm text-slate-500">Thinking…</p> : null}
            </div>
          ) : null}
        </div>

        <div className="flex justify-center lg:col-span-5 lg:justify-end">
          <div
            className="group relative w-full max-w-sm cursor-pointer overflow-hidden rounded-xl p-1"
            style={{
              background:
                "linear-gradient(135deg, rgba(255,255,255,0.25) 0%, rgba(148,163,184,0.1) 50%, rgba(255,255,255,0.18) 100%)",
              boxShadow: "0 15px 35px -5px rgba(0, 0, 0, 0.9)",
            }}
          >
            <div className="relative overflow-hidden rounded-lg">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/ask-ai/ask-ai-visual.png"
                alt=""
                className="h-56 w-full transform object-cover object-center opacity-95 transition-transform duration-700 group-hover:scale-105"
              />
              <div
                className="pointer-events-none absolute inset-0"
                style={{ background: "linear-gradient(to top, #090b10, transparent, transparent)" }}
              />
              <div className="absolute right-3 bottom-2.5 left-3 flex items-center justify-between">
                <div
                  className="flex items-center gap-1.5 text-[11px] text-slate-200"
                  style={{ textShadow: "0 2px 4px rgba(0,0,0,0.8)" }}
                >
                  <span className="material-symbols-outlined text-[14px] text-slate-300">shield_with_heart</span>
                  <span className="font-medium">Proprietary Neural Matrix</span>
                </div>
                <span
                  className="rounded px-2 py-0.5 text-[10px] font-semibold"
                  style={{
                    background: "rgba(226, 232, 240, 0.15)",
                    backdropFilter: "blur(8px)",
                    border: "1px solid rgba(255, 255, 255, 0.25)",
                    color: "#f8fafc",
                  }}
                >
                  v4.2 PRO
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
