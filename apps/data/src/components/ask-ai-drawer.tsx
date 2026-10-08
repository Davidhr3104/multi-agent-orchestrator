"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { createPortal } from "react-dom";
import { usePathname } from "next/navigation";
import { Sparkles, X } from "lucide-react";
import { HelixAvatar, HelixHandoffDemo, HelixWelcome, useHelixAvatarState } from "@helix/ui";

export function AskAiDrawer() {
  return (
    <button
      type="button"
      onClick={() => window.dispatchEvent(new CustomEvent("helix:open-ask", { detail: { question: "" } }))}
      className="inline-flex min-h-9 items-center gap-1.5 rounded-md border border-border px-3 text-xs font-medium hover:bg-surface-muted"
    >
      <Sparkles className="size-3.5" />
      Ask Helix AI
    </button>
  );
}

export function AskAiWorkspace({ datasetId }: { datasetId?: string }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [question, setQuestion] = useState("");
  const [busy, setBusy] = useState(false);
  const [turns, setTurns] = useState<{ role: "user" | "assistant"; content: string }[]>([]);
  // failures here are shown as an assistant turn, so there is no separate error flag to pass
  // the scripted "one Helix hands work to another" demo; it steps aside as soon as a real chat starts
  const [handoffDemo, setHandoffDemo] = useState(false);
  const [seenTurns, setSeenTurns] = useState(turns.length);
  if (turns.length !== seenTurns) {
    setSeenTurns(turns.length);
    if (turns.length > 0) setHandoffDemo(false);
  }
  const avatarState = useHelixAvatarState(busy, false);
  const scroller = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);

  async function ask(text: string) {
    const q = text.trim();
    if (!q || busy) return;
    setQuestion("");
    setTurns((t) => [...t, { role: "user", content: q }]);
    setBusy(true);
    try {
      const res = await fetch("/api/ask-ai", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ question: q, datasetId }),
      });
      const d = (await res.json()) as { answer?: string; error?: string };
      setTurns((t) => [...t, { role: "assistant", content: d.answer ?? d.error ?? "Ask failed." }]);
    } catch {
      setTurns((t) => [...t, { role: "assistant", content: "Ask failed." }]);
    } finally {
      setBusy(false);
    }
  }

  const askRef = useRef(ask);
  askRef.current = ask;

  useEffect(() => {
    function questionFrom(event: Event) {
      const detail = (event as CustomEvent<{ question?: string } | string>).detail;
      if (typeof detail === "string") return detail.trim();
      return detail?.question?.trim() ?? "";
    }
    function onOpen(event: Event) {
      const asked = questionFrom(event);
      setOpen(true);
      if (asked) void askRef.current(asked);
    }
    window.addEventListener("helix:open-ask", onOpen);
    window.addEventListener("helix:ask", onOpen);
    return () => {
      window.removeEventListener("helix:open-ask", onOpen);
      window.removeEventListener("helix:ask", onOpen);
    };
  }, []);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    input.current?.focus();
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight });
  }, [turns, busy]);

  async function send(e: FormEvent) {
    e.preventDefault();
    await ask(question);
  }

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div className="helix-ask-fill" role="dialog" aria-label="Ask Helix Data AI">
      <header className="flex h-20 shrink-0 items-center justify-between gap-3 border-b border-border px-4 sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <HelixAvatar desk="data" state={avatarState} size={64} decorative />
          <div className="min-w-0">
            <h2 className="truncate text-sm font-semibold">Ask Helix Data AI</h2>
            <p className="truncate text-[11px] text-muted-foreground">
              Answers cite cells on this desk. Limited Mode — no model is called.
            </p>
          </div>
        </div>
        <button
          type="button"
          className="inline-flex min-h-9 items-center gap-1.5 rounded-md border border-border px-3 text-xs font-medium hover:bg-surface-muted"
          onClick={() => setOpen(false)}
        >
          <X className="size-3.5" />
          Back to desk
        </button>
      </header>
      <div ref={scroller} className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-6 sm:px-8">
        {turns.length === 0 ? (
          handoffDemo ? (
            <HelixHandoffDemo from="data" onClose={() => setHandoffDemo(false)} />
          ) : (
          <HelixWelcome desk="data" title="What shall we look at on the grid?">
            <p className="mx-auto max-w-2xl text-sm text-muted-foreground">
            Try “What is pending HITL?” or “Explain E3”. Nothing is rewritten until you approve.
          </p>
            <button type="button" onClick={() => setHandoffDemo(true)} className="inline-flex min-h-9 items-center gap-1.5 rounded-md border border-border px-3 text-xs font-medium hover:bg-surface-muted">
              <span aria-hidden>⇄</span> Watch a handoff
            </button>
          </HelixWelcome>
          )
        ) : null}
        <div className="mx-auto flex max-w-2xl flex-col gap-3">
          {turns.map((t, i) => (
            <div
              key={i}
              className={
                t.role === "user"
                  ? "ml-8 rounded-2xl bg-accent/15 px-4 py-3 text-sm font-medium"
                  : "mr-8 whitespace-pre-wrap rounded-2xl border border-border px-4 py-3 text-sm text-muted-foreground"
              }
            >
              {t.content}
            </div>
          ))}
          {busy ? (
            <div className="flex items-center gap-2.5">
              <HelixAvatar desk="data" state="thinking" size={48} decorative />
              <p className="text-xs text-muted-foreground">Looking at the grid…</p>
            </div>
          ) : null}
        </div>
      </div>
      <form onSubmit={(e) => void send(e)} className="shrink-0 border-t border-border px-4 py-4 sm:px-8">
        <div className="mx-auto flex max-w-2xl gap-2">
          <input
            ref={input}
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            className="min-h-11 min-w-0 flex-1 rounded-xl border border-border bg-background px-4 text-sm"
            placeholder="Ask about a cell…"
            aria-label="Question"
          />
          <button
            type="submit"
            disabled={busy || !question.trim()}
            className="min-h-11 rounded-xl bg-accent px-4 text-xs font-bold text-[#042f2e] disabled:opacity-40"
          >
            Ask
          </button>
        </div>
      </form>
    </div>,
    document.body
  );
}
