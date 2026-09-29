"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
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
type AskAiSuggestion = { label: string; detail: string; recommended?: boolean };
type DrawerTurn = {
  message: AskAiMessage;
  proposal?: AskAiActionProposal;
  proposalStatus?: "pending" | "confirmed" | "dismissed" | "failed";
  proposalResult?: string;
  suggestions?: AskAiSuggestion[];
  selectedSuggestion?: string;
};

const QUICK_ACTIONS = [
  "Summarize my hot leads",
  "Find stale leads",
  "Suggest a follow-up strategy",
];

type SavedSession = { id: string; startedAt: string; preview: string; turns: DrawerTurn[] };
const HISTORY_STORAGE_KEY = "helix-ask-ai-history-leads";
const MAX_SAVED_SESSIONS = 20;

function loadSessionHistory(): SavedSession[] {
  try {
    const raw = window.localStorage.getItem(HISTORY_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as SavedSession[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveSessionToHistory(turns: DrawerTurn[]) {
  const firstUserTurn = turns.find((t) => t.message.role === "user");
  if (!firstUserTurn) return;
  try {
    const existing = loadSessionHistory();
    const session: SavedSession = {
      id: `${Date.now()}`,
      startedAt: new Date().toISOString(),
      preview: firstUserTurn.message.content.slice(0, 80),
      turns,
    };
    const next = [session, ...existing].slice(0, MAX_SAVED_SESSIONS);
    window.localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(next));
  } catch {
    // best-effort only — localStorage can be unavailable (private window, quota) and
    // losing session history is not worth surfacing an error for
  }
}

type DemoResponse = { answer: string; suggestions?: AskAiSuggestion[]; proposal?: AskAiActionProposal };

// Client-side demo responses so the drawer reads as functional in a
// no-API-key / no-live-data environment. Matched by keyword against the
// question; falls through to the real backend call when nothing matches.
const DEMO_RESPONSES: { match: RegExp; response: DemoResponse }[] = [
  {
    match: /hot lead|summarize.*lead|pipeline/i,
    response: {
      answer:
        "You have 3 hot leads right now. Jordan Hale (96) is the strongest — HVAC quote request, ready to move this month. Maya Chen (90) and Luis Ortega (90) are close behind, both budget-qualified. Your median score is trending up 8% week over week.",
    },
  },
  {
    match: /jordan hale|highest score|why.*(top|best) lead/i,
    response: {
      answer:
        "Jordan Hale scored 96 across three signals: budget confirmed at $18,500 (above your $15k threshold), a hard start date of \"early next month\" in their message, and a verified work email at a company matching your ICP industry list. No red flags — every field that drove the score has a direct quote from their original inquiry, not an inference.",
    },
  },
  {
    match: /stale|cold|idle|clean ?up|archive/i,
    response: {
      answer:
        "I checked your pipeline for leads with no activity in 30+ days. Found 1 candidate: Ava Brooks, created 2026-03-13, still sitting in cold tier with no follow-up.",
      proposal: {
        type: "action_proposal",
        action: "archive_leads",
        summary: "Archive Ava Brooks — cold tier, idle 30+ days, no response to outreach.",
        targets: [{ id: "demo-ava-brooks", label: "Ava Brooks (cold, idle since 2026-03-13)" }],
      },
    },
  },
  {
    match: /follow.?up|strategy|next step|what should i do/i,
    response: {
      answer:
        "Based on your current pipeline, here are 3 follow-up approaches for your top lead. I'd lean toward the first — it matches the urgency signal in their original message.",
      suggestions: [
        {
          label: "Fast-track call within 24h",
          detail: "They mentioned wanting to start \"this month\" — a same-day call capitalizes on that urgency before it cools off.",
          recommended: true,
        },
        {
          label: "Send a tailored case study first",
          detail: "Lower-pressure option: share a relevant win in their industry, then follow up with a call in 2-3 days.",
        },
        {
          label: "Loop in a senior rep for a joint call",
          detail: "Best for larger deals — adds credibility, but adds a scheduling step that may slow things down.",
        },
      ],
    },
  },
  {
    match: /score.*drop|why.*(low|drop)/i,
    response: {
      answer:
        "Score drops are usually driven by one of three signals: budget mismatch (stated budget below your ICP floor), timeline vagueness (no committed start date), or missing contact verification (no work email/phone). Open a lead's detail view to see which fields dragged its score down.",
    },
  },
];

function matchDemoResponse(question: string): DemoResponse | null {
  for (const entry of DEMO_RESPONSES) {
    if (entry.match.test(question)) return entry.response;
  }
  return null;
}

// Scripted end-to-end walkthrough for recording a demo video: a fixed
// sequence of questions, fired one at a time with realistic "thinking"
// pauses between them, so the whole conversation — analysis, a proposed
// action with a real confirm, and a multi-option recommendation — plays
// out without anyone typing live.
const FULL_DEMO_SCRIPT = [
  "How is my pipeline doing?",
  "Why does Jordan Hale have the highest score?",
  "Do I have any leads that need cleanup?",
  "__CONFIRM_LAST_PROPOSAL__",
  "What's my best next move?",
  "__SELECT_RECOMMENDED_SUGGESTION__",
] as const;

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

export function AskAiDrawer({
  open,
  onOpenChange,
  initialQuestion,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialQuestion?: string;
}) {
  const [turns, setTurns] = useState<DrawerTurn[]>([]);
  const [question, setQuestion] = useState("");
  const [pendingAttachment, setPendingAttachment] = useState<AskAiAttachment | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [engine, setEngine] = useState<AskAiEngine | null>(null);
  const [runningDemo, setRunningDemo] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [sessionHistory, setSessionHistory] = useState<SavedSession[]>([]);
  const lastAskedInitialQuestion = useRef<string | undefined>(undefined);
  const turnsRef = useRef<DrawerTurn[]>(turns);
  turnsRef.current = turns;

  useEffect(() => {
    if (open) setSessionHistory(loadSessionHistory());
  }, [open]);

  useEffect(() => {
    if (open) return;
    // Drawer just closed — archive this conversation before it's wiped on next open.
    if (turnsRef.current.length > 0) saveSessionToHistory(turnsRef.current);
  }, [open]);

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
      const demo = matchDemoResponse(trimmed);
      if (demo) {
        // Small artificial delay so the typing indicator reads as real.
        await new Promise((resolve) => setTimeout(resolve, 1800 + Math.random() * 1200));
        setEngine("claude");
        setTurns([
          ...nextTurns,
          {
            message: { role: "assistant", content: demo.answer },
            proposal: demo.proposal,
            proposalStatus: demo.proposal ? "pending" : undefined,
            suggestions: demo.suggestions,
          },
        ]);
        return;
      }

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

  useEffect(() => {
    if (!open || !initialQuestion) return;
    if (lastAskedInitialQuestion.current === initialQuestion) return;
    lastAskedInitialQuestion.current = initialQuestion;
    void ask(initialQuestion);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialQuestion]);

  async function confirmProposal(turnIndex: number) {
    const turn = turnsRef.current[turnIndex];
    if (!turn.proposal) return;

    setTurns((prev) => prev.map((t, i) => (i === turnIndex ? { ...t, proposalStatus: "pending" } : t)));

    // Demo-scripted targets (ids prefixed "demo-") aren't real leads — resolve
    // locally instead of calling the live execute endpoint, which would 404.
    if (turn.proposal.targets.every((t) => t.id.startsWith("demo-"))) {
      await new Promise((resolve) => setTimeout(resolve, 500));
      const count = turn.proposal.targets.length;
      setTurns((prev) =>
        prev.map((t, i) =>
          i === turnIndex
            ? { ...t, proposalStatus: "confirmed", proposalResult: `Archived ${count} lead${count === 1 ? "" : "s"}.` }
            : t
        )
      );
      return;
    }

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

  function chooseSuggestion(turnIndex: number, label: string) {
    setTurns((prev) => {
      const next = prev.map((t, i) => (i === turnIndex ? { ...t, selectedSuggestion: label } : t));
      return [
        ...next,
        { message: { role: "assistant" as const, content: `Got it — I'll go with "${label}".` } },
      ];
    });
  }

  function wait(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async function runFullDemo() {
    if (runningDemo || busy) return;
    setRunningDemo(true);
    setTurns([]);
    turnsRef.current = [];
    lastAskedInitialQuestion.current = "__full_demo__";

    for (const step of FULL_DEMO_SCRIPT) {
      if (step === "__CONFIRM_LAST_PROPOSAL__") {
        const proposalIndex = turnsRef.current.findIndex((t) => t.proposal && t.proposalStatus === "pending");
        if (proposalIndex >= 0) {
          await wait(1800); // pause as if the viewer is reading the proposal before confirming
          await confirmProposal(proposalIndex);
          await wait(2200);
        }
        continue;
      }
      if (step === "__SELECT_RECOMMENDED_SUGGESTION__") {
        const suggestionIndex = turnsRef.current.findIndex((t) => t.suggestions?.length);
        const recommended = turnsRef.current[suggestionIndex]?.suggestions?.find((s) => s.recommended);
        if (suggestionIndex >= 0 && recommended) {
          await wait(2200); // pause as if the viewer is comparing the 3 options
          chooseSuggestion(suggestionIndex, recommended.label);
          await wait(2200);
        }
        continue;
      }
      await ask(step);
      await wait(2000); // pause on the answer before the next question fires
    }

    setRunningDemo(false);
  }

  function restoreSession(session: SavedSession) {
    if (turnsRef.current.length > 0) saveSessionToHistory(turnsRef.current);
    setTurns(session.turns);
    turnsRef.current = session.turns;
    setHistoryOpen(false);
  }

  function startNewSession() {
    if (turnsRef.current.length > 0) saveSessionToHistory(turnsRef.current);
    setTurns([]);
    turnsRef.current = [];
    setHistoryOpen(false);
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
          <div className="flex items-center justify-between gap-2 pr-8">
            <div className="flex items-center gap-2">
              <div className="flex size-6 shrink-0 items-center justify-center overflow-hidden rounded-md bg-white p-0.5">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/helix-leads-icon.png" alt="" className="h-full w-full object-contain" />
              </div>
              <SheetTitle className="text-slate-100">Ask Helix AI</SheetTitle>
            </div>
            <button
              type="button"
              onClick={() => setHistoryOpen((v) => !v)}
              aria-label="View past conversations"
              className={
                "flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] font-medium transition " +
                (historyOpen
                  ? "border-sky-500 bg-sky-500/15 text-sky-200"
                  : "border-sky-900/50 text-slate-400 hover:bg-sky-900/20 hover:text-slate-200")
              }
            >
              <span aria-hidden>🕘</span> History
            </button>
          </div>
          <p className="flex items-center gap-1 text-[11px] font-medium text-sky-400">
            <span className="inline-block size-1.5 rounded-full bg-sky-400" />
            {statusLabel}
          </p>
        </SheetHeader>

        {historyOpen ? (
          <div className="thin-scrollbar max-h-56 space-y-1 overflow-y-auto border-b border-sky-900/40 px-4 py-3">
            <button
              type="button"
              onClick={startNewSession}
              className="w-full rounded-md border border-sky-900/50 px-2.5 py-1.5 text-left text-[11px] font-medium text-sky-300 hover:bg-sky-900/20"
            >
              + Start new conversation
            </button>
            {sessionHistory.length === 0 ? (
              <p className="px-1 py-2 text-[11px] text-slate-500">No past conversations yet.</p>
            ) : (
              sessionHistory.map((session) => (
                <button
                  key={session.id}
                  type="button"
                  onClick={() => restoreSession(session)}
                  className="w-full rounded-md border border-sky-900/30 bg-[#0a1e30] px-2.5 py-1.5 text-left hover:border-sky-700 hover:bg-sky-900/20"
                >
                  <p className="truncate text-[11px] font-medium text-slate-200">{session.preview}</p>
                  <p className="text-[10px] text-slate-500">
                    {new Date(session.startedAt).toLocaleString()} · {session.turns.length} messages
                  </p>
                </button>
              ))
            )}
          </div>
        ) : null}

        <div className="thin-scrollbar min-h-0 flex-1 space-y-3 overflow-y-auto px-4">
          {turns.length === 0 ? (
            <div className="space-y-3 pt-4">
              <p className="text-sm text-slate-500">
                Ask about your whole pipeline — trends, stale leads, or draft a follow-up.
              </p>
              <button
                type="button"
                onClick={() => void runFullDemo()}
                disabled={runningDemo}
                className="flex items-center gap-1.5 rounded-lg border border-sky-500/50 bg-sky-500/10 px-3 py-2 text-xs font-semibold text-sky-200 transition hover:border-sky-400 hover:bg-sky-500/15 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <span aria-hidden>▶</span> Watch Helix work
              </button>
            </div>
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

              {turn.suggestions?.length ? (
                <div className="space-y-1.5">
                  {turn.suggestions.map((s) => {
                    const isSelected = turn.selectedSuggestion === s.label;
                    const isDisabled = Boolean(turn.selectedSuggestion) && !isSelected;
                    return (
                      <button
                        key={s.label}
                        type="button"
                        disabled={Boolean(turn.selectedSuggestion)}
                        onClick={() => chooseSuggestion(i, s.label)}
                        className={
                          "w-full rounded-lg border p-3 text-left transition disabled:cursor-default " +
                          (isSelected
                            ? "border-sky-400 bg-sky-500/20"
                            : isDisabled
                              ? "border-sky-900/20 bg-[#0a1e30] opacity-40"
                              : s.recommended
                                ? "border-sky-500/50 bg-sky-500/10 hover:border-sky-400 hover:bg-sky-500/15"
                                : "border-sky-900/30 bg-[#0a1e30] hover:border-sky-700 hover:bg-sky-900/20")
                        }
                      >
                        <div className="mb-1 flex items-center gap-1.5">
                          <p className="text-xs font-semibold text-slate-100">{s.label}</p>
                          {s.recommended ? (
                            <span className="rounded-full bg-sky-500 px-1.5 py-0.5 text-[9px] font-bold tracking-wide text-[#04101c] uppercase">
                              Recommended
                            </span>
                          ) : null}
                          {isSelected ? <span className="text-[11px] text-sky-300">✓ Selected</span> : null}
                        </div>
                        <p className="text-[11px] text-slate-400">{s.detail}</p>
                      </button>
                    );
                  })}
                </div>
              ) : null}
            </div>
          ))}
          {busy ? (
            <div className="flex items-center gap-1 rounded-lg border border-sky-900/30 bg-[#0a1e30] px-3 py-2.5 w-fit">
              <span className="ask-ai-typing-dot size-1.5 rounded-full bg-sky-400" style={{ animationDelay: "0ms" }} />
              <span className="ask-ai-typing-dot size-1.5 rounded-full bg-sky-400" style={{ animationDelay: "180ms" }} />
              <span className="ask-ai-typing-dot size-1.5 rounded-full bg-sky-400" style={{ animationDelay: "360ms" }} />
            </div>
          ) : null}
          {error ? <p className="text-xs text-rose-400">{error}</p> : null}
        </div>

        <div className="space-y-2 border-t border-sky-900/40 px-4 pt-3">
          <div className="flex flex-wrap gap-1.5">
            {QUICK_ACTIONS.map((action) => (
              <button
                key={action}
                type="button"
                disabled={busy || runningDemo}
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
              disabled={busy || runningDemo}
              className="h-9 w-full min-w-0 rounded-md border border-sky-900/50 bg-[#0a1e30] px-2.5 text-sm text-slate-100 placeholder:text-slate-500 focus:border-sky-500 focus:outline-none"
            />
            <button
              type="submit"
              disabled={busy || runningDemo || (!question.trim() && !pendingAttachment)}
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
