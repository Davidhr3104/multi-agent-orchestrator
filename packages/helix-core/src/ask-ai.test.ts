import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { askAi } from "./ask-ai";
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
