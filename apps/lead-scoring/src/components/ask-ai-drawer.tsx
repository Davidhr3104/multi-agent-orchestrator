"use client";

import { useState, type FormEvent } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";

type AskAiAttachment = { type: "image"; data: string; mediaType: string };
type AskAiMessage = { role: "user" | "assistant"; content: string; attachments?: AskAiAttachment[] };
type AskAiEngine = "claude" | "fallback";
type AskAiActionProposal = {
  type: "action_proposal";
  action: string;
  summary: string;
  targets: { id: string; label: string }[];
};
type DrawerTurn = {
  message: AskAiMessage;
  proposal?: AskAiActionProposal;
  proposalStatus?: "pending" | "confirmed" | "dismissed" | "failed";
  proposalResult?: string;
};

const QUICK_ACTIONS = [
  "Summarize my hot leads",
  "Find stale leads",
  "Draft a follow-up for my top lead",
];

function readImageAsAttachment(file: File): Promise<AskAiAttachment> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const base64 = result.split(",")[1] ?? "";
      resolve({ type: "image", data: base64, mediaType: file.type || "image/png" });
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export function AskAiDrawer({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const [turns, setTurns] = useState<DrawerTurn[]>([]);
  const [question, setQuestion] = useState("");
  const [pendingAttachment, setPendingAttachment] = useState<AskAiAttachment | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [engine, setEngine] = useState<AskAiEngine | null>(null);

  async function ask(text: string) {
    const trimmed = text.trim();
    if ((!trimmed && !pendingAttachment) || busy) return;

    setError(null);
    setBusy(true);
    setQuestion("");

    const attachments = pendingAttachment ? [pendingAttachment] : undefined;
    setPendingAttachment(null);

    const userMessage: AskAiMessage = { role: "user", content: trimmed, attachments };
    const nextTurns = [...turns, { message: userMessage }];
    setTurns(nextTurns);

    try {
      const res = await fetch("/api/ask-ai", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          mode: "drawer",
          history: nextTurns.map((t) => t.message),
        }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? `Ask AI request failed (${res.status})`);
      }
      const data = (await res.json()) as {
        answer: string;
        engine: AskAiEngine;
        proposal?: AskAiActionProposal;
      };
      setEngine(data.engine);
      setTurns([
        ...nextTurns,
        {
          message: { role: "assistant", content: data.answer },
          proposal: data.proposal,
          proposalStatus: data.proposal ? "pending" : undefined,
        },
      ]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ask AI request failed");
      setTurns(turns);
    } finally {
      setBusy(false);
    }
  }

  async function confirmProposal(turnIndex: number) {
    const turn = turns[turnIndex];
    if (!turn.proposal) return;

    setTurns((prev) => prev.map((t, i) => (i === turnIndex ? { ...t, proposalStatus: "pending" } : t)));

    try {
      const res = await fetch("/api/ask-ai/execute", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: turn.proposal.action,
          targetIds: turn.proposal.targets.map((t) => t.id),
        }),
      });
      const data = (await res.json()) as { archived?: string[]; failed?: { id: string; error: string }[]; error?: string };
      if (!res.ok) throw new Error(data.error ?? `Execute failed (${res.status})`);

      const archivedCount = data.archived?.length ?? 0;
      const failedCount = data.failed?.length ?? 0;
      const resultText =
        failedCount === 0
          ? `Archived ${archivedCount} lead${archivedCount === 1 ? "" : "s"}.`
          : `Archived ${archivedCount}, ${failedCount} failed.`;

      setTurns((prev) =>
        prev.map((t, i) =>
          i === turnIndex ? { ...t, proposalStatus: "confirmed", proposalResult: resultText } : t
        )
      );
    } catch (err) {
      setTurns((prev) =>
        prev.map((t, i) =>
          i === turnIndex
            ? {
                ...t,
                proposalStatus: "failed",
                proposalResult: err instanceof Error ? err.message : "Execute failed",
              }
            : t
        )
      );
    }
  }

  function dismissProposal(turnIndex: number) {
    setTurns((prev) => prev.map((t, i) => (i === turnIndex ? { ...t, proposalStatus: "dismissed" } : t)));
  }

  async function onAttachChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      const attachment = await readImageAsAttachment(file);
      setPendingAttachment(attachment);
    } catch {
      setError("Could not read the attached image.");
    }
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    void ask(question);
  }

  const statusLabel = busy ? "Listening" : engine === "fallback" ? "Limited Mode" : "Online & Ready";

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex w-full flex-col border-l border-sky-900/40 bg-[#04101c] sm:max-w-md"
      >
        <SheetHeader className="border-b border-sky-900/40 pb-3">
          <div className="flex items-center gap-2">
            <span className="rounded-full border border-sky-900/50 px-2 py-0.5 text-[10px] font-bold tracking-wider text-sky-300 uppercase">
              Copilot
            </span>
            <SheetTitle className="text-slate-100">Ask Helix AI</SheetTitle>
          </div>
          <p className="flex items-center gap-1 text-[11px] font-medium text-sky-400">
            <span className="inline-block size-1.5 rounded-full bg-sky-400" />
            {statusLabel}
          </p>
        </SheetHeader>

        <div className="flex-1 space-y-3 overflow-y-auto px-4">
          {turns.length === 0 ? (
            <p className="pt-4 text-sm text-slate-500">
              Ask about your whole pipeline — trends, stale leads, or draft a follow-up.
            </p>
          ) : null}
          {turns.map((turn, i) => (
            <div key={i} className="space-y-2">
              <div
                className={
                  turn.message.role === "user"
                    ? "ml-auto max-w-[85%] rounded-lg bg-sky-500/15 px-3 py-2 text-sm text-sky-100"
                    : "max-w-[90%] rounded-lg border border-sky-900/30 bg-[#0a1e30] px-3 py-2 text-sm whitespace-pre-line text-slate-200"
                }
              >
                {turn.message.attachments?.length ? (
                  <p className="mb-1 text-[10px] text-sky-400">📎 attached image</p>
                ) : null}
                {turn.message.content}
              </div>

              {turn.proposal ? (
                <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3">
                  <p className="mb-2 text-xs font-semibold text-amber-200">Proposed action</p>
                  <ul className="mb-2 space-y-0.5 text-xs text-slate-300">
                    {turn.proposal.targets.map((t) => (
                      <li key={t.id}>• {t.label}</li>
                    ))}
                  </ul>
                  {turn.proposalStatus === "pending" ? (
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => void confirmProposal(i)}
                        className="rounded-md bg-amber-500 px-3 py-1 text-[11px] font-semibold text-[#0B0F19] hover:bg-amber-400"
                      >
                        Confirm
                      </button>
                      <button
                        type="button"
                        onClick={() => dismissProposal(i)}
                        className="rounded-md border border-sky-900/50 px-3 py-1 text-[11px] text-slate-300 hover:bg-sky-900/20"
                      >
                        Dismiss
                      </button>
                    </div>
                  ) : turn.proposalStatus === "confirmed" ? (
                    <p className="text-[11px] font-medium text-emerald-300">✓ {turn.proposalResult}</p>
                  ) : turn.proposalStatus === "failed" ? (
                    <p className="text-[11px] font-medium text-rose-400">{turn.proposalResult}</p>
                  ) : (
                    <p className="text-[11px] text-slate-500">Dismissed.</p>
                  )}
                </div>
              ) : null}
            </div>
          ))}
          {busy ? <p className="text-sm text-slate-500">Thinking…</p> : null}
          {error ? <p className="text-xs text-rose-400">{error}</p> : null}
        </div>

        <div className="space-y-2 border-t border-sky-900/40 px-4 pt-3">
          <div className="flex flex-wrap gap-1.5">
            {QUICK_ACTIONS.map((action) => (
              <button
                key={action}
                type="button"
                disabled={busy}
                onClick={() => void ask(action)}
                className="rounded-full border border-sky-900/50 px-2.5 py-1 text-[11px] text-slate-300 hover:bg-sky-900/20 disabled:opacity-50"
              >
                {action}
              </button>
            ))}
          </div>

          {pendingAttachment ? (
            <div className="flex items-center gap-2 rounded-md border border-sky-900/40 bg-[#0a1e30] px-2 py-1 text-[11px] text-slate-300">
              📎 image attached
              <button type="button" onClick={() => setPendingAttachment(null)} className="text-slate-500 hover:text-slate-200">
                ×
              </button>
            </div>
          ) : null}

          <form onSubmit={onSubmit} className="flex items-center gap-2">
            <label className="flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-md border border-sky-900/50 text-slate-400 hover:bg-sky-900/20">
              📎
              <input type="file" accept="image/*" className="hidden" onChange={(e) => void onAttachChange(e)} />
            </label>
            <input
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="Ask Helix AI to summarize, find, or draft…"
              disabled={busy}
              className="h-9 w-full min-w-0 rounded-md border border-sky-900/50 bg-[#0a1e30] px-2.5 text-sm text-slate-100 placeholder:text-slate-500 focus:border-sky-500 focus:outline-none"
            />
            <button
              type="submit"
              disabled={busy || (!question.trim() && !pendingAttachment)}
              className="shrink-0 rounded-md bg-sky-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-sky-400 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Send
            </button>
          </form>

          <p className="pb-3 text-[10px] text-slate-500">
            Helix AI can make mistakes. Review the information before acting.
          </p>
        </div>
      </SheetContent>
    </Sheet>
  );
}
