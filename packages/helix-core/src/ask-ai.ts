import { DEFAULT_CLAUDE_MODEL, parseJsonObject } from "./claude";
import { readClaudeUsage, reportClaudeUsage, type ClaudeUsage } from "./claude-usage";
import { getSecret } from "./secrets";

export type AskAiRole = "user" | "assistant";
export type AskAiAttachment = { type: "image"; data: string; mediaType: string };
export type AskAiMessage = { role: AskAiRole; content: string; attachments?: AskAiAttachment[] };
export type AskAiEngine = "claude" | "fallback";
export type AskAiResult = { answer: string; engine: AskAiEngine; usage?: ClaudeUsage };

export type AskAiActionProposal = {
  type: "action_proposal";
  action: string;
  summary: string;
  targets: { id: string; label: string }[];
};

export type AskAiDrawerResult = AskAiResult & {
  proposal?: AskAiActionProposal;
};

const UNAVAILABLE_MESSAGE =
  "Ask AI needs an Anthropic API key configured to answer questions.";

function fallback(recordContext?: string): AskAiResult {
  return { answer: recordContext ?? UNAVAILABLE_MESSAGE, engine: "fallback" };
}

type AnthropicContentBlock =
  | { type: "text"; text: string }
  | { type: "image"; source: { type: "base64"; media_type: string; data: string } };

function toAnthropicMessage(message: AskAiMessage): { role: AskAiRole; content: string | AnthropicContentBlock[] } {
  if (!message.attachments || message.attachments.length === 0) {
    return { role: message.role, content: message.content };
  }
  const blocks: AnthropicContentBlock[] = message.attachments.map((a) => ({
    type: "image",
    source: { type: "base64", media_type: a.mediaType, data: a.data },
  }));
  blocks.push({ type: "text", text: message.content });
  return { role: message.role, content: blocks };
}

async function callAnthropic(params: {
  system: string;
  history: AskAiMessage[];
  key: string;
  feature: string;
}): Promise<{ text: string; usage?: ClaudeUsage } | null> {
  const { system, history, key, feature } = params;
  const model = DEFAULT_CLAUDE_MODEL;
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model,
      max_tokens: 900,
      system,
      messages: history.map(toAnthropicMessage),
    }),
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) return null;

  const data = (await res.json()) as {
    content?: { type: string; text?: string }[];
  };
  const usage = readClaudeUsage(data, model, feature);
  if (usage) reportClaudeUsage(usage);
  const text = data.content?.find((c) => c.type === "text")?.text?.trim();
  return text ? { text, usage } : null;
}

export async function askAi(params: {
  systemPrompt: string;
  recordContext?: string;
  history: AskAiMessage[];
}): Promise<AskAiResult> {
  const { systemPrompt, recordContext, history } = params;
  const key = getSecret("ANTHROPIC_API_KEY");
  if (!key) return fallback(recordContext);

  const system = recordContext ? `${systemPrompt}\n\n${recordContext}` : systemPrompt;

  try {
    const out = await callAnthropic({ system, history, key, feature: "ask-ai" });
    if (!out) return fallback(recordContext);
    return { answer: out.text, engine: "claude", usage: out.usage };
  } catch {
    return fallback(recordContext);
  }
}

/**
 * Like askAi(), but additionally lets the caller instruct the model to emit
 * a fenced JSON action-proposal block when the user's request matches an
 * app-defined action. `action`/`proposalInstruction` are opaque strings the
 * caller owns — this function has no built-in notion of what actions exist,
 * keeping helix-core domain-agnostic across apps (Leads' "archive_leads" is
 * meaningless here; a future Commerce action would be equally opaque).
 */
export async function askAiWithProposal(params: {
  systemPrompt: string;
  recordContext?: string;
  history: AskAiMessage[];
  proposalInstruction: string;
}): Promise<AskAiDrawerResult> {
  const { systemPrompt, recordContext, history, proposalInstruction } = params;
  const key = getSecret("ANTHROPIC_API_KEY");
  if (!key) return fallback(recordContext);

  const system = [systemPrompt, recordContext, proposalInstruction].filter(Boolean).join("\n\n");

  try {
    const out = await callAnthropic({ system, history, key, feature: "ask-ai" });
    if (!out) return fallback(recordContext);

    const proposal = parseJsonObject<AskAiActionProposal>(out.text);
    if (proposal && proposal.type === "action_proposal" && Array.isArray(proposal.targets)) {
      return { answer: proposal.summary, engine: "claude", proposal, usage: out.usage };
    }
    return { answer: out.text, engine: "claude", usage: out.usage };
  } catch {
    return fallback(recordContext);
  }
}
