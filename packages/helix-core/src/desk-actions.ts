/**
 * Generic engine for "the AI changes something on this desk" — shared by every Helix.
 * An app registers named actions; this module handles the parts that must behave identically
 * everywhere: deterministic risk policy, per-target execution with visible failures, and Undo.
 * It knows nothing about leads, orders or email.
 */

export type ActionParams = Record<string, unknown>;

export type RiskAssessment = { level: "auto" | "confirm"; reasons: string[] };

export type DeskAction<Ctx> = {
  name: string;
  /** Deterministic policy over the real entities. Anything uncertain must return "confirm". */
  assess: (ids: string[], params: ActionParams, ctx: Ctx) => Promise<RiskAssessment>;
  /** State to restore on Undo, or null if the target does not exist. Must be JSON-serialisable. */
  snapshot: (id: string, ctx: Ctx) => Promise<unknown | null>;
  /** Applies the change to one target. Returns false when the target does not exist. */
  apply: (id: string, params: ActionParams, ctx: Ctx) => Promise<boolean>;
  /** Puts one target back. Must validate `data`, which arrives from the client. */
  restore: (id: string, data: unknown, ctx: Ctx) => Promise<boolean>;
  /** One sentence for the chat once the action ran. */
  resultText: (done: string[], failed: number, params: ActionParams) => string;
  /** One line for the dashboard toast / activity log. `labels` are the affected targets' names. */
  announce: (labels: string[], params: ActionParams) => string;
  /** False when the action only computes something (nothing meaningful to put back): the UI then shows no Undo. Default true. */
  reversible?: boolean;
  /** Reject malformed params before anything runs. Return an error message or null. */
  validate?: (params: ActionParams) => string | null;
};

export type DeskActionRegistry<Ctx> = Record<string, DeskAction<Ctx>>;

export type UndoEntry = { action: string; id: string; data: unknown };

export type RunResult = {
  done: string[];
  failed: { id: string; error: string }[];
  undo: UndoEntry[];
  resultText: string;
};

export type ActionTarget = { id: string; label: string };

export type ActionProposal = {
  action: string;
  summary: string;
  targets: ActionTarget[];
  params?: ActionParams;
};

export type ExecutedAction = RunResult & {
  /** Whether the panel should offer Undo for this run. */
  undoable: boolean;
  action: string;
  summary: string;
  targets: ActionTarget[];
  announce: string;
};

function errText(err: unknown) {
  return err instanceof Error ? err.message : String(err);
}

export async function runDeskAction<Ctx>(
  registry: DeskActionRegistry<Ctx>,
  input: { action: string; targetIds: string[]; params?: ActionParams },
  ctx: Ctx
): Promise<RunResult> {
  const def = registry[input.action];
  if (!def) throw new Error(`Unsupported action "${input.action}"`);
  const params = input.params ?? {};
  const invalid = def.validate?.(params);
  if (invalid) throw new Error(invalid);

  const done: string[] = [];
  const failed: { id: string; error: string }[] = [];
  const undo: UndoEntry[] = [];
  for (const id of input.targetIds) {
    try {
      const before = await def.snapshot(id, ctx);
      if (before === null || !(await def.apply(id, params, ctx))) {
        failed.push({ id, error: "Not found" });
        continue;
      }
      done.push(id);
      undo.push({ action: input.action, id, data: before });
    } catch (err) {
      failed.push({ id, error: errText(err) });
    }
  }
  return { done, failed, undo, resultText: def.resultText(done, failed.length, params) };
}

export async function restoreDeskActions<Ctx>(
  registry: DeskActionRegistry<Ctx>,
  entries: unknown[],
  ctx: Ctx
): Promise<{ done: string[]; failed: { id: string; error: string }[] }> {
  const done: string[] = [];
  const failed: { id: string; error: string }[] = [];
  for (const raw of entries) {
    const e = raw as Partial<UndoEntry> | null;
    if (!e || typeof e.action !== "string" || typeof e.id !== "string" || !registry[e.action]) {
      failed.push({ id: typeof e?.id === "string" ? e.id : "?", error: "Invalid undo entry" });
      continue;
    }
    try {
      (await registry[e.action].restore(e.id, e.data, ctx)) ? done.push(e.id) : failed.push({ id: e.id, error: "Not found" });
    } catch (err) {
      failed.push({ id: e.id, error: errText(err) });
    }
  }
  return { done, failed };
}

/**
 * The single gate for a change the operator asked for in words. Safe + reversible actions run at
 * once (with Undo); everything else comes back as a proposal with the reasons it needs a human.
 * `canAutoRun` lets the caller veto auto-execution (e.g. missing operator authorization).
 */
export async function runWithPolicy<Ctx>(
  registry: DeskActionRegistry<Ctx>,
  proposal: ActionProposal,
  ctx: Ctx,
  opts: { canAutoRun: boolean }
): Promise<{ executed: ExecutedAction } | { proposal: ActionProposal; reasons: string[] }> {
  const def = registry[proposal.action];
  const ids = proposal.targets.map((t) => t.id);
  const params = proposal.params ?? {};

  let risk: RiskAssessment;
  if (!def) risk = { level: "confirm", reasons: [`Unrecognized action "${proposal.action}"`] };
  else if (ids.length === 0) risk = { level: "confirm", reasons: ["No matching target found"] };
  else {
    try {
      risk = await def.assess(ids, params, ctx);
    } catch (err) {
      // A policy that cannot decide must never default to "allowed".
      risk = { level: "confirm", reasons: [`Risk check failed: ${errText(err)}`] };
    }
  }

  if (risk.level !== "auto" || !opts.canAutoRun || !def) {
    const reasons = risk.level === "auto" && !opts.canAutoRun ? ["Operator authorization required"] : risk.reasons;
    return { proposal, reasons };
  }

  const result = await runDeskAction(registry, { action: proposal.action, targetIds: ids, params }, ctx);
  const okTargets = proposal.targets.filter((t) => result.done.includes(t.id));
  return {
    executed: {
      ...result,
      undoable: def.reversible !== false,
      action: proposal.action,
      summary: proposal.summary,
      targets: proposal.targets,
      announce: def.announce(okTargets.map((t) => t.label), params),
    },
  };
}

/**
 * Shared body of every app's POST /api/ask-ai/execute. Validates the request shape, then either
 * restores Undo entries or runs one registered action. The caller has already decided the request
 * is authorized. Returns an HTTP-shaped result so routes stay two lines long.
 */
export async function handleExecuteBody<Ctx>(
  registry: DeskActionRegistry<Ctx>,
  raw: unknown,
  ctx: Ctx
): Promise<{ status: number; body: Record<string, unknown> }> {
  const bad = (error: string) => ({ status: 400, body: { error } });
  if (!raw || typeof raw !== "object") return bad("JSON body required");
  const b = raw as { action?: unknown; targetIds?: unknown; params?: unknown; labels?: unknown; entries?: unknown };

  if (b.action === "restore") {
    if (!Array.isArray(b.entries) || b.entries.length === 0 || b.entries.length > 50) return bad("entries must be a non-empty array (max 50)");
    return { status: 200, body: { action: "restore", ...(await restoreDeskActions(registry, b.entries, ctx)) } };
  }

  if (typeof b.action !== "string" || !registry[b.action]) return bad("Unsupported action");
  if (!Array.isArray(b.targetIds) || b.targetIds.length === 0 || b.targetIds.length > 50 || !b.targetIds.every((x) => typeof x === "string")) {
    return bad("targetIds must be a non-empty array of strings (max 50)");
  }
  const params = b.params && typeof b.params === "object" && !Array.isArray(b.params) ? (b.params as ActionParams) : {};
  const labels = Array.isArray(b.labels) ? b.labels.filter((x): x is string => typeof x === "string").map((x) => x.slice(0, 80)).slice(0, 10) : [];

  try {
    const ids = b.targetIds as string[];
    const result = await runDeskAction(registry, { action: b.action, targetIds: ids, params }, ctx);
    const announceLabels = labels.length ? labels : ids;
    return { status: 200, body: { action: b.action, ...result, announce: registry[b.action].announce(announceLabels, params) } };
  } catch (err) {
    return bad(errText(err));
  }
}
