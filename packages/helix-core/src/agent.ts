/**
 * Shared agent loop for every Helix desk. The model chooses which tool to call; the desk
 * decides — deterministically, in code — whether that call may run on its own.
 *
 *   read / reversible / low-risk  -> "auto"    runs immediately (the desk may return an undo)
 *   external or irreversible      -> "confirm" the loop stops and hands a pending call to a human
 *   never allowed                 -> "deny"    the model is told no and must pick another path
 *
 * helix-core knows nothing about leads, email or orders: each app registers its own tools and
 * its own risk function. Risk is never a property the model can set or argue its way around.
 */

export type JsonSchema = Record<string, unknown>;

export type RiskDecision =
  | { level: "auto"; reasons?: string[] }
  | { level: "confirm"; reasons: string[] }
  | { level: "deny"; reasons: string[] };

export type ToolResult = {
  /** What the model sees next. Keep it factual — it is the only ground truth the model gets. */
  output: unknown;
  /** Opaque, desk-defined data that lets the desk reverse this call. Surfaced in AgentStep. */
  undo?: unknown;
};

export type AgentTool<Ctx> = {
  name: string;
  description: string;
  inputSchema: JsonSchema;
  /** One human sentence for confirmation cards and the audit trail. */
  describe: (input: Record<string, unknown>, ctx: Ctx) => string;
  /** Deterministic policy. May inspect the real input and the real desk state. */
  risk: (input: Record<string, unknown>, ctx: Ctx) => RiskDecision | Promise<RiskDecision>;
  /** Performs the work. Must validate its own input and throw on anything invalid. */
  run: (input: Record<string, unknown>, ctx: Ctx) => Promise<ToolResult>;
};

export type ToolCall = { id: string; name: string; input: Record<string, unknown> };

export type AgentMessage =
  | { role: "user"; content: string }
  | { role: "assistant"; text?: string; toolCalls?: ToolCall[] }
  | { role: "tool"; results: { toolCallId: string; output: unknown; isError?: boolean }[] };

export type ModelRequest = {
  system: string;
  messages: AgentMessage[];
  tools: { name: string; description: string; inputSchema: JsonSchema }[];
};
export type ModelTurn = { text?: string; toolCalls: ToolCall[] };
/** Injectable so the loop is testable without a network and so a desk can swap providers. */
export type AgentModel = (req: ModelRequest) => Promise<ModelTurn>;

export type AgentStep = {
  toolCallId: string;
  tool: string;
  summary: string;
  status: "executed" | "failed" | "denied";
  reasons?: string[];
  output?: unknown;
  error?: string;
  undo?: unknown;
};

export type PendingConfirmation = {
  toolCallId: string;
  tool: string;
  input: Record<string, unknown>;
  summary: string;
  reasons: string[];
};

export type AgentResult = {
  answer: string;
  steps: AgentStep[];
  /** Set when the loop stopped because a call needs a human. Resume with resumeAgent(). */
  pending?: PendingConfirmation;
  /** Full transcript so far; pass back to resumeAgent(). */
  messages: AgentMessage[];
  /** True if the step budget ran out before the model finished. Never silent. */
  truncated: boolean;
};

export type AgentConfig<Ctx> = {
  system: string;
  tools: AgentTool<Ctx>[];
  model: AgentModel;
  ctx: Ctx;
  maxSteps?: number;
};

const DEFAULT_MAX_STEPS = 8;

function errText(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

async function execute<Ctx>(tool: AgentTool<Ctx>, call: ToolCall, ctx: Ctx, reasons?: string[]) {
  const summary = tool.describe(call.input, ctx);
  try {
    const result = await tool.run(call.input, ctx);
    const step: AgentStep = {
      toolCallId: call.id,
      tool: call.name,
      summary,
      status: "executed",
      reasons,
      output: result.output,
      undo: result.undo,
    };
    return { step, message: { toolCallId: call.id, output: result.output } };
  } catch (err) {
    const error = errText(err);
    const step: AgentStep = { toolCallId: call.id, tool: call.name, summary, status: "failed", reasons, error };
    return { step, message: { toolCallId: call.id, output: { error }, isError: true } };
  }
}

async function loop<Ctx>(
  cfg: AgentConfig<Ctx>,
  messages: AgentMessage[],
  steps: AgentStep[]
): Promise<AgentResult> {
  const byName = new Map(cfg.tools.map((t) => [t.name, t]));
  const toolDefs = cfg.tools.map(({ name, description, inputSchema }) => ({ name, description, inputSchema }));
  const budget = cfg.maxSteps ?? DEFAULT_MAX_STEPS;
  let lastText = "";

  for (let turn = 0; turn < budget; turn++) {
    const modelTurn = await cfg.model({ system: cfg.system, messages, tools: toolDefs });
    if (modelTurn.text) lastText = modelTurn.text;
    messages.push({ role: "assistant", text: modelTurn.text, toolCalls: modelTurn.toolCalls });

    if (modelTurn.toolCalls.length === 0) {
      return { answer: modelTurn.text ?? lastText, steps, messages, truncated: false };
    }

    const results: Extract<AgentMessage, { role: "tool" }>["results"] = [];
    for (const call of modelTurn.toolCalls) {
      const tool = byName.get(call.name);
      if (!tool) {
        const error = `Unknown tool "${call.name}"`;
        steps.push({ toolCallId: call.id, tool: call.name, summary: call.name, status: "failed", error });
        results.push({ toolCallId: call.id, output: { error }, isError: true });
        continue;
      }

      let decision: RiskDecision;
      try {
        decision = await tool.risk(call.input, cfg.ctx);
      } catch (err) {
        // A policy that cannot decide must never default to "allowed".
        decision = { level: "confirm", reasons: [`Risk check failed: ${errText(err)}`] };
      }

      if (decision.level === "deny") {
        steps.push({
          toolCallId: call.id,
          tool: call.name,
          summary: tool.describe(call.input, cfg.ctx),
          status: "denied",
          reasons: decision.reasons,
        });
        results.push({ toolCallId: call.id, output: { error: `Not permitted: ${decision.reasons.join("; ")}` }, isError: true });
        continue;
      }

      if (decision.level === "confirm") {
        // Stop here. Earlier calls in this turn already ran; the rest of the turn is dropped so the
        // model re-plans after the human decides, rather than acting on a stale assumption.
        const pending: PendingConfirmation = {
          toolCallId: call.id,
          tool: call.name,
          input: call.input,
          summary: tool.describe(call.input, cfg.ctx),
          reasons: decision.reasons,
        };
        const skipped = modelTurn.toolCalls.slice(modelTurn.toolCalls.indexOf(call));
        for (const s of skipped) {
          results.push({ toolCallId: s.id, output: { status: "awaiting_human_confirmation" } });
        }
        messages.push({ role: "tool", results });
        return {
          answer: modelTurn.text ?? `I need your confirmation: ${pending.summary}`,
          steps,
          pending,
          messages,
          truncated: false,
        };
      }

      const { step, message } = await execute(tool, call, cfg.ctx, decision.reasons);
      steps.push(step);
      results.push(message);
    }
    messages.push({ role: "tool", results });
  }

  return {
    answer: lastText || "I stopped because I reached the step limit before finishing.",
    steps,
    messages,
    truncated: true,
  };
}

export function runAgent<Ctx>(cfg: AgentConfig<Ctx>, history: { role: "user" | "assistant"; content: string }[]) {
  const messages: AgentMessage[] = history.map((m) =>
    m.role === "user" ? { role: "user", content: m.content } : { role: "assistant", text: m.content }
  );
  return loop(cfg, messages, []);
}

/**
 * Continues after a human decision on a PendingConfirmation. Approved calls run once, here;
 * rejected calls are reported to the model as declined so it can offer an alternative.
 */
export async function resumeAgent<Ctx>(
  cfg: AgentConfig<Ctx>,
  prior: { messages: AgentMessage[]; steps: AgentStep[]; pending: PendingConfirmation },
  approved: boolean
): Promise<AgentResult> {
  const { pending } = prior;
  const tool = cfg.tools.find((t) => t.name === pending.tool);
  const messages = [...prior.messages];
  const steps = [...prior.steps];

  // Replace the "awaiting" placeholder for the pending call with the real outcome.
  const last = messages[messages.length - 1];
  if (last?.role !== "tool") throw new Error("Cannot resume: transcript does not end with a tool turn");
  const results = last.results.map((r) => ({ ...r }));
  const slot = results.find((r) => r.toolCallId === pending.toolCallId);
  if (!slot) throw new Error("Cannot resume: pending tool call not found in transcript");

  if (!tool) {
    slot.output = { error: `Unknown tool "${pending.tool}"` };
    slot.isError = true;
    steps.push({ toolCallId: pending.toolCallId, tool: pending.tool, summary: pending.summary, status: "failed", error: "Unknown tool" });
  } else if (!approved) {
    slot.output = { status: "declined_by_user" };
    steps.push({ toolCallId: pending.toolCallId, tool: pending.tool, summary: pending.summary, status: "denied", reasons: ["Declined by the operator"] });
  } else {
    const { step, message } = await execute(tool, { id: pending.toolCallId, name: pending.tool, input: pending.input }, cfg.ctx, pending.reasons);
    steps.push(step);
    slot.output = message.output;
    slot.isError = "isError" in message ? message.isError : undefined;
  }

  messages[messages.length - 1] = { role: "tool", results };
  return loop(cfg, messages, steps);
}
