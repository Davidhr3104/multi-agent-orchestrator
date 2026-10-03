import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { callClaude, TRIAGE_MODEL } from "./anthropic";
import { estimateUsd, getAiCostSummary, resetAiCostLedger } from "./ai-cost";
import { claudeResponse, isolateSecrets, jsonResponse } from "./test-env";

let restore: () => void;

beforeEach(() => {
  resetAiCostLedger();
});

afterEach(() => {
  restore?.();
  vi.unstubAllGlobals();
});

describe("callClaude", () => {
  it("makes no network call without ANTHROPIC_API_KEY", async () => {
    restore = isolateSecrets();
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const res = await callClaude({ model: TRIAGE_MODEL, purpose: "triage", prompt: "hi" });
    expect(res.ok).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(getAiCostSummary().calls).toBe(0);
  });

  it("records the token usage the API reports, with an estimated cost", async () => {
    restore = isolateSecrets({ ANTHROPIC_API_KEY: "sk-test" });
    const fetchMock = vi.fn(async () => claudeResponse("ok", { input_tokens: 1000, output_tokens: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const res = await callClaude({ model: TRIAGE_MODEL, purpose: "triage", prompt: "hi", system: "sys" });
    expect(res.ok).toBe(true);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.anthropic.com/v1/messages");
    const headers = init.headers as Record<string, string>;
    expect(headers["x-api-key"]).toBe("sk-test");
    expect(JSON.parse(String(init.body)).model).toBe(TRIAGE_MODEL);
    const summary = getAiCostSummary();
    expect(summary.calls).toBe(1);
    expect(summary.inputTokens).toBe(1000);
    expect(summary.outputTokens).toBe(200);
    expect(summary.estimatedUsd).toBeCloseTo(estimateUsd(TRIAGE_MODEL, 1000, 200).usd, 10);
  });

  it("returns the API error and logs a failed call", async () => {
    restore = isolateSecrets({ ANTHROPIC_API_KEY: "sk-test" });
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse({ error: { message: "model not found" } }, 404)));
    const res = await callClaude({ model: "nope", purpose: "triage", prompt: "hi" });
    expect(res).toMatchObject({ ok: false, error: "model not found" });
    expect(getAiCostSummary().failedCalls).toBe(1);
  });
});

describe("estimateUsd", () => {
  it("prices known models from the table and flags unknown ones", () => {
    expect(estimateUsd("claude-haiku-4-5", 1_000_000, 0)).toEqual({ usd: 1, priceKnown: true });
    expect(estimateUsd("mystery-model", 1_000_000, 0).priceKnown).toBe(false);
    expect(estimateUsd("mystery-model", 1_000_000, 0).usd).toBeGreaterThan(0);
  });
});
