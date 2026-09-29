"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import type { DemoSuggestion } from "@/lib/demo-assistant";

type AskAiAttachment = { type: "image"; data: string; mediaType: string };
type AskAiMessage = { role: "user" | "assistant"; content: string; attachments?: AskAiAttachment[] };
type AskAiEngine = "claude" | "fallback";
type AskAiActionProposal = {
  type: "action_proposal";
  action: string;
  summary: string;
  targets: { id: string; label: string }[];
  stage?: string;
  note?: string;
};
type LeadSnapshot = { id: string } & Record<string, unknown>;
type ExecutedAction = {
  action: string;
  summary: string;
  targets: { id: string; label: string }[];
  done: string[];
  failed: { id: string; error: string }[];
  undo: LeadSnapshot[];
};
type ServerReply = {
  answer: string;
  engine: AskAiEngine;
  demo?: boolean;
  proposal?: AskAiActionProposal;
  suggestions?: DemoSuggestion[];
  executed?: ExecutedAction;
};
type DrawerTurn = {
  message: AskAiMessage;
  proposal?: AskAiActionProposal;
  proposalStatus?: "pending" | "confirmed" | "dismissed" | "failed";
  proposalResult?: string;
  suggestions?: DemoSuggestion[];
  selectedSuggestion?: string;
  executed?: ExecutedAction;
  undone?: boolean;
};

const QUICK_ACTIONS = [
  "Summarize my pipeline",
  "Clean up my stale leads",
  "What's in my review queue?",
  "What's my best next move?",
];

// Scripted walkthrough for recording. Questions go through the real /api/ask-ai route
// and the confirm/select steps run the real execute route, so every step changes real
// (sandbox) lead data and the dashboard behind the drawer reacts.
const FULL_DEMO_SCRIPT = [
  "How is my pipeline doing?",
  "Why does Jordan Hale have the highest score?",
  "What's waiting in my review queue?",
  "__CONFIRM_LAST_PROPOSAL__",
  "Clean up my stale leads",
  "__CONFIRM_LAST_PROPOSAL__",
  "What's my best next move?",
  "__SELECT_RECOMMENDED_SUGGESTION__",
] as const;

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

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

type ExecutePayload = { action: string; targetIds: string[]; stage?: string; note?: string; snapshots?: LeadSnapshot[] };

async function executeAction(payload: ExecutePayload): Promise<{ done: string[]; failed: { id: string; error: string }[] }> {
  const res = await fetch("/api/ask-ai/execute", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = (await res.json()) as { done?: string[]; failed?: { id: string; error: string }[]; error?: string };
  if (!res.ok) throw new Error(data.error ?? `Execute failed (${res.status})`);
  return { done: data.done ?? [], failed: data.failed ?? [] };
}

function plainName(label: string) {
  return label.replace(/\s*\(.*\)\s*$/, "");
}

const ACTION_VERB: Record<string, string> = {
  archive_leads: "archived",
  approve_leads: "approved",
  advance_stage: "moved to Contacted:",
  add_note: "added a note to",
  restore: "restored",
};

/** Tells the dashboard behind the drawer that data changed, so it can refresh and react. */
function announceAiAction(action: string, targets: { id: string; label: string }[]) {
  const names = targets.map((t) => plainName(t.label)).join(", ");
  window.dispatchEvent(
    new CustomEvent("helix:ai-action", {
      detail: { message: `Helix AI ${ACTION_VERB[action] ?? "updated"} ${names}`, ids: targets.map((t) => t.id) },
    })
  );
  window.dispatchEvent(new CustomEvent("helix:leads-refresh"));
}

function resultText(action: string, done: number, failed: number, targets: { label: string }[]) {
  const failedNote = failed ? ` ${failed} failed.` : "";
  if (action === "archive_leads") return `Archived ${done} lead${done === 1 ? "" : "s"}.${failedNote}`;
  if (action === "approve_leads") return `Approved ${done} lead${done === 1 ? "" : "s"} — review flag cleared, sign-off recorded.${failedNote}`;
  if (action === "add_note") return `Note added to ${targets.map((t) => plainName(t.label)).join(", ")}.${failedNote}`;
  return `Moved ${targets.map((t) => plainName(t.label)).join(", ")} to Contacted and logged the play.${failedNote}`;
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
  const [isSandbox, setIsSandbox] = useState(false);
  const lastAskedInitialQuestion = useRef<string | undefined>(undefined);
  const turnsRef = useRef<DrawerTurn[]>(turns);
  turnsRef.current = turns;

  function commitTurns(next: DrawerTurn[]) {
    turnsRef.current = next;
    setTurns(next);
  }

  function patchTurn(index: number, patch: Partial<DrawerTurn>) {
    commitTurns(turnsRef.current.map((t, i) => (i === index ? { ...t, ...patch } : t)));
  }

  useEffect(() => {
    if (!open) return;
    setSessionHistory(loadSessionHistory());
    fetch("/api/settings/desk")
      .then((r) => r.json())
      .then((d: { sandbox?: boolean }) => setIsSandbox(Boolean(d.sandbox)))
      .catch(() => setIsSandbox(false));
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
    const nextTurns: DrawerTurn[] = [...turnsRef.current, { message: userMessage }];
    commitTurns(nextTurns);

    try {
      const res = await fetch("/api/ask-ai", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ mode: "drawer", history: nextTurns.map((t) => t.message) }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? `Ask AI request failed (${res.status})`);
      }
      const data = (await res.json()) as ServerReply;
      // The sandbox assistant answers instantly; pause so the typing indicator reads as thinking.
      if (data.demo) await wait(1400 + Math.random() * 1100);
      setEngine(data.engine);
      commitTurns([
        ...nextTurns,
        {
          message: { role: "assistant", content: data.answer },
          proposal: data.proposal,
          proposalStatus: data.proposal ? "pending" : undefined,
          suggestions: data.suggestions,
          executed: data.executed,
        },
      ]);
      if (data.executed?.done.length) {
        announceAiAction(data.executed.action, data.executed.targets.filter((t) => data.executed!.done.includes(t.id)));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ask AI request failed");
      commitTurns(nextTurns.slice(0, -1));
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
    const proposal = turnsRef.current[turnIndex]?.proposal;
    if (!proposal) return;
    patchTurn(turnIndex, { proposalStatus: "pending" });
    try {
      const { done, failed } = await executeAction({
        action: proposal.action,
        targetIds: proposal.targets.map((t) => t.id),
        stage: proposal.stage,
        note: proposal.note,
      });
      patchTurn(turnIndex, {
        proposalStatus: "confirmed",
        proposalResult: resultText(proposal.action, done.length, failed.length, proposal.targets),
      });
      if (done.length) announceAiAction(proposal.action, proposal.targets.filter((t) => done.includes(t.id)));
    } catch (err) {
      patchTurn(turnIndex, {
        proposalStatus: "failed",
        proposalResult: err instanceof Error ? err.message : "Execute failed",
      });
    }
  }

  async function undoExecuted(turnIndex: number) {
    const ex = turnsRef.current[turnIndex]?.executed;
    if (!ex || turnsRef.current[turnIndex].undone) return;
    try {
      const { done } = await executeAction({ action: "restore", targetIds: [], snapshots: ex.undo });
      if (done.length) {
        patchTurn(turnIndex, { undone: true });
        window.dispatchEvent(
          new CustomEvent("helix:ai-action", {
            detail: { message: `Helix AI undid: ${ex.summary}`, ids: done },
          })
        );
        window.dispatchEvent(new CustomEvent("helix:leads-refresh"));
      } else setError("Could not undo — the lead may have changed.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Undo failed");
    }
  }

  function dismissProposal(turnIndex: number) {
    patchTurn(turnIndex, { proposalStatus: "dismissed" });
  }

  async function chooseSuggestion(turnIndex: number, suggestion: DemoSuggestion) {
    patchTurn(turnIndex, { selectedSuggestion: suggestion.label });
    const { action, stage, targetIds, note } = suggestion.action;
    const targets = targetIds.map((id) => ({ id, label: id }));
    try {
      const { done, failed } = await executeAction({ action, targetIds, stage, note });
      const label = suggestion.action.targetIds.length ? await leadNameFor(targetIds[0]) : "the lead";
      const named = targets.map((t) => ({ ...t, label }));
      commitTurns([
        ...turnsRef.current,
        {
          message: {
            role: "assistant",
            content: done.length
              ? `Done — I'll go with “${suggestion.label}”. ${resultText(action, done.length, failed.length, named)}`
              : `I couldn't apply “${suggestion.label}”: ${failed[0]?.error ?? "unknown error"}.`,
          },
        },
      ]);
      if (done.length) announceAiAction(action, named);
    } catch (err) {
      commitTurns([
        ...turnsRef.current,
        { message: { role: "assistant", content: `I couldn't apply that: ${err instanceof Error ? err.message : "unknown error"}.` } },
      ]);
    }
  }

  async function leadNameFor(id: string): Promise<string> {
    try {
      const res = await fetch(`/api/leads/${id}`);
      const data = (await res.json()) as { lead?: { name?: string } };
      return data.lead?.name ?? "the lead";
    } catch {
      return "the lead";
    }
  }

  async function resetDemo() {
    if (busy || runningDemo) return;
    if (turnsRef.current.length > 0) saveSessionToHistory(turnsRef.current);
    commitTurns([]);
    setError(null);
    setHistoryOpen(false);
    await fetch("/api/settings/desk", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "demo" }),
    });
    window.dispatchEvent(new CustomEvent("helix:leads-refresh"));
  }

  async function runFullDemo() {
    if (runningDemo || busy) return;
    setRunningDemo(true);
    try {
      // Start every recording from the same seed so the walkthrough is repeatable.
      await resetDemo();
      lastAskedInitialQuestion.current = "__full_demo__";
      await wait(600);

      for (const step of FULL_DEMO_SCRIPT) {
        if (step === "__CONFIRM_LAST_PROPOSAL__") {
          let idx = -1;
          turnsRef.current.forEach((t, i) => {
            if (t.proposal && t.proposalStatus === "pending") idx = i;
          });
          if (idx >= 0) {
            await wait(1800); // as if the viewer is reading the proposal before confirming
            await confirmProposal(idx);
            await wait(2600); // let the dashboard react before the next question
          }
          continue;
        }
        if (step === "__SELECT_RECOMMENDED_SUGGESTION__") {
          const idx = turnsRef.current.findIndex((t) => t.suggestions?.length && !t.selectedSuggestion);
          const recommended = turnsRef.current[idx]?.suggestions?.find((s) => s.recommended);
          if (idx >= 0 && recommended) {
            await wait(2200); // as if the viewer is comparing the options
            await chooseSuggestion(idx, recommended);
            await wait(2200);
          }
          continue;
        }
        await ask(step);
        await wait(2000);
      }
    } finally {
      setRunningDemo(false);
    }
  }

  function restoreSession(session: SavedSession) {
    if (turnsRef.current.length > 0) saveSessionToHistory(turnsRef.current);
    commitTurns(session.turns);
    setHistoryOpen(false);
  }

  function startNewSession() {
    if (turnsRef.current.length > 0) saveSessionToHistory(turnsRef.current);
    commitTurns([]);
    setHistoryOpen(false);
  }

  async function onAttachChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      setPendingAttachment(await readImageAsAttachment(file));
    } catch {
      setError("Could not read the attached image.");
    }
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    void ask(question);
  }

  const statusLabel = busy
    ? "Listening"
    : isSandbox
      ? "Demo workspace"
      : engine === "fallback"
        ? "Limited Mode"
        : "Online & Ready";

  return (
    <Sheet open={open} onOpenChange={onOpenChange} modal={false} disablePointerDismissal>
      <SheetContent
        side="right"
        showOverlay={false}
        className="flex h-full w-full min-h-0 flex-col overflow-hidden border-l border-sky-900/40 bg-[#04101c] sm:max-w-md"
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
            <div className="flex items-center gap-1.5">
              {isSandbox ? (
                <button
                  type="button"
                  onClick={() => void resetDemo()}
                  disabled={busy || runningDemo}
                  aria-label="Reset demo data"
                  className="flex items-center gap-1 rounded-md border border-sky-900/50 px-2 py-1 text-[11px] font-medium text-slate-400 transition hover:bg-sky-900/20 hover:text-slate-200 disabled:opacity-50"
                >
                  <span aria-hidden>↺</span> Reset demo
                </button>
              ) : null}
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
                Ask about your whole pipeline — trends, stale leads, or the review queue. Confirmed actions update the dashboard live.
              </p>
              {isSandbox ? (
                <button
                  type="button"
                  onClick={() => void runFullDemo()}
                  disabled={runningDemo}
                  className="flex items-center gap-1.5 rounded-lg border border-sky-500/50 bg-sky-500/10 px-3 py-2 text-xs font-semibold text-sky-200 transition hover:border-sky-400 hover:bg-sky-500/15 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <span aria-hidden>▶</span> Watch Helix work
                </button>
              ) : null}
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

              {turn.executed ? (
                <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3">
                  <p className="mb-1 text-xs font-semibold text-emerald-200">
                    {turn.undone ? "Undone" : turn.executed.done.length ? "Done automatically" : "Could not apply"}
                  </p>
                  <p className="mb-2 text-xs text-slate-300">
                    {turn.executed.done.length
                      ? resultText(turn.executed.action, turn.executed.done.length, turn.executed.failed.length, turn.executed.targets)
                      : turn.executed.failed[0]?.error ?? "Unknown error"}
                  </p>
                  {turn.executed.done.length && !turn.undone ? (
                    <button
                      type="button"
                      onClick={() => void undoExecuted(i)}
                      className="rounded-md border border-emerald-500/40 px-3 py-1 text-[11px] font-semibold text-emerald-200 hover:bg-emerald-500/10"
                    >
                      Undo
                    </button>
                  ) : null}
                </div>
              ) : null}

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
                        onClick={() => void chooseSuggestion(i, s)}
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
