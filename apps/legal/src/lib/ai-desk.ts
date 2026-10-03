import { runWithPolicy, type ActionProposal } from "@helix/core";
import { operatorActor, requireOperator } from "@helix/core/operator";
import { legalActions, type LegalCtx } from "@/lib/ai-actions";
import { currentDeskMode } from "@/lib/store";

export function aiCtx(req: Request): LegalCtx {
  return { actor: `Helix AI · approved by ${operatorActor(req)}` };
}

/**
 * The demo desk lives in memory and is safe to change, so visitors need no operator key there.
 * A live desk keeps the operator gate: every write needs the unlock.
 */
export function mayChangeDesk(req: Request): boolean {
  return currentDeskMode() === "demo" || !requireOperator(req);
}

/** The 401 for a desk write a visitor may not make, or null when the write may go ahead. */
export function deskWriteDenied(req: Request): Response | null {
  if (mayChangeDesk(req)) return null;
  return requireOperator(req) ?? Response.json({ error: "Operator unlock required." }, { status: 401 });
}

type Reply = { answer: string; proposal?: ActionProposal; command?: boolean } & Record<string, unknown>;

/** Risk gate for a change the operator asked for in words: run it if safe, otherwise propose it with reasons. */
export async function applyRiskPolicy(req: Request, reply: Reply): Promise<Record<string, unknown>> {
  const { command, proposal, ...rest } = reply;
  if (!command || !proposal) return { ...rest, proposal };
  const outcome = await runWithPolicy(legalActions, proposal, aiCtx(req), { canAutoRun: mayChangeDesk(req) });
  if ("executed" in outcome) return { ...rest, executed: outcome.executed };
  const why = outcome.reasons.length ? `\n\nI'm asking first because: ${outcome.reasons.join("; ").toLowerCase()}.` : "";
  return { ...rest, answer: `${reply.answer}${why}`, proposal: outcome.proposal, reasons: outcome.reasons };
}
