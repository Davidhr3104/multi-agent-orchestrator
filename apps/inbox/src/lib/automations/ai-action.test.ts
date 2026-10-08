import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { restoreDeskActions, runDeskAction, runWithPolicy, setSecrets } from "@helix/core";
import { inboxActions, type InboxCtx } from "../ai-actions";
import { buildDemoReply } from "../demo-assistant";
import { loadDemoCatalog } from "../store";
import { emptyState, type AutomationState } from "./service";
import type { AutomationAccess } from "./storage";

function fakeAccess(initial: AutomationState = emptyState(), limit = 4): AutomationAccess & { saved: AutomationState } {
  let state = initial;
  const a = {
    mode: "demo" as const,
    limit,
    dirty: false,
    current: null as AutomationState | null,
    get saved() {
      return state;
    },
    async load() {
      return state;
    },
    async save(next: AutomationState) {
      state = next;
    },
  };
  return a;
}

const ctxWith = (automations: AutomationAccess): InboxCtx => ({ actor: "Helix AI · approved by test", touched: new Set(), automations });

beforeEach(async () => {
  await loadDemoCatalog();
  setSecrets({ SLACK_WEBHOOK_URL: "" });
});
afterEach(() => setSecrets({ SLACK_WEBHOOK_URL: "" }));

describe("asking Helix in chat to create a routine", () => {
  it("turns the sentence into a proposal that must be confirmed, with every field from the sentence", async () => {
    const reply = buildDemoReply("Helix, send me a summary of my inbox every day at 9pm on slack", []);
    expect(reply.command).toBe(true);
    expect(reply.proposal?.action).toBe("create_automation");
    expect(reply.proposal?.params).toEqual({ source: "inbox.daily_digest", channel: "slack", time: "21:00" });
    const gate = await runWithPolicy(inboxActions, reply.proposal!, ctxWith(fakeAccess()), { canAutoRun: true });
    expect("proposal" in gate && gate.reasons.join(" ")).toMatch(/on a schedule/i);
  });

  it("asks for the time instead of guessing it", () => {
    const reply = buildDemoReply("send me a daily summary on slack", []);
    expect(reply.proposal).toBeUndefined();
    expect(reply.answer).toMatch(/what time/i);
  });

  it("when Slack is not connected it is created as a draft and the reply says what to connect", async () => {
    const access = fakeAccess();
    const proposal = buildDemoReply("send me a summary every day at 9pm on slack", []).proposal!;
    const r = await runDeskAction(inboxActions, { action: proposal.action, targetIds: proposal.targets.map((t) => t.id), params: proposal.params }, ctxWith(access));
    expect(r.failed).toEqual([]);
    expect(access.saved.automations).toHaveLength(1);
    const created = access.saved.automations[0];
    expect(created.status).toBe("draft");
    expect(created.confirmedAt).not.toBeNull();
    expect(created.missing.map((m) => m.kind).sort()).toEqual(["connection", "setting"]);
    expect(r.resultText).toContain("not active yet");
    expect(r.resultText).not.toMatch(/\bis active\b/);
    expect(r.resultText).toContain("Connect Slack");
  });

  it("when everything is in place it is active and the reply lists exactly what it sends", async () => {
    setSecrets({ SLACK_WEBHOOK_URL: "https://hooks.slack.com/services/T000/B000/XXXX" });
    const access = fakeAccess({ ...emptyState(), timezone: "America/Mexico_City" });
    const proposal = buildDemoReply("send me a summary every day at 9pm on slack", []).proposal!;
    const r = await runDeskAction(inboxActions, { action: proposal.action, targetIds: proposal.targets.map((t) => t.id), params: proposal.params }, ctxWith(access));
    expect(access.saved.automations[0].status).toBe("active");
    expect(r.resultText).toContain("is active");
    expect(r.resultText).toContain("9:00 pm");
    expect(r.resultText).toContain("threads received in the last 24 hours");
  });

  it("Undo removes what was created", async () => {
    const access = fakeAccess();
    const proposal = buildDemoReply("send me a summary every day at 9pm", []).proposal!;
    const r = await runDeskAction(inboxActions, { action: proposal.action, targetIds: proposal.targets.map((t) => t.id), params: proposal.params }, ctxWith(access));
    expect(access.saved.automations).toHaveLength(1);
    const undone = await restoreDeskActions(inboxActions, JSON.parse(JSON.stringify(r.undo)), ctxWith(access));
    expect(undone.failed).toEqual([]);
    expect(access.saved.automations).toHaveLength(0);
  });

  it("rejects bad params before anything is created", async () => {
    const access = fakeAccess();
    await expect(runDeskAction(inboxActions, { action: "create_automation", targetIds: ["auto-x"], params: { source: "inbox.nope", channel: "slack", time: "21:00" } }, ctxWith(access))).rejects.toThrow(/source/i);
    await expect(runDeskAction(inboxActions, { action: "create_automation", targetIds: ["auto-x"], params: { source: "inbox.daily_digest", channel: "fax", time: "21:00" } }, ctxWith(access))).rejects.toThrow(/channel/i);
    await expect(runDeskAction(inboxActions, { action: "create_automation", targetIds: ["auto-x"], params: { source: "inbox.daily_digest", channel: "slack", time: "9pm" } }, ctxWith(access))).rejects.toThrow(/HH:MM/);
    expect(access.saved.automations).toHaveLength(0);
  });

  it("hitting the demo limit is a visible failure, not a silent no-op", async () => {
    const access = fakeAccess(emptyState(), 1);
    const mk = () => buildDemoReply("send me a summary every day at 9pm", []).proposal!;
    const first = mk();
    await runDeskAction(inboxActions, { action: first.action, targetIds: first.targets.map((t) => t.id), params: first.params }, ctxWith(access));
    const second = mk();
    const r = await runDeskAction(inboxActions, { action: second.action, targetIds: second.targets.map((t) => t.id), params: second.params }, ctxWith(access));
    expect(r.failed[0]?.error).toMatch(/limit/i);
    expect(access.saved.automations).toHaveLength(1);
  });

  it("ordinary commands still work and are not mistaken for routines", () => {
    expect(buildDemoReply("send Maya Chen the reply", []).proposal?.action).not.toBe("create_automation");
    expect(buildDemoReply("what is urgent?", []).proposal).toBeUndefined();
  });
});
