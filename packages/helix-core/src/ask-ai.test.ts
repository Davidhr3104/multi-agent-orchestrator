import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { askAi, askAiWithProposal } from "./ask-ai";
import { resetSecretsCache, setSecrets } from "./secrets";

const prevPath = process.env.HELIX_SECRETS_PATH;
const dir = mkdtempSync(path.join(tmpdir(), "helix-ask-ai-"));
process.env.HELIX_SECRETS_PATH = path.join(dir, "secrets.json");

afterAll(() => {
  setSecrets({ ANTHROPIC_API_KEY: "" });
  if (prevPath) process.env.HELIX_SECRETS_PATH = prevPath;
  else delete process.env.HELIX_SECRETS_PATH;
  resetSecretsCache();
  rmSync(dir, { recursive: true, force: true });
});

beforeEach(() => {
  setSecrets({ ANTHROPIC_API_KEY: "" });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("askAi", () => {
  it("falls back to the record context when Claude is not configured", async () => {
    const result = await askAi({
      systemPrompt: "You explain Helix for Leads.",
      recordContext: "Lead score: 72, tier: warm.",
      history: [{ role: "user", content: "Why this score?" }],
    });
    expect(result).toEqual({
      answer: "Lead score: 72, tier: warm.",
      engine: "fallback",
    });
  });

  it("falls back to a fixed unavailable message when not configured and there is no record context", async () => {
    const result = await askAi({
      systemPrompt: "You explain Helix for Leads.",
      history: [{ role: "user", content: "What does tier mean?" }],
    });
    expect(result.engine).toBe("fallback");
    expect(result.answer).toBe(
      "Ask AI needs an Anthropic API key configured to answer questions."
    );
  });

  it("calls Claude with the full history and system context when configured", async () => {
    setSecrets({ ANTHROPIC_API_KEY: "sk-ant-test-key" });
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        content: [{ type: "text", text: "This lead scored 72 because of budget fit." }],
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const history = [
      { role: "user" as const, content: "Why this score?" },
    ];
    const result = await askAi({
      systemPrompt: "You explain Helix for Leads.",
      recordContext: "Lead score: 72, tier: warm.",
      history,
    });

    expect(result).toEqual({
      answer: "This lead scored 72 because of budget fit.",
      engine: "claude",
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.anthropic.com/v1/messages",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          "x-api-key": "sk-ant-test-key",
        }),
      })
    );
    const body = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    expect(body.system).toBe("You explain Helix for Leads.\n\nLead score: 72, tier: warm.");
    expect(body.messages).toEqual(history);
  });

  it("falls back when the Claude call throws", async () => {
    setSecrets({ ANTHROPIC_API_KEY: "sk-ant-test-key" });
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network down")));

    const result = await askAi({
      systemPrompt: "You explain Helix for Leads.",
      recordContext: "Lead score: 72, tier: warm.",
      history: [{ role: "user", content: "Why this score?" }],
    });

    expect(result).toEqual({
      answer: "Lead score: 72, tier: warm.",
      engine: "fallback",
    });
  });

  it("falls back when Claude responds with a non-ok status", async () => {
    setSecrets({ ANTHROPIC_API_KEY: "sk-ant-test-key" });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false }));

    const result = await askAi({
      systemPrompt: "You explain Helix for Leads.",
      recordContext: "Lead score: 72, tier: warm.",
      history: [{ role: "user", content: "Why this score?" }],
    });

    expect(result.engine).toBe("fallback");
  });
});

describe("askAiWithProposal", () => {
  it("falls back to the record context when Claude is not configured", async () => {
    const result = await askAiWithProposal({
      systemPrompt: "You explain Helix for Leads.",
      recordContext: "5 leads, 2 cold.",
      history: [{ role: "user", content: "Archive my cold leads" }],
      proposalInstruction: "Propose archive_leads when asked to clean up stale leads.",
    });
    expect(result).toEqual({ answer: "5 leads, 2 cold.", engine: "fallback" });
    expect(result.proposal).toBeUndefined();
  });

  it("returns a plain answer with no proposal when the response has no JSON block", async () => {
    setSecrets({ ANTHROPIC_API_KEY: "sk-ant-test-key" });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          content: [{ type: "text", text: "Your hottest lead is Acme Corp at 90." }],
        }),
      })
    );

    const result = await askAiWithProposal({
      systemPrompt: "You explain Helix for Leads.",
      history: [{ role: "user", content: "What's my hottest lead?" }],
      proposalInstruction: "Propose archive_leads when asked to clean up stale leads.",
    });

    expect(result).toEqual({ answer: "Your hottest lead is Acme Corp at 90.", engine: "claude" });
    expect(result.proposal).toBeUndefined();
  });

  it("parses a valid fenced action_proposal JSON block", async () => {
    setSecrets({ ANTHROPIC_API_KEY: "sk-ant-test-key" });
    const proposalJson = JSON.stringify({
      type: "action_proposal",
      action: "archive_leads",
      summary: "I found 2 cold leads with no activity in 30+ days.",
      targets: [
        { id: "lead-1", label: "Acme Corp" },
        { id: "lead-2", label: "Beta LLC" },
      ],
    });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          content: [{ type: "text", text: "```json\n" + proposalJson + "\n```" }],
        }),
      })
    );

    const result = await askAiWithProposal({
      systemPrompt: "You explain Helix for Leads.",
      history: [{ role: "user", content: "Archive my cold leads" }],
      proposalInstruction: "Propose archive_leads when asked to clean up stale leads.",
    });

    expect(result.engine).toBe("claude");
    expect(result.proposal).toEqual({
      type: "action_proposal",
      action: "archive_leads",
      summary: "I found 2 cold leads with no activity in 30+ days.",
      targets: [
        { id: "lead-1", label: "Acme Corp" },
        { id: "lead-2", label: "Beta LLC" },
      ],
    });
    expect(result.answer).toBe("I found 2 cold leads with no activity in 30+ days.");
  });

  it("treats malformed JSON in a fenced block as no proposal, never throws", async () => {
    setSecrets({ ANTHROPIC_API_KEY: "sk-ant-test-key" });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          content: [{ type: "text", text: "```json\n{ not: valid json\n```" }],
        }),
      })
    );

    const result = await askAiWithProposal({
      systemPrompt: "You explain Helix for Leads.",
      history: [{ role: "user", content: "Archive my cold leads" }],
      proposalInstruction: "Propose archive_leads when asked to clean up stale leads.",
    });

    expect(result.engine).toBe("claude");
    expect(result.proposal).toBeUndefined();
    expect(result.answer).toContain("not: valid json");
  });

  it("falls back when Claude is unreachable", async () => {
    setSecrets({ ANTHROPIC_API_KEY: "sk-ant-test-key" });
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network down")));

    const result = await askAiWithProposal({
      systemPrompt: "You explain Helix for Leads.",
      recordContext: "5 leads, 2 cold.",
      history: [{ role: "user", content: "Archive my cold leads" }],
      proposalInstruction: "Propose archive_leads when asked to clean up stale leads.",
    });

    expect(result).toEqual({ answer: "5 leads, 2 cold.", engine: "fallback" });
    expect(result.proposal).toBeUndefined();
  });

  it("includes image attachments as content blocks alongside text", async () => {
    setSecrets({ ANTHROPIC_API_KEY: "sk-ant-test-key" });
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ content: [{ type: "text", text: "I see a screenshot of a lead list." }] }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await askAiWithProposal({
      systemPrompt: "You explain Helix for Leads.",
      history: [
        {
          role: "user",
          content: "What do you see?",
          attachments: [{ type: "image", data: "base64data", mediaType: "image/png" }],
        },
      ],
      proposalInstruction: "Propose archive_leads when asked to clean up stale leads.",
    });

    const body = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    expect(body.messages[0].content).toEqual([
      { type: "image", source: { type: "base64", media_type: "image/png", data: "base64data" } },
      { type: "text", text: "What do you see?" },
    ]);
  });
});
