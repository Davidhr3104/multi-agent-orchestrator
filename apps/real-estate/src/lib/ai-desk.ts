import { runWithPolicy, type ActionProposal } from "@helix/core";
import { operatorActor, requireOperator } from "@helix/core/operator";
import { realEstateActions, type RealEstateCtx } from "@/lib/ai-actions";
import { currentDeskMode, logActivity } from "@/lib/store";

export function aiCtx(req: Request): RealEstateCtx {
  const who = operatorActor(req);
  return { actor: who === "local" ? "You" : who === "slack" ? "Agent (via Slack)" : "Agent" };
}

/**
 * The demo desk lives in memory and is safe to change, so visitors need no operator key there.
 * A live desk keeps the operator gate: every write needs the unlock.
 */
export function mayChangeDesk(req: Request): boolean {
  return currentDeskMode() === "demo" || !requireOperator(req);
}

type Reply = { answer: string; proposal?: ActionProposal; command?: boolean } & Record<string, unknown>;

/** Risk gate for a change the agent asked for in words: run it if safe, otherwise propose it with reasons. */
export async function applyRiskPolicy(req: Request, reply: Reply): Promise<Record<string, unknown>> {
  const { command, proposal, ...rest } = reply;
  if (!command || !proposal) return { ...rest, proposal };
  const ctx = aiCtx(req);
  const outcome = await runWithPolicy(realEstateActions, proposal, ctx, { canAutoRun: mayChangeDesk(req) });
  const labels = proposal.targets.map((t) => t.label);
  if ("executed" in outcome) {
    const { done, failed } = outcome.executed;
    await logActivity({ actor: ctx.actor, action: proposal.action, kind: "run", via: "chat", labels, done: done.length, failed: failed.length });
    return { ...rest, executed: outcome.executed };
  }
  await logActivity({ actor: "Helix AI", action: proposal.action, kind: "proposed", via: "chat", labels, done: 0, failed: 0 });
  const why = outcome.reasons.length ? `\n\nI'm asking first because: ${outcome.reasons.join("; ").toLowerCase()}.` : "";
  return { ...rest, answer: `${reply.answer}${why}`, proposal: outcome.proposal, reasons: outcome.reasons };
}
