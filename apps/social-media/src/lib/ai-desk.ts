import { runWithPolicy, type ActionProposal } from "@helix/core";
import { operatorActor, requireOperator } from "@helix/core/operator";
import { socialActions, type SocialCtx } from "@/lib/ai-actions";
import { AccessError, currentDeskMode, DraftError, ReviewError } from "@/lib/store";

export function aiCtx(req: Request): SocialCtx {
  return { actor: `Helix AI · approved by ${operatorActor(req)}` };
}

/** Actor for a decision a person made with a button (no AI in between). */
export function humanActor(req: Request): string {
  const who = operatorActor(req);
  return who === "slack" ? "Operator (via Slack)" : who === "operator" ? "Operator" : "You";
}

/**
 * The demo desk lives in memory and is safe to change, so visitors need no operator key there.
 * A live desk keeps the operator gate: every write needs the unlock.
 */
export function mayChangeDesk(req: Request): boolean {
  return currentDeskMode() === "demo" || !requireOperator(req);
}

/** Maps desk errors to HTTP. Returns null when the caller should rethrow. */
export function mutationError(err: unknown): Response | null {
  if (err instanceof AccessError) return Response.json({ error: err.message }, { status: 403 });
  if (err instanceof ReviewError || err instanceof DraftError) return Response.json({ error: err.message }, { status: 409 });
  return null;
}

/** Response when a write is not allowed, or null when the caller may continue. */
export function deskWriteDenied(req: Request): Response | null {
  if (mayChangeDesk(req)) return null;
  return requireOperator(req) ?? Response.json({ error: "Operator unlock required." }, { status: 401 });
}

type Reply = { answer: string; proposal?: ActionProposal; command?: boolean } & Record<string, unknown>;

/** Risk gate for a change the operator asked for in words: run it if safe, otherwise propose it with reasons. */
export async function applyRiskPolicy(req: Request, reply: Reply): Promise<Record<string, unknown>> {
  const { command, proposal, ...rest } = reply;
  if (!command || !proposal) return { ...rest, proposal };
  const outcome = await runWithPolicy(socialActions, proposal, aiCtx(req), { canAutoRun: mayChangeDesk(req) });
  if ("executed" in outcome) return { ...rest, executed: outcome.executed };
  const why = outcome.reasons.length ? `\n\nI'm asking first because: ${outcome.reasons.join("; ").toLowerCase()}.` : "";
  return { ...rest, answer: `${reply.answer}${why}`, proposal: outcome.proposal, reasons: outcome.reasons };
}
