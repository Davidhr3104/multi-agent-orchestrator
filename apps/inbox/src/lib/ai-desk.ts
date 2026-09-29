import { runWithPolicy, type ActionProposal } from "@helix/core";
import { operatorActor, requireOperator } from "@helix/core/operator";
import { inboxActions, type InboxCtx } from "@/lib/ai-actions";
import { jsonWithDeskCookie, patchFromThread, readDeskCookie, upsertDeskPatch } from "@/lib/desk-state-cookie";
import { applyDeskPatches, currentDeskMode, getMessage } from "@/lib/store";

export function aiCtx(req: Request): InboxCtx {
  return { actor: `Helix AI · approved by ${operatorActor(req)}`, touched: new Set() };
}

/**
 * The demo desk lives in memory and is safe to change, so visitors need no operator key there.
 * A live desk keeps the operator gate: every write needs the unlock.
 */
export function mayChangeDesk(req: Request): boolean {
  return currentDeskMode() === "demo" || !requireOperator(req);
}

/** Re-applies this visitor's cookie patches so a serverless instance sees the desk as they left it. */
export function loadDeskState(req: Request) {
  const state = readDeskCookie(req);
  applyDeskPatches(state.patches);
  return state;
}

/**
 * JSON response that also writes every thread the AI touched into the desk cookie — Inbox keeps its
 * state there so it survives serverless cold starts, and AI changes must persist the same way.
 */
export async function respondWithDeskCookie(req: Request, ctx: InboxCtx, payload: unknown, status = 200): Promise<Response> {
  let state = readDeskCookie(req);
  for (const id of ctx.touched) {
    const m = await getMessage(id);
    if (m) state = upsertDeskPatch(state, id, patchFromThread(m));
  }
  return jsonWithDeskCookie(payload, state, { status });
}

type Reply = { answer: string; proposal?: ActionProposal; command?: boolean } & Record<string, unknown>;

/** Risk gate for a change the operator asked for in words: run it if safe, otherwise propose it with reasons. */
export async function applyRiskPolicy(req: Request, ctx: InboxCtx, reply: Reply): Promise<Record<string, unknown>> {
  const { command, proposal, ...rest } = reply;
  if (!command || !proposal) return { ...rest, proposal };
  const outcome = await runWithPolicy(inboxActions, proposal, ctx, { canAutoRun: mayChangeDesk(req) });
  if ("executed" in outcome) return { ...rest, executed: outcome.executed };
  const why = outcome.reasons.length ? `\n\nI'm asking first because: ${outcome.reasons.join("; ").toLowerCase()}.` : "";
  return { ...rest, answer: `${reply.answer}${why}`, proposal: outcome.proposal, reasons: outcome.reasons };
}
