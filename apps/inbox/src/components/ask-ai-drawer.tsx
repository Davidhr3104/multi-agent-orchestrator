"use client";

import { useEffect, useRef, useState, type CSSProperties, type FormEvent } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { ErrorText, isOperatorLocked, OPERATOR_HINT } from "@/components/operator-notice";

type Attachment = { type: "image"; data: string; mediaType: string };
type Engine = "claude" | "fallback";
type Target = { id: string; label: string };
type Params = Record<string, unknown>;
type UndoEntry = { action: string; id: string; data: unknown };
type Proposal = { action: string; summary: string; targets: Target[]; params?: Params };
type Executed = {
  action: string;
  summary: string;
  targets: Target[];
  done: string[];
  failed: { id: string; error: string }[];
  undo: UndoEntry[];
  resultText: string;
  announce: string;
  undoable?: boolean;
};
type Suggestion = { label: string; detail: string; recommended?: boolean; action: { action: string; targetIds: string[]; params?: Params } };
type AgentStepView = { tool: string; summary: string; status: "executed" | "failed" | "denied"; error?: string; reasons?: string[] };
type AgentPending = { tool: string; summary: string; reasons: string[]; preview?: { to: string; text: string }; state: string | null };
type AgentInfo = { steps: AgentStepView[]; truncated: boolean; pending?: AgentPending };
type ServerReply = {
  answer: string;
  engine: Engine;
  demo?: boolean;
  proposal?: Proposal;
  reasons?: string[];
  executed?: Executed;
  suggestions?: Suggestion[];
  agent?: AgentInfo;
};
type Turn = {
  role: "user" | "assistant";
  content: string;
  attachments?: Attachment[];
  proposal?: Proposal;
  reasons?: string[];
  proposalStatus?: "pending" | "confirmed" | "dismissed" | "failed";
  proposalResult?: string;
  executed?: Executed;
  undone?: boolean;
  suggestions?: Suggestion[];
  selectedSuggestion?: string;
  agent?: AgentInfo;
  agentStatus?: "pending" | "approved" | "declined" | "failed";
  agentError?: string;
};
type SavedSession = { id: string; startedAt: string; preview: string; turns: Turn[] };

const THEME = {
  key: "inbox",
  icon: "/helix-inbox-icon.png",
  emptyHint: "Ask about your inbox, or tell me what to do — draft a reply, snooze, archive or send.",
  quick: ["What's urgent right now?","Which emails need a reply?","What can I ignore?","Draft a reply to Maya Chen"] as string[],
  demoScript: ["What's urgent right now?","Which emails need a reply?","Draft a reply to Maya Chen","Snooze Priya Shah's email","Archive the HVAC Weekly newsletter","Send Maya Chen the reply","__CONFIRM_LAST_PROPOSAL__"] as string[],
  vars: {
    "--ai-accent": "#8b5cf6",
    "--ai-accent-soft": "rgba(139,92,246,0.18)",
    "--ai-accent-ink": "#ffffff",
    "--ai-bg": "#0c0818",
    "--ai-panel": "#171029",
    "--ai-border": "rgba(139,92,246,0.28)",
  } as CSSProperties,
};

// Demo-script markers: run the real confirm / pick-suggestion path, exactly as a person would click.
const CONFIRM = "__CONFIRM_LAST_PROPOSAL__";
const PICK = "__SELECT_RECOMMENDED_SUGGESTION__";

const HISTORY_KEY = `helix-ask-ai-history-${THEME.key}`;
const MAX_SESSIONS = 20;

function loadSessions(): SavedSession[] {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(HISTORY_KEY) ?? "[]") as SavedSession[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveSession(turns: Turn[]) {
  const first = turns.find((t) => t.role === "user");
  if (!first) return;
  try {
    const next: SavedSession = { id: `${Date.now()}`, startedAt: new Date().toISOString(), preview: first.content.slice(0, 80), turns };
    window.localStorage.setItem(HISTORY_KEY, JSON.stringify([next, ...loadSessions()].slice(0, MAX_SESSIONS)));
  } catch {
    // best-effort only — localStorage can be unavailable (private window, quota)
  }
}

function readImage(file: File): Promise<Attachment> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve({ type: "image", data: (reader.result as string).split(",")[1] ?? "", mediaType: file.type || "image/png" });
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

type ExecuteResponse = Partial<Executed> & { error?: string; done?: string[] };

async function callExecute(body: Record<string, unknown>): Promise<ExecuteResponse> {
  const res = await fetch("/api/ask-ai/execute", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const data = (await res.json()) as ExecuteResponse;
  if (!res.ok) throw new Error(data.error ?? `Execute failed (${res.status})`);
  return data;
}

/** Tells the dashboard behind the panel that data changed, so it can refresh and react. */
function announce(message: string, ids: string[]) {
  window.dispatchEvent(new CustomEvent("helix:ai-action", { detail: { message, ids } }));
  window.dispatchEvent(new CustomEvent("helix:desk-refresh"));
  window.dispatchEvent(new CustomEvent("helix:leads-refresh"));
}

export function AskAiDrawer({
  open,
  onOpenChange,
  initialQuestion,
  seed,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialQuestion?: string;
  seed?: number;
}) {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [narrow, setNarrow] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    const sync = () => setNarrow(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);
  const [question, setQuestion] = useState("");
  const [attachment, setAttachment] = useState<Attachment | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [engine, setEngine] = useState<Engine | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [sessions, setSessions] = useState<SavedSession[]>([]);
  const [isDemo, setIsDemo] = useState(false);
  const [runningDemo, setRunningDemo] = useState(false);
  const [usage, setUsage] = useState<{ calls: number; inputTokens: number; outputTokens: number; estimatedUsd: number } | null>(null);
  const turnsRef = useRef<Turn[]>(turns);
  const lastInitial = useRef<string | undefined>(undefined);
  const bottomRef = useRef<HTMLDivElement>(null);

  function commit(next: Turn[]) {
    turnsRef.current = next;
    setTurns(next);
  }
  function patch(index: number, p: Partial<Turn>) {
    commit(turnsRef.current.map((t, i) => (i === index ? { ...t, ...p } : t)));
  }

  useEffect(() => {
    if (open) {
      setSessions(loadSessions());
      fetch("/api/settings/desk")
        .then((r) => r.json())
        .then((d: { mode?: string; demo?: boolean }) => setIsDemo(d.mode === "demo" || Boolean(d.demo && d.mode === undefined)))
        .catch(() => setIsDemo(false));
    } else if (turnsRef.current.length > 0) saveSession(turnsRef.current);
  }, [open]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [turns, busy]);

  useEffect(() => {
    if (!open || busy) return;
    fetch("/api/ai-usage")
      .then((r) => r.json())
      .then((d: { calls: number; inputTokens: number; outputTokens: number; estimatedUsd: number }) => setUsage(d))
      .catch(() => setUsage(null));
  }, [open, busy]);

  async function ask(text: string) {
    const trimmed = text.trim();
    if ((!trimmed && !attachment) || busy) return;
    setError(null);
    setBusy(true);
    setQuestion("");
    const attachments = attachment ? [attachment] : undefined;
    setAttachment(null);

    const next: Turn[] = [...turnsRef.current, { role: "user", content: trimmed, attachments }];
    commit(next);
    try {
      const res = await fetch("/api/ask-ai", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ mode: "drawer", history: next.map((t) => ({ role: t.role, content: t.content, attachments: t.attachments })) }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? `Ask AI request failed (${res.status})`);
      }
      const data = (await res.json()) as ServerReply;
      // The demo assistant answers instantly; pause so the typing indicator reads as thinking.
      if (data.demo) await wait(1200 + Math.random() * 900);
      setEngine(data.engine);
      commit([
        ...next,
        {
          role: "assistant",
          content: data.answer,
          proposal: data.proposal,
          reasons: data.reasons,
          proposalStatus: data.proposal ? "pending" : undefined,
          executed: data.executed,
          suggestions: data.suggestions,
          agent: data.agent,
          agentStatus: data.agent?.pending ? "pending" : undefined,
        },
      ]);
      if (data.executed?.done.length) announce(data.executed.announce, data.executed.done);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ask AI request failed");
      commit(next.slice(0, -1));
    } finally {
      setBusy(false);
    }
  }

  async function decideAgent(i: number, approved: boolean) {
    const pending = turnsRef.current[i]?.agent?.pending;
    if (!pending?.state || busy) return;
    setBusy(true);
    try {
      const res = await fetch("/api/ask-ai/agent", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ state: pending.state, approved }),
      });
      const data = (await res.json()) as ServerReply & { error?: string };
      if (!res.ok) throw new Error(data.error ?? `Ask Helix failed (${res.status})`);
      patch(i, { agentStatus: approved ? "approved" : "declined" });
      commit([
        ...turnsRef.current,
        {
          role: "assistant",
          content: data.answer,
          executed: data.executed,
          agent: data.agent,
          agentStatus: data.agent?.pending ? "pending" : undefined,
        },
      ]);
      if (data.executed?.done.length) announce(data.executed.announce, data.executed.done);
      window.dispatchEvent(new CustomEvent("helix:desk-refresh"));
    } catch (err) {
      patch(i, { agentStatus: "failed", agentError: err instanceof Error ? err.message : "Ask Helix failed" });
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    if (!open || !initialQuestion) return;
    const key = `${seed ?? 0}:${initialQuestion}`;
    if (lastInitial.current === key) return;
    lastInitial.current = key;
    void ask(initialQuestion);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialQuestion, seed]);

  async function confirm(i: number) {
    const p = turnsRef.current[i]?.proposal;
    if (!p) return;
    try {
      const r = await callExecute({ action: p.action, targetIds: p.targets.map((t) => t.id), params: p.params, labels: p.targets.map((t) => t.label) });
      patch(i, { proposalStatus: "confirmed", proposalResult: r.resultText ?? "Done." });
      if (r.done?.length) announce(r.announce ?? p.summary, r.done);
    } catch (err) {
      patch(i, { proposalStatus: "failed", proposalResult: err instanceof Error ? err.message : "Execute failed" });
    }
  }

  async function chooseSuggestion(i: number, s: Suggestion) {
    patch(i, { selectedSuggestion: s.label });
    try {
      const r = await callExecute({ action: s.action.action, targetIds: s.action.targetIds, params: s.action.params, labels: [s.label] });
      commit([
        ...turnsRef.current,
        { role: "assistant", content: r.done?.length ? `Done — I'll go with “${s.label}”. ${r.resultText ?? ""}` : `I couldn't apply “${s.label}”: ${r.failed?.[0]?.error ?? "unknown error"}.` },
      ]);
      if (r.done?.length) announce(r.announce ?? s.label, r.done);
    } catch (err) {
      const message = err instanceof Error ? err.message : "unknown error";
      commit([...turnsRef.current, { role: "assistant", content: isOperatorLocked(message) ? OPERATOR_HINT : `I couldn't apply that: ${message}.` }]);
    }
  }

  async function undo(i: number) {
    const ex = turnsRef.current[i]?.executed;
    if (!ex || turnsRef.current[i].undone) return;
    try {
      const r = await callExecute({ action: "restore", entries: ex.undo });
      if (r.done?.length) {
        patch(i, { undone: true });
        announce(`Helix AI undid: ${ex.summary}`, r.done);
      } else setError("Could not undo — the record may have changed.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Undo failed");
    }
  }

  async function resetDemo() {
    if (busy || runningDemo) return;
    if (turnsRef.current.length > 0) saveSession(turnsRef.current);
    commit([]);
    setError(null);
    setHistoryOpen(false);
    try {
      const res = await fetch("/api/settings/desk", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "demo" }) });
      if (!res.ok) throw new Error(((await res.json().catch(() => null)) as { error?: string } | null)?.error ?? `Reset failed (${res.status})`);
      window.dispatchEvent(new CustomEvent("helix:desk-refresh"));
      window.dispatchEvent(new CustomEvent("helix:leads-refresh"));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Reset failed");
    }
  }

  async function runDemo() {
    if (runningDemo || busy) return;
    setRunningDemo(true);
    try {
      await resetDemo();
      lastInitial.current = "__demo__";
      await wait(600);
      for (const step of THEME.demoScript) {
        if (step === CONFIRM) {
          let idx = -1;
          turnsRef.current.forEach((t, i) => {
            if (t.proposal && t.proposalStatus === "pending") idx = i;
          });
          if (idx >= 0) {
            await wait(1800); // as if the viewer is reading the proposal before confirming
            await confirm(idx);
            await wait(2600); // let the dashboard react before the next question
          }
          continue;
        }
        if (step === PICK) {
          const idx = turnsRef.current.findIndex((t) => t.suggestions?.length && !t.selectedSuggestion);
          const rec = turnsRef.current[idx]?.suggestions?.find((s) => s.recommended);
          if (idx >= 0 && rec) {
            await wait(2200);
            await chooseSuggestion(idx, rec);
            await wait(2200);
          }
          continue;
        }
        await ask(step);
        await wait(2400);
      }
    } finally {
      setRunningDemo(false);
    }
  }

  function startNew() {
    if (turnsRef.current.length > 0) saveSession(turnsRef.current);
    commit([]);
    setHistoryOpen(false);
  }
  function restore(s: SavedSession) {
    if (turnsRef.current.length > 0) saveSession(turnsRef.current);
    commit(s.turns);
    setHistoryOpen(false);
  }
  async function onAttach(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      setAttachment(await readImage(file));
    } catch {
      setError("Could not read the attached image.");
    }
  }
  function onSubmit(e: FormEvent) {
    e.preventDefault();
    void ask(question);
  }

  const status = busy ? "Listening" : isDemo ? "Demo workspace" : engine === "fallback" ? "Limited Mode" : "Online & Ready";
  const border = "border-[color:var(--ai-border)]";
  const locked = busy || runningDemo;

  return (
    <Sheet open={open} onOpenChange={onOpenChange} modal={false} disablePointerDismissal>
      <SheetContent
        side="right"
        // On a phone the drawer covers the whole screen, so dim the page behind it. On desktop it stays a side panel you can work beside.
        showOverlay={narrow}
        style={THEME.vars}
        className={`flex h-full w-full min-h-0 flex-col overflow-hidden border-l ${border} bg-[var(--ai-bg)] sm:max-w-md`}
      >
        <SheetHeader className={`border-b ${border} pb-3`}>
          <div className="flex items-center justify-between gap-2 pr-8">
            <div className="flex min-w-0 items-center gap-2">
              <div className="flex size-6 shrink-0 items-center justify-center overflow-hidden rounded-md bg-white p-0.5">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={THEME.icon} alt="" className="h-full w-full object-contain" />
              </div>
              <SheetTitle className="truncate whitespace-nowrap text-slate-100">Ask Helix AI</SheetTitle>
            </div>
            <div className="flex shrink-0 items-center gap-1.5">
              {isDemo ? (
                <button type="button" onClick={() => void resetDemo()} disabled={locked} aria-label="Reset demo data" title="Reset demo data" className={`rounded-md border ${border} whitespace-nowrap px-2 py-1 text-[11px] max-md:min-h-10 max-md:min-w-10 font-medium text-slate-400 transition hover:text-slate-200 disabled:opacity-50`}>
                  ↺
                </button>
              ) : null}
              <button type="button" onClick={startNew} disabled={turns.length === 0 || locked} className={`rounded-md border ${border} whitespace-nowrap px-2 py-1 text-[11px] max-md:min-h-10 max-md:min-w-10 font-medium text-slate-400 transition hover:text-slate-200 disabled:opacity-40`}>
                + New
              </button>
              <button
                type="button"
                onClick={() => setHistoryOpen((v) => !v)}
                aria-label="View past conversations"
                title="History"
                className={`rounded-md border ${border} whitespace-nowrap px-2 py-1 text-[11px] max-md:min-h-10 max-md:min-w-10 font-medium transition ${historyOpen ? "bg-[var(--ai-accent-soft)] text-slate-100" : "text-slate-400 hover:text-slate-200"}`}
              >
                🕘
              </button>
            </div>
          </div>
          <p className="flex items-center gap-1 text-[11px] font-medium text-[var(--ai-accent)]">
            <span className="inline-block size-1.5 rounded-full bg-[var(--ai-accent)]" />
            {status}
          </p>
        </SheetHeader>

        {historyOpen ? (
          <div className={`thin-scrollbar max-h-56 space-y-1 overflow-y-auto border-b ${border} px-4 py-3`}>
            {sessions.length === 0 ? (
              <p className="px-1 py-2 text-[11px] text-slate-500">No past conversations yet.</p>
            ) : (
              sessions.map((s) => (
                <button key={s.id} type="button" onClick={() => restore(s)} className={`w-full rounded-md border ${border} bg-[var(--ai-panel)] px-2.5 py-1.5 text-left hover:bg-[var(--ai-accent-soft)]`}>
                  <p className="truncate text-[11px] font-medium text-slate-200">{s.preview}</p>
                  <p className="text-[10px] text-slate-500">{new Date(s.startedAt).toLocaleString()} · {s.turns.length} messages</p>
                </button>
              ))
            )}
          </div>
        ) : null}

        <div className="thin-scrollbar min-h-0 flex-1 space-y-3 overflow-y-auto px-4">
          {turns.length === 0 ? (
            <div className="space-y-3 pt-4">
              <p className="text-sm text-slate-500">{THEME.emptyHint}</p>
              {isDemo ? (
                <button type="button" onClick={() => void runDemo()} disabled={runningDemo} className="flex items-center gap-1.5 rounded-lg border border-[color:var(--ai-accent)] bg-[var(--ai-accent-soft)] px-3 py-2 text-xs font-semibold text-slate-100 transition hover:brightness-125 disabled:opacity-60">
                  <span aria-hidden>▶</span> Watch Helix work
                </button>
              ) : null}
            </div>
          ) : null}

          {turns.map((t, i) => (
            <div key={i} className="space-y-2">
              <div
                className={
                  t.role === "user"
                    ? "ml-auto max-w-[85%] rounded-lg bg-[var(--ai-accent-soft)] px-3 py-2 text-sm text-slate-100"
                    : `max-w-[90%] rounded-lg border ${border} bg-[var(--ai-panel)] px-3 py-2 text-sm whitespace-pre-line text-slate-200`
                }
              >
                {t.attachments?.length ? <p className="mb-1 text-[10px] text-[var(--ai-accent)]">📎 attached image</p> : null}
                {t.content}
              </div>

              {t.agent?.steps.length ? (
                <ul className={`space-y-0.5 rounded-lg border ${border} bg-[var(--ai-panel)] px-3 py-2 text-[11px]`}>
                  {t.agent.steps.map((s, k) => (
                    <li key={k} className={s.status === "executed" ? "text-slate-300" : s.status === "denied" ? "text-amber-300" : "text-rose-400"}>
                      {s.status === "executed" ? "✓" : s.status === "denied" ? "⊘" : "✕"} {s.summary}
                      {s.error ? ` — ${s.error}` : s.status === "denied" && s.reasons?.length ? ` — ${s.reasons.join("; ")}` : ""}
                    </li>
                  ))}
                  {t.agent.truncated ? <li className="text-amber-300">Stopped at the step limit before finishing.</li> : null}
                </ul>
              ) : null}

              {t.agent?.pending ? (
                <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3">
                  <p className="mb-1 text-xs font-semibold text-amber-200">
                    {t.agentStatus === "approved" ? "Approved" : t.agentStatus === "declined" ? "Declined" : t.agentStatus === "failed" ? "Could not apply" : "Needs your OK"}
                  </p>
                  <p className="mb-1 text-xs text-slate-300">{t.agent.pending.summary}</p>
                  {t.agent.pending.reasons.length && t.agentStatus === "pending" ? (
                    <p className="mb-2 text-[11px] text-amber-100/70">{t.agent.pending.reasons.join(" · ")}</p>
                  ) : null}
                  {t.agent.pending.preview ? (
                    <div className={`mb-2 rounded-md border ${border} bg-[var(--ai-bg)] p-2 text-[11px] text-slate-300`}>
                      <p className="mb-1 text-slate-500">To: {t.agent.pending.preview.to}</p>
                      <p className="whitespace-pre-line">{t.agent.pending.preview.text || "(empty draft)"}</p>
                    </div>
                  ) : null}
                  {t.agentStatus === "pending" ? (
                    t.agent.pending.state ? (
                      <div className="flex gap-2">
                        <button type="button" disabled={busy} onClick={() => void decideAgent(i, true)} className="rounded-md bg-amber-500 px-3 py-1 text-[11px] font-semibold text-[#0B0F19] hover:bg-amber-400 disabled:opacity-50">
                          {t.agent.pending.tool === "send_reply" || t.agent.pending.tool === "send_message" ? "Approve & send" : "Approve"}
                        </button>
                        <button type="button" disabled={busy} onClick={() => void decideAgent(i, false)} className={`rounded-md border ${border} px-3 py-1 text-[11px] text-slate-300 hover:bg-[var(--ai-accent-soft)] disabled:opacity-50`}>
                          Decline
                        </button>
                      </div>
                    ) : (
                      <p className="text-[11px] text-rose-400">The server cannot sign this confirmation, so it cannot be approved here.</p>
                    )
                  ) : t.agentStatus === "failed" ? (
                    <p className="text-[11px] font-medium text-rose-400"><ErrorText message={t.agentError ?? "Ask Helix failed"} /></p>
                  ) : null}
                </div>
              ) : null}

              {t.executed ? (
                <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3">
                  <p className="mb-1 text-xs font-semibold text-emerald-200">{t.undone ? "Undone" : t.executed.done.length ? "Done automatically" : "Could not apply"}</p>
                  <p className="mb-2 text-xs text-slate-300">{t.executed.done.length ? t.executed.resultText : t.executed.failed[0]?.error ?? "Unknown error"}</p>
                  {t.executed.done.length && !t.undone && t.executed.undoable !== false ? (
                    <button type="button" onClick={() => void undo(i)} className="rounded-md border border-emerald-500/40 px-3 py-1 text-[11px] font-semibold text-emerald-200 hover:bg-emerald-500/10">
                      Undo
                    </button>
                  ) : null}
                </div>
              ) : null}

              {t.proposal ? (
                <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3">
                  <p className="mb-1 text-xs font-semibold text-amber-200">{t.proposalStatus === "confirmed" ? "Confirmed" : t.proposalStatus === "dismissed" ? "Dismissed" : t.proposalStatus === "failed" ? "Could not apply" : "Needs your OK"}</p>
                  {t.reasons?.length && t.proposalStatus === "pending" ? <p className="mb-2 text-[11px] text-amber-100/70">{t.reasons.join(" · ")}</p> : null}
                  <ul className="mb-2 space-y-0.5 text-xs text-slate-300">
                    {t.proposal.targets.map((x) => (
                      <li key={x.id}>• {x.label}</li>
                    ))}
                  </ul>
                  {t.proposalStatus === "pending" ? (
                    <div className="flex gap-2">
                      <button type="button" onClick={() => void confirm(i)} className="rounded-md bg-amber-500 px-3 py-1 text-[11px] font-semibold text-[#0B0F19] hover:bg-amber-400">
                        Confirm
                      </button>
                      <button type="button" onClick={() => patch(i, { proposalStatus: "dismissed" })} className={`rounded-md border ${border} px-3 py-1 text-[11px] text-slate-300 hover:bg-[var(--ai-accent-soft)]`}>
                        Dismiss
                      </button>
                    </div>
                  ) : t.proposalStatus === "confirmed" ? (
                    <p className="text-[11px] font-medium text-emerald-300">✓ {t.proposalResult}</p>
                  ) : t.proposalStatus === "failed" ? (
                    <p className="text-[11px] font-medium text-rose-400"><ErrorText message={t.proposalResult ?? "Execute failed"} /></p>
                  ) : (
                    <p className="text-[11px] text-slate-500">Dismissed.</p>
                  )}
                </div>
              ) : null}

              {t.suggestions?.length ? (
                <div className="space-y-1.5">
                  {t.suggestions.map((s) => {
                    const selected = t.selectedSuggestion === s.label;
                    const dim = Boolean(t.selectedSuggestion) && !selected;
                    return (
                      <button
                        key={s.label}
                        type="button"
                        disabled={Boolean(t.selectedSuggestion)}
                        onClick={() => void chooseSuggestion(i, s)}
                        className={`w-full rounded-lg border p-3 text-left transition disabled:cursor-default ${
                          selected ? "border-[color:var(--ai-accent)] bg-[var(--ai-accent-soft)]" : dim ? `${border} bg-[var(--ai-panel)] opacity-40` : s.recommended ? "border-[color:var(--ai-accent)] bg-[var(--ai-accent-soft)] hover:brightness-125" : `${border} bg-[var(--ai-panel)] hover:bg-[var(--ai-accent-soft)]`
                        }`}
                      >
                        <div className="mb-1 flex items-center gap-1.5">
                          <p className="text-xs font-semibold text-slate-100">{s.label}</p>
                          {s.recommended ? <span className="rounded-full bg-[var(--ai-accent)] px-1.5 py-0.5 text-[9px] font-bold tracking-wide text-[var(--ai-accent-ink)] uppercase">Recommended</span> : null}
                          {selected ? <span className="text-[11px] text-slate-200">✓ Selected</span> : null}
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
            <div className={`flex w-fit items-center gap-1 rounded-lg border ${border} bg-[var(--ai-panel)] px-3 py-2.5`}>
              {[0, 180, 360].map((d) => (
                <span key={d} className="ask-ai-typing-dot size-1.5 rounded-full bg-[var(--ai-accent)]" style={{ animationDelay: `${d}ms` }} />
              ))}
            </div>
          ) : null}
          {error ? <p className="text-xs text-rose-400"><ErrorText message={error} /></p> : null}
          <div ref={bottomRef} />
        </div>

        <div className={`space-y-2 border-t ${border} px-4 pt-3`}>
          <div className="flex flex-wrap gap-1.5">
            {THEME.quick.map((q) => (
              <button key={q} type="button" disabled={locked} onClick={() => void ask(q)} className={`rounded-full border ${border} px-2.5 py-1 text-[11px] text-slate-300 hover:bg-[var(--ai-accent-soft)] disabled:opacity-50`}>
                {q}
              </button>
            ))}
          </div>

          {attachment ? (
            <div className={`flex items-center gap-2 rounded-md border ${border} bg-[var(--ai-panel)] px-2 py-1 text-[11px] text-slate-300`}>
              📎 image attached
              <button type="button" onClick={() => setAttachment(null)} className="text-slate-500 hover:text-slate-200">×</button>
            </div>
          ) : null}

          <form onSubmit={onSubmit} className="flex items-center gap-2">
            <label className={`flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-md border ${border} text-slate-400 hover:bg-[var(--ai-accent-soft)]`}>
              📎
              <input type="file" accept="image/*" className="hidden" onChange={(e) => void onAttach(e)} />
            </label>
            <input
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="Ask Helix AI, or tell it what to do…"
              disabled={locked}
              className={`h-9 w-full min-w-0 rounded-md border ${border} bg-[var(--ai-panel)] px-2.5 text-sm text-slate-100 placeholder:text-slate-500 focus:border-[color:var(--ai-accent)] focus:outline-none`}
            />
            <button type="submit" disabled={locked || (!question.trim() && !attachment)} className="shrink-0 rounded-md bg-[var(--ai-accent)] px-3 py-1.5 text-xs font-semibold text-[var(--ai-accent-ink)] hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50">
              Send
            </button>
          </form>

          <p className="pb-3 text-[10px] text-slate-500">
            Helix AI can make mistakes. Review the information before acting.
            {usage && usage.calls > 0
              ? ` Claude usage on this server (estimated): ${usage.calls} calls · ${(usage.inputTokens + usage.outputTokens).toLocaleString()} tokens · ~$${usage.estimatedUsd.toFixed(usage.estimatedUsd < 0.1 ? 3 : 2)}.`
              : ""}
          </p>
        </div>
      </SheetContent>
    </Sheet>
  );
}
