import { describe, expect, it } from "vitest";
import { toAnthropicMessages } from "./agent-anthropic";

describe("toAnthropicMessages", () => {
  it("maps a full tool round-trip to tool_use / tool_result blocks", () => {
    const out = toAnthropicMessages([
      { role: "user", content: "write to ava" },
      { role: "assistant", text: "Looking.", toolCalls: [{ id: "t1", name: "find", input: { q: "ava" } }] },
      { role: "tool", results: [{ toolCallId: "t1", output: { matches: 2 } }, { toolCallId: "t2", output: { error: "x" }, isError: true }] },
    ]);
    expect(out[0]).toEqual({ role: "user", content: "write to ava" });
    expect(out[1]).toEqual({
      role: "assistant",
      content: [
        { type: "text", text: "Looking." },
        { type: "tool_use", id: "t1", name: "find", input: { q: "ava" } },
      ],
    });
    expect(out[2]).toEqual({
      role: "user",
      content: [
        { type: "tool_result", tool_use_id: "t1", content: '{"matches":2}' },
        { type: "tool_result", tool_use_id: "t2", content: '{"error":"x"}', is_error: true },
      ],
    });
  });
});
