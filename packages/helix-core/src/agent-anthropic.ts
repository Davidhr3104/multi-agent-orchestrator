import type { AgentMessage, AgentModel, ToolCall } from "./agent";
import { getSecret } from "./secrets";

type Block =
  | { type: "text"; text: string }
  | { type: "tool_use"; id: string; name: string; input: Record<string, unknown> }
  | { type: "tool_result"; tool_use_id: string; content: string; is_error?: boolean };

/** Maps the provider-neutral transcript onto Anthropic's tool-use message format. */
export function toAnthropicMessages(messages: AgentMessage[]): { role: "user" | "assistant"; content: string | Block[] }[] {
  return messages.map((m) => {
    if (m.role === "user") return { role: "user", content: m.content };
    if (m.role === "assistant") {
      const blocks: Block[] = [];
      if (m.text) blocks.push({ type: "text", text: m.text });
      for (const c of m.toolCalls ?? []) blocks.push({ type: "tool_use", id: c.id, name: c.name, input: c.input });
      return { role: "assistant", content: blocks.length ? blocks : "" };
    }
    return {
      role: "user",
      content: m.results.map((r) => ({
        type: "tool_result" as const,
        tool_use_id: r.toolCallId,
        content: typeof r.output === "string" ? r.output : JSON.stringify(r.output),
        ...(r.isError ? { is_error: true } : {}),
      })),
    };
  });
}

export const DEFAULT_AGENT_MODEL = "claude-sonnet-5-5";

/**
 * Anthropic-backed AgentModel. Unlike askAi() it does not fall back silently: an agent that
 * cannot reach its model must say so, because a canned answer here would look like an action.
 */
export function anthropicAgentModel(opts: { model?: string; maxTokens?: number } = {}): AgentModel {
  return async ({ system, messages, tools }) => {
    const key = getSecret("ANTHROPIC_API_KEY");
    if (!key) throw new Error("ANTHROPIC_API_KEY is not configured");

    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({
        model: opts.model ?? DEFAULT_AGENT_MODEL,
        max_tokens: opts.maxTokens ?? 1500,
        system,
        messages: toAnthropicMessages(messages),
        tools: tools.map((t) => ({ name: t.name, description: t.description, input_schema: t.inputSchema })),
      }),
      signal: AbortSignal.timeout(30_000),
    });
    if (!res.ok) throw new Error(`Anthropic request failed (${res.status})`);

    const data = (await res.json()) as { content?: Block[] };
    const blocks = data.content ?? [];
    const text = blocks
      .filter((b): b is Extract<Block, { type: "text" }> => b.type === "text")
      .map((b) => b.text)
      .join("\n")
      .trim();
    const toolCalls: ToolCall[] = blocks
      .filter((b): b is Extract<Block, { type: "tool_use" }> => b.type === "tool_use")
      .map((b) => ({ id: b.id, name: b.name, input: b.input ?? {} }));
    return { text: text || undefined, toolCalls };
  };
}
