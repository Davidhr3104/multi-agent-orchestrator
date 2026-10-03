import { afterEach, describe, expect, it, vi } from "vitest";
import { resumeAgent, runAgent, type AgentModel, type AgentTool, type ModelTurn, type RiskDecision } from "./agent";
import { anthropicAgentModel, toAnthropicMessages } from "./agent-anthropic";
import { askAi } from "./ask-ai";
import { completeWithClaude, completeWithClaudeDetailed } from "./claude";
import { estimateClaudeCostUsd, onClaudeUsage, type ClaudeUsage } from "./claude-usage";
import { cronAuthResponse } from "./cron-auth";
import { resetSecretsCache } from "./secrets";

const KEY_ENV = ["ANTHROPIC_API_KEY", "CRON_SECRET"] as const;

function setEnv(values: Partial<Record<(typeof KEY_ENV)[number], string>>) {
  process.env.HELIX_SECRETS_PATH = "__helix-test-no-secrets-file__.json";
  for (const k of KEY_ENV) {
    if (values[k] === undefined) delete process.env[k];
    else process.env[k] = values[k];
  }
  resetSecretsCache();
}

function anthropicReply(body: unknown, status = 200) {
  return vi.fn(async () => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } }));
}

afterEach(() => {
  vi.unstubAllGlobals();
  setEnv({});
});

describe("Claude usage reporting", () => {
  it("completeWithClaudeDetailed returns and reports token usage", async () => {
    setEnv({ ANTHROPIC_API_KEY: "sk-test" });
    vi.stubGlobal("fetch", anthropicReply({ content: [{ type: "text", text: " hi " }], usage: { input_tokens: 120, output_tokens: 30 } }));
    const seen: ClaudeUsage[] = [];
    const off = onClaudeUsage((u) => seen.push(u));
    const out = await completeWithClaudeDetailed("q", { feature: "test" });
    off();
    expect(out).toEqual({ text: "hi", usage: { model: "claude-sonnet-4-20250514", inputTokens: 120, outputTokens: 30, feature: "test" } });
    expect(seen).toHaveLength(1);
  });

  it("completeWithClaude keeps returning plain text", async () => {
    setEnv({ ANTHROPIC_API_KEY: "sk-test" });
    vi.stubGlobal("fetch", anthropicReply({ content: [{ type: "text", text: "ok" }] }));
    expect(await completeWithClaude("q")).toBe("ok");
  });

  it("askAi exposes usage and reports it", async () => {
    setEnv({ ANTHROPIC_API_KEY: "sk-test" });
    vi.stubGlobal("fetch", anthropicReply({ content: [{ type: "text", text: "answer" }], usage: { input_tokens: 10, output_tokens: 5 } }));
    const seen: ClaudeUsage[] = [];
    const off = onClaudeUsage((u) => seen.push(u));
    const r = await askAi({ systemPrompt: "s", history: [{ role: "user", content: "q" }] });
    off();
    expect(r).toMatchObject({ engine: "claude", answer: "answer", usage: { inputTokens: 10, outputTokens: 5, feature: "ask-ai" } });
    expect(seen[0]?.feature).toBe("ask-ai");
  });

  it("a throwing usage listener never breaks the call", async () => {
    setEnv({ ANTHROPIC_API_KEY: "sk-test" });
    vi.stubGlobal("fetch", anthropicReply({ content: [{ type: "text", text: "ok" }], usage: { input_tokens: 1, output_tokens: 1 } }));
    const off = onClaudeUsage(() => {
      throw new Error("panel broke");
    });
    expect(await completeWithClaude("q")).toBe("ok");
    off();
  });

  it("estimates cost by model family", () => {
    expect(estimateClaudeCostUsd({ model: "claude-sonnet-4-20250514", inputTokens: 1_000_000, outputTokens: 1_000_000 })).toBe(18);
    expect(estimateClaudeCostUsd({ model: "claude-haiku-4-5", inputTokens: 1_000_000, outputTokens: 0 })).toBe(1);
  });
});

describe("anthropicAgentModel", () => {
  it("reports usage and surfaces Anthropic's error message", async () => {
    setEnv({ ANTHROPIC_API_KEY: "sk-test" });
    vi.stubGlobal("fetch", anthropicReply({ content: [{ type: "text", text: "done" }], usage: { input_tokens: 7, output_tokens: 3 } }));
    const turn = await anthropicAgentModel()({ system: "s", messages: [{ role: "user", content: "q" }], tools: [] });
    expect(turn.usage).toMatchObject({ inputTokens: 7, outputTokens: 3, feature: "agent" });

    vi.stubGlobal("fetch", anthropicReply({ error: { type: "not_found_error", message: "model: claude-x" } }, 404));
    await expect(anthropicAgentModel({ model: "claude-x" })({ system: "s", messages: [], tools: [] })).rejects.toThrow(
      "Anthropic request failed (404: model: claude-x)"
    );
  });

  it("drops empty assistant turns from the transcript", () => {
    const out = toAnthropicMessages([
      { role: "user", content: "a" },
      { role: "assistant", toolCalls: [] },
      { role: "user", content: "b" },
    ]);
    expect(out).toEqual([
      { role: "user", content: "a" },
      { role: "user", content: "b" },
    ]);
  });
});

function tool(name: string, risk: () => RiskDecision): AgentTool<null> {
  return {
    name,
    description: name,
    inputSchema: { type: "object" },
    describe: () => name,
    risk,
    run: vi.fn(async () => ({ output: { ok: name } })),
  };
}

describe("agent loop resilience", () => {
  it("keeps the record of executed steps when the model fails mid-run", async () => {
    const draft = tool("draft", () => ({ level: "auto" }));
    let calls = 0;
    const model: AgentModel = async (): Promise<ModelTurn> => {
      calls += 1;
      if (calls === 1) return { toolCalls: [{ id: "1", name: "draft", input: {} }] };
      throw new Error("overloaded");
    };
    const r = await runAgent({ system: "s", tools: [draft], model, ctx: null }, [{ role: "user", content: "go" }]);
    expect(r.error).toBe("overloaded");
    expect(r.steps).toMatchObject([{ tool: "draft", status: "executed" }]);
    expect(r.answer).toContain("Already done: draft");
  });

  it("still throws when the model fails before anything ran", async () => {
    const model: AgentModel = async () => {
      throw new Error("no key");
    };
    await expect(runAgent({ system: "s", tools: [], model, ctx: null }, [{ role: "user", content: "go" }])).rejects.toThrow("no key");
  });

  it("re-checks risk on resume and refuses an approved call that is now denied", async () => {
    let state: RiskDecision = { level: "confirm", reasons: ["external send"] };
    const send = tool("send", () => state);
    const first: AgentModel = async () => ({ toolCalls: [{ id: "1", name: "send", input: {} }] });
    const paused = await runAgent({ system: "s", tools: [send], model: first, ctx: null }, [{ role: "user", content: "go" }]);
    expect(paused.pending?.tool).toBe("send");

    state = { level: "deny", reasons: ["already sent"] };
    const after: AgentModel = async () => ({ text: "ok", toolCalls: [] });
    const r = await resumeAgent({ system: "s", tools: [send], model: after, ctx: null }, { messages: paused.messages, steps: paused.steps, pending: paused.pending! }, true);
    expect(send.run).not.toHaveBeenCalled();
    expect(r.steps).toMatchObject([{ tool: "send", status: "denied", reasons: ["already sent"] }]);
  });
});

describe("cronAuthResponse", () => {
  const req = (auth?: string) => new Request("https://x.test/api/cron/job", { headers: auth ? { authorization: auth } : {} });

  it("refuses to run without CRON_SECRET", () => {
    setEnv({});
    expect(cronAuthResponse(req("Bearer anything"))?.status).toBe(503);
  });

  it("rejects a wrong or missing token and accepts the right one", () => {
    setEnv({ CRON_SECRET: "s3cret" });
    expect(cronAuthResponse(req())?.status).toBe(401);
    expect(cronAuthResponse(req("Bearer nope"))?.status).toBe(401);
    expect(cronAuthResponse(req("Bearer s3cret"))).toBeNull();
  });
});
