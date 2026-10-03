import type { AgentMessage, AgentModel, ToolCall } from "./agent";
import { DEFAULT_CLAUDE_MODEL } from "./claude";
import { anthropicErrorMessage, readClaudeUsage, reportClaudeUsage } from "./claude-usage";
import { getSecret } from "./secrets";

type Block =
  | { type: "text"; text: string }
  | { type: "tool_use"; id: string; name: string; input: Record<string, unknown> }
  | { type: "tool_result"; tool_use_id: string; content: string; is_error?: boolean };

type AnthropicMessage = { role: "user" | "assistant"; content: string | Block[] };

/**
 * Maps the provider-neutral transcript onto Anthropic's tool-use message format.
 * Empty assistant turns are dropped: Anthropic rejects an assistant message with no content.
 */
export function toAnthropicMessages(messages: AgentMessage[]): AnthropicMessage[] {
  const out: AnthropicMessage[] = [];
  for (const m of messages) {
    if (m.role === "user") {
      out.push({ role: "user", content: m.content });
    } else if (m.role === "assistant") {
      const blocks: Block[] = [];
      if (m.text) blocks.push({ type: "text", text: m.text });
      for (const c of m.toolCalls ?? []) blocks.push({ type: "tool_use", id: c.id, name: c.name, input: c.input });
      if (blocks.length) out.push({ role: "assistant", content: blocks });
    } else {
      out.push({
        role: "user",
        content: m.results.map((r) => ({
          type: "tool_result" as const,
          tool_use_id: r.toolCallId,
          content: typeof r.output === "string" ? r.output : JSON.stringify(r.output),
          ...(r.isError ? { is_error: true } : {}),
        })),
      });
    }
  }
  return out;
}

export const DEFAULT_AGENT_MODEL = DEFAULT_CLAUDE_MODEL;

/**
 * Anthropic-backed AgentModel. Unlike askAi() it does not fall back silently: an agent that
 * cannot reach its model must say so, because a canned answer here would look like an action.
 */
export function anthropicAgentModel(opts: { model?: string; maxTokens?: number } = {}): AgentModel {
  return async ({ system, messages, tools }) => {
    const key = getSecret("ANTHROPIC_API_KEY");
    if (!key) throw new Error("ANTHROPIC_API_KEY is not configured");

    const model = opts.model ?? DEFAULT_AGENT_MODEL;
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({
        model,
        max_tokens: opts.maxTokens ?? 1500,
        system,
        messages: toAnthropicMessages(messages),
        tools: tools.map((t) => ({ name: t.name, description: t.description, input_schema: t.inputSchema })),
      }),
      signal: AbortSignal.timeout(30_000),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      throw new Error(`Anthropic request failed (${anthropicErrorMessage(body, res.status)})`);
    }

    const data = (await res.json()) as { content?: Block[] };
    const usage = readClaudeUsage(data, model, "agent");
    if (usage) reportClaudeUsage(usage);
    const blocks = data.content ?? [];
    const text = blocks
      .filter((b): b is Extract<Block, { type: "text" }> => b.type === "text")
      .map((b) => b.text)
      .join("\n")
      .trim();
    const toolCalls: ToolCall[] = blocks
      .filter((b): b is Extract<Block, { type: "tool_use" }> => b.type === "tool_use")
      .map((b) => ({ id: b.id, name: b.name, input: b.input ?? {} }));
    return { text: text || undefined, toolCalls, usage };
  };
}
