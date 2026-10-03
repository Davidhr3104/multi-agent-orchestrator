import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import {
  getSecret,
  resumeAgent,
  runAgent,
  type AgentMessage,
  type AgentModel,
  type AgentResult,
  type AgentStep,
  type PendingConfirmation,
  type UndoEntry,
} from "@helix/core";
import {
  defaultCalendarLoader,
  INBOX_AGENT_MAX_STEPS,
  INBOX_AGENT_TOOLS,
  inboxAgentModel,
  inboxAgentSystem,
  type InboxAgentCtx,
} from "@/lib/inbox-agent";
import { currentDeskMode, getThread } from "@/lib/store";

/**
 * A paused agent run travels to the browser and back as a signed blob, so any serverless instance
 * can resume it and the browser cannot alter what was approved (recipient, thread, text).
 */

const STATE_TTL_MS = 15 * 60_000;

export type AgentSessionState = {
  messages: AgentMessage[];
  steps: AgentStep[];
  pending: PendingConfirmation;
  /** The exact draft the operator saw on the confirmation card (send_reply only). */
  shownDraft?: string;
  exp: number;
};

function signingKey(): Buffer | null {
  const base = getSecret("HELIX_OPERATOR_KEY") || getSecret("ANTHROPIC_API_KEY");
  if (!base) return null;
  return createHash("sha256").update(`helix-inbox-agent-state:${base}`).digest();
}

export function signAgentState(state: Omit<AgentSessionState, "exp">, now = Date.now()): string | null {
  const key = signingKey();
  if (!key) return null;
  const payload = Buffer.from(JSON.stringify({ ...state, exp: now + STATE_TTL_MS }), "utf8").toString("base64url");
  return `${payload}.${createHmac("sha256", key).update(payload).digest("base64url")}`;
}

export function verifyAgentState(token: unknown, now = Date.now()): { ok: true; state: AgentSessionState } | { ok: false; error: string } {
  const key = signingKey();
  if (!key) return { ok: false, error: "The server cannot verify this confirmation (no signing key)." };
  if (typeof token !== "string" || token.split(".").length !== 2) return { ok: false, error: "Malformed confirmation." };
  const [payload, sig] = token.split(".");
  const expected = Buffer.from(createHmac("sha256", key).update(payload).digest("base64url"));
  const given = Buffer.from(sig);
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return { ok: false, error: "This confirmation was altered." };
  let state: AgentSessionState;
  try {
    state = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as AgentSessionState;
  } catch {
    return { ok: false, error: "Malformed confirmation." };
  }
  if (typeof state.exp !== "number" || now > state.exp) return { ok: false, error: "This confirmation expired. Ask Helix again." };
  return { ok: true, state };
}

/**
 * A model failure mid-run must not throw away the record of steps that already ran (an approved
 * send, a written draft): the run ends with a plain statement and the real step list instead.
 */
export function failSoft(model: AgentModel): AgentModel {
  return async (req) => {
    try {
      return await model(req);
    } catch (err) {
      return {
        text: `I could not reach Claude (${err instanceof Error ? err.message : "unknown error"}). Only the steps listed here actually ran.`,
        toolCalls: [],
      };
    }
  };
}

export function agentConfig(ctx: InboxAgentCtx, model: AgentModel = inboxAgentModel()) {
  return {
    system: inboxAgentSystem(ctx.now, currentDeskMode()),
    tools: INBOX_AGENT_TOOLS,
    model: failSoft(model),
    ctx,
    maxSteps: INBOX_AGENT_MAX_STEPS,
  };
}

export function newAgentCtx(base: { actor: string; touched: Set<string> }, canAutoRun: boolean): InboxAgentCtx {
  return { ...base, canAutoRun, now: new Date(), loadCalendar: defaultCalendarLoader };
}

export type AgentPayload = {
  answer: string;
  engine: "claude";
  agent: {
    steps: { tool: string; summary: string; status: AgentStep["status"]; error?: string; reasons?: string[] }[];
    truncated: boolean;
    pending?: { tool: string; summary: string; reasons: string[]; preview?: { to: string; text: string }; state: string | null };
  };
  executed?: {
    action: string;
    summary: string;
    targets: { id: string; label: string }[];
    done: string[];
    failed: { id: string; error: string }[];
    undo: UndoEntry[];
    resultText: string;
    announce: string;
    undoable: boolean;
  };
};

function isUndoEntries(v: unknown): v is UndoEntry[] {
  return Array.isArray(v) && v.every((e) => e && typeof e === "object" && typeof (e as UndoEntry).action === "string" && typeof (e as UndoEntry).id === "string");
}

/** Shapes an agent result for the drawer; only steps from this request are shown. */
export async function presentAgentResult(result: AgentResult, fromStep = 0): Promise<AgentPayload> {
  const fresh = result.steps.slice(fromStep);
  const undo = fresh.filter((s) => s.status === "executed" && isUndoEntries(s.undo)).flatMap((s) => s.undo as UndoEntry[]);
  const payload: AgentPayload = {
    answer: result.answer,
    engine: "claude",
    agent: {
      steps: fresh.map((s) => ({ tool: s.tool, summary: s.summary, status: s.status, error: s.error, reasons: s.reasons })),
      truncated: result.truncated,
    },
  };
  if (undo.length) {
    const executed = fresh.filter((s) => s.status === "executed" && isUndoEntries(s.undo));
    payload.executed = {
      action: "agent",
      summary: executed.map((s) => s.summary).join("; "),
      targets: [],
      done: [...new Set(undo.map((u) => u.id))],
      failed: [],
      undo,
      resultText: executed.map((s) => (s.output as { result?: string } | undefined)?.result ?? s.summary).join(" "),
      announce: `Helix AI: ${executed.map((s) => s.summary).join("; ")}`,
      undoable: true,
    };
  }
  if (result.pending) {
    let preview: { to: string; text: string } | undefined;
    let shownDraft: string | undefined;
    if (result.pending.tool === "send_reply") {
      const t = await getThread(String(result.pending.input.thread_id ?? ""));
      if (t) {
        shownDraft = t.draftReply;
        preview = { to: `${t.fromName} <${t.fromEmail}>`, text: t.draftReply };
      }
    } else if (result.pending.tool === "send_message") {
      preview = { to: String(result.pending.input.to ?? ""), text: String(result.pending.input.body ?? "") };
    }
    payload.agent.pending = {
      tool: result.pending.tool,
      summary: result.pending.summary,
      reasons: result.pending.reasons,
      preview,
      state: signAgentState({ messages: result.messages, steps: result.steps, pending: result.pending, shownDraft }),
    };
  }
  return payload;
}

export async function startAgent(ctx: InboxAgentCtx, history: { role: "user" | "assistant"; content: string }[], model?: AgentModel) {
  const clean = history.filter((m) => m.content.trim());
  const result = await runAgent(agentConfig(ctx, model), clean);
  return presentAgentResult(result);
}

/**
 * Runs (or declines) the call the operator decided on. A send is refused if the draft changed
 * after the confirmation card was shown, so what goes out is exactly what was approved.
 */
export async function continueAgent(ctx: InboxAgentCtx, state: AgentSessionState, approved: boolean, model?: AgentModel) {
  if (approved && state.pending.tool === "send_reply" && state.shownDraft !== undefined) {
    const t = await getThread(String(state.pending.input.thread_id ?? ""));
    if (!t || t.draftReply !== state.shownDraft) {
      throw new Error("The draft changed after you saw it. Nothing was sent; ask Helix again to confirm the new text.");
    }
  }
  const result = await resumeAgent(agentConfig(ctx, model), { messages: state.messages, steps: state.steps, pending: state.pending }, approved);
  return presentAgentResult(result, state.steps.length);
}
