/**
 * Token usage for every Claude call that goes through helix-core (completeWithClaude, askAi,
 * askAiWithProposal, anthropicAgentModel). Apps subscribe with onClaudeUsage() to keep their
 * own "AI cost (estimated)" totals; helix-core never stores usage itself.
 */

export type ClaudeUsage = {
  model: string;
  inputTokens: number;
  outputTokens: number;
  /** Which helix-core entry point made the call, e.g. "ask-ai" or "agent". */
  feature: string;
};

/**
 * List prices in USD per million tokens. These are estimates for the cost panels, not invoice
 * figures: check the Anthropic console for what was actually billed.
 */
export const ESTIMATED_CLAUDE_PRICES_USD_PER_MTOK: Record<"haiku" | "sonnet" | "opus", { input: number; output: number }> = {
  haiku: { input: 1, output: 5 },
  sonnet: { input: 3, output: 15 },
  opus: { input: 15, output: 75 },
};

function priceFor(model: string) {
  const m = model.toLowerCase();
  if (m.includes("haiku")) return ESTIMATED_CLAUDE_PRICES_USD_PER_MTOK.haiku;
  if (m.includes("opus")) return ESTIMATED_CLAUDE_PRICES_USD_PER_MTOK.opus;
  return ESTIMATED_CLAUDE_PRICES_USD_PER_MTOK.sonnet;
}

export function estimateClaudeCostUsd(usage: Pick<ClaudeUsage, "model" | "inputTokens" | "outputTokens">): number {
  const p = priceFor(usage.model);
  return (usage.inputTokens * p.input + usage.outputTokens * p.output) / 1_000_000;
}

type Listener = (usage: ClaudeUsage) => void;
const g = globalThis as { __helixClaudeUsageListeners?: Set<Listener> };
function listeners(): Set<Listener> {
  g.__helixClaudeUsageListeners ??= new Set();
  return g.__helixClaudeUsageListeners;
}

export function onClaudeUsage(fn: Listener): () => void {
  listeners().add(fn);
  return () => listeners().delete(fn);
}

export function reportClaudeUsage(usage: ClaudeUsage): void {
  for (const fn of listeners()) {
    try {
      fn(usage);
    } catch {
      // A broken cost panel must never break the AI call that produced the usage.
    }
  }
}

/** Reads Anthropic's `usage` block. Returns undefined when the response carries none. */
export function readClaudeUsage(data: unknown, model: string, feature: string): ClaudeUsage | undefined {
  const u = (data as { usage?: { input_tokens?: unknown; output_tokens?: unknown } } | null)?.usage;
  if (!u || typeof u.input_tokens !== "number" || typeof u.output_tokens !== "number") return undefined;
  return { model, inputTokens: u.input_tokens, outputTokens: u.output_tokens, feature };
}

/** Anthropic's error message from a failed response body, without echoing request data. */
export function anthropicErrorMessage(body: unknown, status: number): string {
  const msg = (body as { error?: { message?: unknown } } | null)?.error?.message;
  return typeof msg === "string" && msg.trim() ? `${status}: ${msg.trim().slice(0, 300)}` : String(status);
}
