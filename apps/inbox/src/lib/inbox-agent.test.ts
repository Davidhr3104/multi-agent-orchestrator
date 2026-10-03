import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AgentMessage, AgentModel, ModelRequest, ModelTurn } from "@helix/core";
import { resetAiUsage, summarizeAiUsage } from "./ai-usage";
import { anthropicTranscript, inboxAgentModel, INBOX_AGENT_MODEL, INBOX_AGENT_TOOLS, type CalendarSnapshot, type InboxAgentCtx } from "./inbox-agent";
import { continueAgent, startAgent, verifyAgentState, type AgentPayload } from "./inbox-agent-session";
import { getThread, ingestMessage, loadDemoCatalog, patchMessage } from "./store";

const NOW = new Date("2026-10-05T14:00:00Z"); // Mon 08:00 in Mexico City
const AVA_EMAIL = "ava@lindqvist.co";

const calendar: CalendarSnapshot = {
  source: "google_calendar",
  connected: true,
  error: null,
  timeZone: "America/Mexico_City",
  events: [
    {
      id: "g1",
      title: "Quarterly sync with Ava",
      start: "2026-10-06T16:00:00.000Z",
      end: "2026-10-06T16:30:00.000Z",
      allDay: false,
      busy: true,
      location: "Google Meet",
      htmlLink: "https://meet.google.com/abc",
      organizerEmail: "me@company.com",
      attendees: [{ email: AVA_EMAIL }],
    },
  ],
};

function ctx(over: Partial<InboxAgentCtx> = {}): InboxAgentCtx {
  return { actor: "Helix AI · approved by test", touched: new Set(), canAutoRun: true, now: NOW, loadCalendar: async () => calendar, ...over };
}

function lastToolOutput(messages: AgentMessage[], toolCallId?: string): Record<string, unknown> {
  const last = [...messages].reverse().find((m): m is Extract<AgentMessage, { role: "tool" }> => m.role === "tool");
  const result = toolCallId ? last?.results.find((r) => r.toolCallId === toolCallId) : last?.results[0];
  return (result?.output ?? {}) as Record<string, unknown>;
}

/** Plays the "Ava wrote me, check my calendar and answer her" flow, reading real tool results each turn. */
function avaModel(seen: ModelRequest[] = []): AgentModel {
  let threadId = "";
  return async (req): Promise<ModelTurn> => {
    seen.push(req);
    const turn = req.messages.filter((m) => m.role === "assistant").length;
    if (turn === 0) return { toolCalls: [{ id: "c1", name: "find_contact", input: { name_or_email: "Ava" } }] };
    if (turn === 1) {
      const contact = (lastToolOutput(req.messages).contacts as Array<{ email: string; thread_ids: string[] }>)[0];
      threadId = contact.thread_ids[0];
      return { toolCalls: [{ id: "c2", name: "calendar_lookup", input: { contact_email: contact.email } }] };
    }
    if (turn === 2) {
      const meeting = (lastToolOutput(req.messages).meetings_with_contact as Array<{ local: string }>)[0];
      return {
        text: "Here is a reply with the real meeting time.",
        toolCalls: [
          { id: "c3", name: "draft_reply", input: { thread_id: threadId, text: `Hi Ava, confirmed: we meet ${meeting.local}.` } },
          { id: "c4", name: "send_reply", input: { thread_id: threadId } },
        ],
      };
    }
    const result = lastToolOutput(req.messages, "c4");
    return { text: result.status === "declined_by_user" ? "Okay, I did not send it." : "Done — marked as sent (demo: nothing was emailed).", toolCalls: [] };
  };
}

let avaThreadId = "";

beforeEach(async () => {
  vi.stubEnv("HELIX_SECRETS_PATH", "./.no-secrets-in-tests.json");
  vi.stubEnv("ANTHROPIC_API_KEY", "");
  vi.stubEnv("HELIX_OPERATOR_KEY", "test-operator-key");
  await loadDemoCatalog();
  const m = await ingestMessage({
    fromName: "Ava Lindqvist",
    fromEmail: AVA_EMAIL,
    subject: "Are we still on this week?",
    body: "Hi! Can you confirm when we are meeting this week? Thanks, Ava",
  });
  avaThreadId = m.id;
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

async function runAva(over: Partial<InboxAgentCtx> = {}): Promise<AgentPayload> {
  return startAgent(ctx(over), [{ role: "user", content: "Ava wrote me, check her in my calendar and answer her" }], avaModel());
}

describe("Ask Helix agent: Ava wrote me", () => {
  it("finds the thread, reads the calendar, drafts with the real time and stops before sending", async () => {
    const r = await runAva();
    expect(r.agent.steps.map((s) => [s.tool, s.status])).toEqual([
      ["find_contact", "executed"],
      ["calendar_lookup", "executed"],
      ["draft_reply", "executed"],
    ]);
    expect(r.agent.pending?.tool).toBe("send_reply");
    expect(r.agent.pending?.reasons.join(" ")).toMatch(/cannot be recalled/);
    expect(r.agent.pending?.preview?.to).toContain(AVA_EMAIL);
    expect(r.agent.pending?.preview?.text).toContain("Tuesday, October 6 at 10:00 AM");
    expect(r.agent.pending?.state).toBeTruthy();
    // Draft written (with Undo), nothing sent.
    const t = await getThread(avaThreadId);
    expect(t?.draftReply).toContain("October 6 at 10:00 AM");
    expect(t?.status).not.toBe("sent");
    expect(r.executed?.undo.map((u) => u.action)).toEqual(["write_draft"]);
  });

  it("sends only after the operator approves, and says the demo emailed nothing", async () => {
    const paused = await runAva();
    const verified = verifyAgentState(paused.agent.pending!.state);
    expect(verified.ok).toBe(true);
    const done = await continueAgent(ctx(), verified.ok ? verified.state : (null as never), true, avaModel());
    expect(done.agent.steps[0]).toMatchObject({ tool: "send_reply", status: "executed" });
    expect((await getThread(avaThreadId))?.status).toBe("sent");
    expect(done.answer).toMatch(/nothing was emailed/);
  });

  it("does not send when the operator declines", async () => {
    const paused = await runAva();
    const verified = verifyAgentState(paused.agent.pending!.state);
    const done = await continueAgent(ctx(), verified.ok ? verified.state : (null as never), false, avaModel());
    expect(done.agent.steps[0]).toMatchObject({ tool: "send_reply", status: "denied" });
    expect((await getThread(avaThreadId))?.status).not.toBe("sent");
    expect(done.answer).toMatch(/did not send/);
  });

  it("refuses to send if the draft changed after the confirmation card was shown", async () => {
    const paused = await runAva();
    await patchMessage(avaThreadId, { draftReply: "Something else entirely" });
    const verified = verifyAgentState(paused.agent.pending!.state);
    await expect(continueAgent(ctx(), verified.ok ? verified.state : (null as never), true, avaModel())).rejects.toThrow(/draft changed/);
    expect((await getThread(avaThreadId))?.status).not.toBe("sent");
  });

  it("rejects a confirmation whose contents were altered in the browser", async () => {
    const paused = await runAva();
    const [payload, sig] = paused.agent.pending!.state!.split(".");
    const state = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    state.pending.input.thread_id = "thr-someone-else";
    const forged = `${Buffer.from(JSON.stringify(state)).toString("base64url")}.${sig}`;
    expect(verifyAgentState(forged)).toEqual({ ok: false, error: "This confirmation was altered." });
    expect(verifyAgentState(paused.agent.pending!.state, Date.now() + 16 * 60_000).ok).toBe(false);
  });

  it("on a locked live desk even the draft waits for a person", async () => {
    const r = await runAva({ canAutoRun: false });
    expect(r.agent.pending?.tool).toBe("draft_reply");
    expect((await getThread(avaThreadId))?.draftReply).not.toContain("October 6");
  });

  it("tells the model the calendar could not be read instead of inventing times", async () => {
    const seen: ModelRequest[] = [];
    const offline = async (): Promise<CalendarSnapshot> => ({ source: "google_calendar", connected: false, error: "Reconnect Google", timeZone: "UTC", events: [] });
    const model: AgentModel = async (req) => {
      seen.push(req);
      return seen.length === 1 ? { toolCalls: [{ id: "x", name: "calendar_lookup", input: { contact_email: AVA_EMAIL } }] } : { text: "I could not read your calendar.", toolCalls: [] };
    };
    const r = await startAgent(ctx({ loadCalendar: offline }), [{ role: "user", content: "When do I meet Ava?" }], model);
    expect(lastToolOutput(seen[1].messages)).toMatchObject({ connected: false, error: "Reconnect Google" });
    expect(r.agent.pending).toBeUndefined();
  });

  it("keeps the record of steps that ran when Claude fails mid-run", async () => {
    let calls = 0;
    const flaky: AgentModel = async () => {
      calls += 1;
      if (calls === 1) return { toolCalls: [{ id: "a", name: "search_threads", input: { query: "Ava" } }] };
      throw new Error("Anthropic request failed (529)");
    };
    const r = await startAgent(ctx(), [{ role: "user", content: "find Ava" }], flaky);
    expect(r.agent.steps.map((s) => s.tool)).toEqual(["search_threads"]);
    expect(r.answer).toMatch(/could not reach Claude.*Only the steps listed here actually ran/);
  });

  it("marks every outbound tool as confirm-only, whatever the desk state", async () => {
    for (const name of ["send_reply", "send_message"]) {
      const tool = INBOX_AGENT_TOOLS.find((t) => t.name === name)!;
      const decision = await tool.risk({ thread_id: avaThreadId, to: "+15550001111", body: "hi", channel: "sms" }, ctx());
      expect(decision.level).toBe("confirm");
    }
  });
});

describe("inboxAgentModel", () => {
  it("calls Anthropic with the pinned model and tools, parses tool_use and records estimated cost", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "sk-test");
    resetAiUsage();
    const fetchMock = vi.fn(async () =>
      new Response(
        JSON.stringify({
          content: [
            { type: "text", text: "Looking her up." },
            { type: "tool_use", id: "tu1", name: "find_contact", input: { name_or_email: "Ava" } },
          ],
          usage: { input_tokens: 1000, output_tokens: 200 },
        }),
        { status: 200 }
      )
    );
    vi.stubGlobal("fetch", fetchMock);
    const turn = await inboxAgentModel()({
      system: "s",
      messages: [{ role: "user", content: "Ava wrote me" }],
      tools: [{ name: "find_contact", description: "d", inputSchema: { type: "object" } }],
    });
    expect(turn).toEqual({ text: "Looking her up.", toolCalls: [{ id: "tu1", name: "find_contact", input: { name_or_email: "Ava" } }] });
    const body = JSON.parse(String((fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1].body));
    expect(body.model).toBe(INBOX_AGENT_MODEL);
    expect(body.tools[0]).toEqual({ name: "find_contact", description: "d", input_schema: { type: "object" } });
    const usage = summarizeAiUsage();
    expect(usage).toMatchObject({ calls: 1, inputTokens: 1000, outputTokens: 200, estimated: true });
    expect(usage.estimatedUsd).toBeCloseTo((1000 * 3 + 200 * 15) / 1_000_000, 10);
  });

  it("drops empty assistant turns that Anthropic would reject", () => {
    const out = anthropicTranscript([
      { role: "user", content: "hi" },
      { role: "assistant", toolCalls: [] },
      { role: "user", content: "again" },
    ]);
    expect(out.map((m) => m.role)).toEqual(["user", "user"]);
  });
});
