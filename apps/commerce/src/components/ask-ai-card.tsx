"use client";

import { useState } from "react";
import { MorphPanel } from "@helix/ui";

type AskAiMessage = { role: "user" | "assistant"; content: string };
type AskAiEngine = "claude" | "fallback";

const QUICK_CHIPS = [
  { label: "Explain this fraud score", question: "Why did this order get this fraud score?" },
  { label: "What does risk level mean?", question: "What does each risk level mean?" },
  { label: "Explain requires review", question: "Why does an order require human review?" },
];

export function AskAiCard({
  orderId,
  onOpenDrawer,
}: {
  orderId?: string;
  onOpenDrawer?: (initialQuestion?: string) => void;
}) {
  const [history, setHistory] = useState<AskAiMessage[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [engine, setEngine] = useState<AskAiEngine | null>(null);

  async function ask(text: string) {
    const trimmed = text.trim();
    if (!trimmed || busy) return;

    setError(null);
    setBusy(true);

    const nextHistory: AskAiMessage[] = [...history, { role: "user", content: trimmed }];
    setHistory(nextHistory);

    try {
      const res = await fetch("/api/ask-ai", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ orderId, history: nextHistory }),
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

  const statusLabel = engine === "fallback" ? "Limited Mode" : "Online & Ready";
  const statusTone = engine === "fallback" ? "text-rose-500" : "text-[#059669]";
  const dotTone = engine === "fallback" ? "bg-rose-500" : "bg-[#059669]";

  return (
    <div className="glass-panel relative overflow-hidden rounded-xl p-5">
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(120% 140% at 15% 0%, rgba(5,150,105,0.18) 0%, rgba(5,150,105,0.06) 35%, transparent 70%)",
        }}
        aria-hidden
      />
      <div className="relative flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0 flex-1 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
              Helix AI
            </span>
            <span className={`flex items-center gap-1 text-[11px] font-semibold ${statusTone}`}>
              <span className={`inline-block size-1.5 rounded-full ${dotTone}`} />
              {statusLabel}
            </span>
          </div>

          <div>
            <h2 className="text-[22px] font-semibold tracking-tight text-foreground">
              Ask Helix AI
            </h2>
            <p className="mt-1 max-w-xl text-xs text-muted-foreground">
              {orderId
                ? "Ask why the selected order scored the way it did, grounded in its actual fraud reasoning."
                : "Ask how fraud scoring, risk levels, and review work in this desk."}
            </p>
          </div>

          <MorphPanel
            title="Ask Helix for Commerce"
            logoSrc="/logo-icon.png"
            avatarDesk="commerce"
            accent="#059669"
            accentInk="#ffffff"
            placeholder="Ask AI e.g. why is this order high risk?"
            busy={busy}
            chips={QUICK_CHIPS}
            onAsk={(text) => {
              if (onOpenDrawer) {
                onOpenDrawer(text);
                return;
              }
              window.dispatchEvent(new CustomEvent("helix:open-ask", { detail: { question: text } }));
            }}
          />

          {error ? <p className="text-xs text-rose-500">{error}</p> : null}

          {history.length > 0 ? (
            <div className="max-h-64 space-y-2 overflow-y-auto rounded-lg border border-border bg-background p-3">
              {history.map((m, i) => (
                <p
                  key={i}
                  className={
                    m.role === "user"
                      ? "text-sm text-[#059669]"
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
          onClick={() => {
            if (onOpenDrawer) onOpenDrawer();
            else window.dispatchEvent(new CustomEvent("helix:open-ask", { detail: { question: "" } }));
          }}
          aria-label="Open Ask Helix AI assistant"
          className="group relative mx-auto shrink-0 cursor-pointer rounded-lg transition-transform hover:scale-[1.02] lg:mx-0"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/ask-ai/ask-ai-visual.png" alt="" className="h-44 w-auto rounded-lg object-contain" />
          <span className="absolute right-2 bottom-2 left-2 flex items-center justify-center gap-1 rounded-md bg-black/70 py-1.5 text-xs font-semibold text-white backdrop-blur-sm transition-colors group-hover:bg-black/85">
            Ask Helix <span aria-hidden>→</span>
          </span>
        </button>
      </div>
    </div>
  );
}
