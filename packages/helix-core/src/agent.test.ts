import { describe, expect, it, vi } from "vitest";
import { resumeAgent, runAgent, type AgentModel, type AgentTool, type ModelTurn, type RiskDecision } from "./agent";

/** Scripted model: returns the queued turns in order and records what it was shown. */
function scripted(turns: ModelTurn[]) {
  const seen: Parameters<AgentModel>[0][] = [];
  const model: AgentModel = async (req) => {
    seen.push(structuredClone(req));
    const next = turns.shift();
    if (!next) throw new Error("model called more times than scripted");
    return next;
  };
  return { model, seen };
}

function tool(name: string, risk: RiskDecision | (() => RiskDecision), run = vi.fn(async () => ({ output: { ok: name } }))): AgentTool<null> {
  return {
    name,
    description: name,
    inputSchema: { type: "object" },
    describe: (input) => `${name}(${JSON.stringify(input)})`,
    risk: typeof risk === "function" ? risk : () => risk,
    run,
  };
}

const ask = [{ role: "user" as const, content: "go" }];
const call = (id: string, name: string, input: Record<string, unknown> = {}) => ({ id, name, input });

describe("runAgent", () => {
  it("runs auto tools, feeds the result back, and returns the final answer", async () => {
    const find = tool("find_contact", { level: "auto" });
    const { model, seen } = scripted([
      { toolCalls: [call("1", "find_contact", { q: "ava" })] },
      { text: "Found Ava.", toolCalls: [] },
    ]);
    const r = await runAgent({ system: "s", tools: [find], model, ctx: null }, ask);
    expect(r.answer).toBe("Found Ava.");
    expect(r.steps).toMatchObject([{ tool: "find_contact", status: "executed" }]);
    expect(r.pending).toBeUndefined();
    const toolTurn = seen[1].messages.at(-1);
    expect(toolTurn).toMatchObject({ role: "tool", results: [{ toolCallId: "1", output: { ok: "find_contact" } }] });
  });

  it("stops at a confirm-level tool without running it, and reports why", async () => {
    const send = tool("send_email", { level: "confirm", reasons: ["Sends an external email"] });
    const { model } = scripted([{ text: "Drafted.", toolCalls: [call("1", "send_email", { to: "a@b.c" })] }]);
    const r = await runAgent({ system: "s", tools: [send], model, ctx: null }, ask);
    expect(send.run).not.toHaveBeenCalled();
    expect(r.pending).toMatchObject({ tool: "send_email", input: { to: "a@b.c" }, reasons: ["Sends an external email"] });
    expect(r.steps).toEqual([]);
  });

  it("runs earlier auto calls in the same turn, then pauses on the risky one and skips the rest", async () => {
    const read = tool("read", { level: "auto" });
    const send = tool("send", { level: "confirm", reasons: ["external"] });
    const after = tool("after", { level: "auto" });
    const { model } = scripted([{ toolCalls: [call("1", "read"), call("2", "send"), call("3", "after")] }]);
    const r = await runAgent({ system: "s", tools: [read, send, after], model, ctx: null }, ask);
    expect(read.run).toHaveBeenCalledTimes(1);
    expect(send.run).not.toHaveBeenCalled();
    expect(after.run).not.toHaveBeenCalled();
    expect(r.pending?.toolCallId).toBe("2");
  });

  it("never runs a denied tool and tells the model no", async () => {
    const wipe = tool("wipe", { level: "deny", reasons: ["Deleting is disabled"] });
    const { model, seen } = scripted([
      { toolCalls: [call("1", "wipe")] },
      { text: "I can't delete that.", toolCalls: [] },
    ]);
    const r = await runAgent({ system: "s", tools: [wipe], model, ctx: null }, ask);
    expect(wipe.run).not.toHaveBeenCalled();
    expect(r.steps).toMatchObject([{ status: "denied", reasons: ["Deleting is disabled"] }]);
    expect(JSON.stringify(seen[1].messages.at(-1))).toContain("Not permitted");
  });

  it("treats a throwing risk policy as needing confirmation, never as allowed", async () => {
    const t = tool("t", () => {
      throw new Error("policy exploded");
    });
    const { model } = scripted([{ toolCalls: [call("1", "t")] }]);
    const r = await runAgent({ system: "s", tools: [t], model, ctx: null }, ask);
    expect(t.run).not.toHaveBeenCalled();
    expect(r.pending?.reasons.join(" ")).toContain("policy exploded");
  });

  it("surfaces tool failures as failed steps and tells the model", async () => {
    const boom = tool("boom", { level: "auto" }, vi.fn(async () => {
      throw new Error("calendar offline");
    }));
    const { model, seen } = scripted([{ toolCalls: [call("1", "boom")] }, { text: "That failed.", toolCalls: [] }]);
    const r = await runAgent({ system: "s", tools: [boom], model, ctx: null }, ask);
    expect(r.steps).toMatchObject([{ status: "failed", error: "calendar offline" }]);
    expect(JSON.stringify(seen[1].messages.at(-1))).toContain("calendar offline");
  });

  it("reports unknown tools as failures instead of ignoring them", async () => {
    const { model } = scripted([{ toolCalls: [call("1", "ghost")] }, { text: "ok", toolCalls: [] }]);
    const r = await runAgent({ system: "s", tools: [], model, ctx: null }, ask);
    expect(r.steps).toMatchObject([{ tool: "ghost", status: "failed" }]);
  });

  it("flags truncation when the step budget runs out", async () => {
    const t = tool("loop", { level: "auto" });
    const { model } = scripted([{ toolCalls: [call("1", "loop")] }, { toolCalls: [call("2", "loop")] }]);
    const r = await runAgent({ system: "s", tools: [t], model, ctx: null, maxSteps: 2 }, ask);
    expect(r.truncated).toBe(true);
  });
});

describe("resumeAgent", () => {
  async function paused() {
    const send = tool("send", { level: "confirm", reasons: ["external"] });
    const s = scripted([
      { text: "Ready to send.", toolCalls: [call("1", "send", { to: "ava@x.com" })] },
      { text: "Sent.", toolCalls: [] },
    ]);
    const cfg = { system: "s", tools: [send], model: s.model, ctx: null };
    const first = await runAgent(cfg, ask);
    return { cfg, send, first, s };
  }

  it("runs the approved call exactly once and lets the model finish", async () => {
    const { cfg, send, first } = await paused();
    const r = await resumeAgent(cfg, { messages: first.messages, steps: first.steps, pending: first.pending! }, true);
    expect(send.run).toHaveBeenCalledTimes(1);
    expect(send.run).toHaveBeenCalledWith({ to: "ava@x.com" }, null);
    expect(r.answer).toBe("Sent.");
    expect(r.steps).toMatchObject([{ tool: "send", status: "executed" }]);
    expect(r.pending).toBeUndefined();
  });

  it("does not run a declined call and records the refusal", async () => {
    const { cfg, send, first, s } = await paused();
    const r = await resumeAgent(cfg, { messages: first.messages, steps: first.steps, pending: first.pending! }, false);
    expect(send.run).not.toHaveBeenCalled();
    expect(r.steps).toMatchObject([{ status: "denied", reasons: ["Declined by the operator"] }]);
    expect(JSON.stringify(s.seen[1].messages.at(-1))).toContain("declined_by_user");
  });

  it("rejects a transcript that cannot be resumed instead of guessing", async () => {
    const { cfg, first } = await paused();
    await expect(
      resumeAgent(cfg, { messages: [{ role: "user", content: "x" }], steps: [], pending: first.pending! }, true)
    ).rejects.toThrow(/cannot resume/i);
  });
});
