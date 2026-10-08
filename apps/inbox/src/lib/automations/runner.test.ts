import { describe, expect, it, vi } from "vitest";
import type { AutomationSpec } from "@helix/core/automations";
import { runAutomation, type RunDeps } from "./runner";

const spec = (over: Partial<AutomationSpec> = {}): AutomationSpec => ({
  id: "auto-1",
  name: "Digest",
  origin: "user",
  status: "active",
  trigger: { kind: "daily", time: "21:00", tz: "UTC" },
  steps: [
    { type: "source", node: "inbox.daily_digest" },
    { type: "send", channel: "slack" },
  ],
  createdBy: "chat",
  createdAt: "2026-10-06T00:00:00.000Z",
  updatedAt: "2026-10-06T00:00:00.000Z",
  confirmedAt: "2026-10-06T00:00:00.000Z",
  missing: [],
  ...over,
});

const deps = (over: Partial<RunDeps> = {}): RunDeps => ({
  now: () => new Date("2026-10-07T21:00:05.000Z"),
  threads: async () => [],
  vipSenders: [],
  sendSlack: vi.fn(async () => ({ ok: true as const })),
  sendTwilio: vi.fn(async () => ({ ok: true as const })),
  ...over,
});

describe("runAutomation", () => {
  it("a preview computes the exact text and sends nothing", async () => {
    const d = deps();
    const run = await runAutomation(spec(), { trigger: "manual", preview: true }, d);
    expect(run.status).toBe("ok");
    expect(run.preview).toBe(true);
    expect(run.text).toMatch(/Inbox digest/);
    expect(run.delivered).toEqual([]);
    expect(d.sendSlack).not.toHaveBeenCalled();
  });

  it("a real run sends the same text it records", async () => {
    const d = deps();
    const run = await runAutomation(spec(), { trigger: "schedule", scheduledFor: "2026-10-07T21:00:00.000Z" }, d);
    expect(run.status).toBe("ok");
    expect(run.preview).toBe(false);
    expect(run.delivered).toEqual(["slack"]);
    expect(d.sendSlack).toHaveBeenCalledWith(run.text);
    expect(run.key).toBe("auto-1@2026-10-07T21:00:00.000Z");
  });

  it("refuses to send for real an automation the person never confirmed", async () => {
    const d = deps();
    const run = await runAutomation(spec({ confirmedAt: null }), { trigger: "schedule", scheduledFor: "2026-10-07T21:00:00.000Z" }, d);
    expect(run.status).toBe("failed");
    expect(run.error).toMatch(/confirm/i);
    expect(d.sendSlack).not.toHaveBeenCalled();
  });

  it("a failing channel is a visible failed run with the reason, not a silent success", async () => {
    const d = deps({ sendSlack: vi.fn(async () => ({ ok: false as const, error: "Slack answered 404" })) });
    const run = await runAutomation(spec(), { trigger: "schedule", scheduledFor: "2026-10-07T21:00:00.000Z" }, d);
    expect(run.status).toBe("failed");
    expect(run.error).toContain("Slack answered 404");
    expect(run.delivered).toEqual([]);
  });

  it("a thrown error inside a sender is caught and recorded", async () => {
    const d = deps({ sendSlack: vi.fn(async () => { throw new Error("socket hang up"); }) });
    const run = await runAutomation(spec(), { trigger: "schedule", scheduledFor: "2026-10-07T21:00:00.000Z" }, d);
    expect(run.status).toBe("failed");
    expect(run.error).toContain("socket hang up");
  });

  it("reports a partial delivery honestly: what worked and what did not", async () => {
    const d = deps({ sendTwilio: vi.fn(async () => ({ ok: false as const, error: "Twilio 21608" })) });
    const s = spec({
      steps: [
        { type: "source", node: "inbox.daily_digest" },
        { type: "send", channel: "slack" },
        { type: "send", channel: "whatsapp", to: "+5215512345678" },
      ],
    });
    const run = await runAutomation(s, { trigger: "schedule", scheduledFor: "2026-10-07T21:00:00.000Z" }, d);
    expect(run.status).toBe("failed");
    expect(run.delivered).toEqual(["slack"]);
    expect(run.error).toContain("whatsapp");
    expect(run.error).toContain("Twilio 21608");
  });

  it("a phone channel without a valid recipient fails before calling Twilio", async () => {
    const d = deps();
    const s = spec({ steps: [{ type: "source", node: "inbox.daily_digest" }, { type: "send", channel: "whatsapp" }] });
    const run = await runAutomation(s, { trigger: "schedule", scheduledFor: "2026-10-07T21:00:00.000Z" }, d);
    expect(run.status).toBe("failed");
    expect(run.error).toMatch(/recipient/i);
    expect(d.sendTwilio).not.toHaveBeenCalled();
  });

  it("in-app delivery needs no connector and is recorded as delivered", async () => {
    const d = deps();
    const s = spec({ steps: [{ type: "source", node: "inbox.daily_digest" }, { type: "send", channel: "in_app" }] });
    const run = await runAutomation(s, { trigger: "manual", preview: false }, d);
    expect(run.status).toBe("ok");
    expect(run.delivered).toEqual(["in_app"]);
  });

  it("an unknown source is a failed run, not an empty message", async () => {
    const s = spec({ steps: [{ type: "source", node: "inbox.nope" }, { type: "send", channel: "in_app" }] });
    const run = await runAutomation(s, { trigger: "manual", preview: true }, deps());
    expect(run.status).toBe("failed");
    expect(run.error).toMatch(/unknown source/i);
  });

  it("manual runs get unique keys so they never collide with scheduled ones", async () => {
    const a = await runAutomation(spec(), { trigger: "manual", preview: true }, deps());
    expect(a.key.startsWith("auto-1@manual:")).toBe(true);
    expect(a.scheduledFor).toBeNull();
  });
});
